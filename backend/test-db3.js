require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookEvent = require('./models/WebhookEvent');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const projectId2 = "6a898703d5c8b8010293b6bc"; // "testing project 2"
  const endpoints2 = await WebhookEndpoint.find({ projectId: projectId2 }).lean();
  console.log('Endpoints for testing project 2:');
  console.log(JSON.stringify(endpoints2, null, 2));

  const endpointIds2 = endpoints2.map(e => e._id);
  const eventsByEndpoint = await WebhookEvent.find({ endpointId: { $in: endpointIds2 } }).sort({ createdAt: -1 }).limit(3).lean();
  
  console.log('\nEvents for testing project 2 (by endpoint):');
  console.log(JSON.stringify(eventsByEndpoint.map(e => ({ _id: e._id, eventId: e.eventId, projectId: e.projectId, endpointId: e.endpointId })), null, 2));

  const eventsByProject = await WebhookEvent.find({ projectId: projectId2 }).sort({ createdAt: -1 }).limit(3).lean();
  console.log('\nEvents for testing project 2 (by projectId):');
  console.log(JSON.stringify(eventsByProject.map(e => ({ _id: e._id, eventId: e.eventId, projectId: e.projectId, endpointId: e.endpointId })), null, 2));

  process.exit(0);
}
run();
