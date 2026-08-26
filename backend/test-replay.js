require('dotenv').config();
const mongoose = require('mongoose');
const { replayEvent } = require('./controllers/webhookController');
const { startWorker, shutdownWorker } = require('./queue/webhookWorker');
const { getWebhookQueue } = require('./queue/webhookQueue');
const { connectRedis, closeRedis } = require('./config/redis');
const Workspace = require('./models/Workspace');
const Project = require('./models/Project');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  await connectRedis();
  console.log('Connected to MongoDB & Redis.');

  const userId = new mongoose.Types.ObjectId();
  const workspace = await Workspace.create({ name: 'Replay WS', owner: userId });
  const project = await Project.create({ name: 'Replay Project', workspaceId: workspace._id, createdBy: userId });
  const endpoint = await WebhookEndpoint.create({ projectId: project._id, destinationUrl: 'http://localhost:1234/test', secret: 'testsecret' });

  // Start worker
  const worker = startWorker();
  
  // Test 1: Replay a processed event
  const event = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-replay-1',
    status: 'processed',
    eventType: 'order.created',
    payload: { replay: "test" },
    receivedAt: new Date(Date.now() - 1000 * 60)
  });

  await DeliveryAttempt.create({
    webhookEventId: event._id,
    endpointId: endpoint._id,
    attemptNumber: 1,
    attemptType: 'automatic',
    status: 'success',
    startedAt: new Date(Date.now() - 1000 * 30),
    completedAt: new Date(Date.now() - 1000 * 29),
    destinationUrl: endpoint.destinationUrl
  });

  const req = {
    params: { eventId: event.eventId },
    user: { id: userId }
  };
  const res = mockResponse();
  
  console.log('Testing successful replay queueing...');
  await replayEvent(req, res);
  
  if (res.statusCode !== 202) throw new Error(`Expected 202, got ${res.statusCode} ${JSON.stringify(res.data)}`);
  console.log('[PASS] Replay successfully queued');

  // Wait for worker to process
  await delay(2000);

  // Check attempt
  const attempts = await DeliveryAttempt.find({ webhookEventId: event._id }).sort({ attemptNumber: 1 });
  if (attempts.length !== 2) throw new Error(`Expected 2 attempts, got ${attempts.length}`);
  const replayAttempt = attempts[1];
  
  if (replayAttempt.attemptNumber !== 2) throw new Error('Replay attempt number should be 2');
  if (replayAttempt.attemptType !== 'manual') throw new Error(`Expected attemptType manual, got ${replayAttempt.attemptType}`);
  if (replayAttempt.status !== 'failed') throw new Error(`Expected replay attempt to fail (no server), got ${replayAttempt.status}`);
  
  // Verify idempotency key does not equal original event Id
  const key = replayAttempt.requestHeaders?.get ? replayAttempt.requestHeaders.get('Idempotency-Key') : replayAttempt.requestHeaders['Idempotency-Key'];
  if (key !== `${event.eventId}-attempt-2`) throw new Error(`Incorrect idempotency key: ${key}`);

  console.log('[PASS] Worker processed manual replay attempt cleanly');

  // Test: Change endpoint secret and verify signature
  endpoint.secret = 'newsecret123';
  await endpoint.save();

  const reqReplay3 = { params: { eventId: event.eventId }, user: { id: userId } };
  const resReplay3 = mockResponse();
  await replayEvent(reqReplay3, resReplay3);
  await delay(2000); // wait for worker

  const attemptsAfter = await DeliveryAttempt.find({ webhookEventId: event._id }).sort({ attemptNumber: 1 });
  if (attemptsAfter.length !== 3) throw new Error(`Expected 3 attempts, got ${attemptsAfter.length}`);
  const replayAttempt3 = attemptsAfter[2];
  
  const crypto = require('crypto');
  const expectedSig = crypto.createHmac('sha256', 'newsecret123').update(JSON.stringify({ replay: "test" })).digest('hex');
  const actualSig = replayAttempt3.requestHeaders?.get ? replayAttempt3.requestHeaders.get('X-HookSight-Signature') : replayAttempt3.requestHeaders['X-HookSight-Signature'];
  if (actualSig !== `sha256=${expectedSig}`) throw new Error(`Expected sha256=${expectedSig}, got ${actualSig}`);
  console.log('[PASS] Fresh signature is generated and stored correctly');

  // Test 2: Cannot replay non-terminal state
  const pendingEvent = await WebhookEvent.create({
    projectId: project._id,
    endpointId: endpoint._id,
    requestId: 'req-replay-2',
    status: 'processing',
    eventType: 'order.created',
    payload: { replay: "test2" }
  });
  
  const reqPending = { params: { eventId: pendingEvent.eventId }, user: { id: userId } };
  const resPending = mockResponse();
  await replayEvent(reqPending, resPending);
  if (resPending.statusCode !== 400) throw new Error(`Expected 400 for pending event, got ${resPending.statusCode}`);
  console.log('[PASS] Rejected replay of processing event');

  // Test 3: Unauthorized
  const unauthorizedUser = new mongoose.Types.ObjectId();
  const reqUnauth = { params: { eventId: event.eventId }, user: { id: unauthorizedUser } };
  const resUnauth = mockResponse();
  await replayEvent(reqUnauth, resUnauth);
  if (resUnauth.statusCode !== 403) throw new Error(`Expected 403 for unauthorized, got ${resUnauth.statusCode}`);
  console.log('[PASS] Workspace isolation enforced');
  
  // Test 4: Endpoint deleted
  await WebhookEndpoint.findByIdAndDelete(endpoint._id);
  const resDeleted = mockResponse();
  await replayEvent(req, resDeleted);
  if (resDeleted.statusCode !== 400) throw new Error(`Expected 400 for deleted endpoint, got ${resDeleted.statusCode}`);
  console.log('[PASS] Rejected replay for deleted endpoint');

  // Cleanup
  await DeliveryAttempt.deleteMany({ webhookEventId: { $in: [event._id, pendingEvent._id] } });
  await WebhookEvent.deleteMany({ projectId: project._id });
  await WebhookEndpoint.deleteMany({ projectId: project._id });
  await Project.findByIdAndDelete(project._id);
  await Workspace.findByIdAndDelete(workspace._id);
  
  await shutdownWorker();
  
  // Give redis connections time to close
  await delay(1000);
  
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
