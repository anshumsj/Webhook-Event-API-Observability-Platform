require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEvent = require('./models/WebhookEvent');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const events = await WebhookEvent.find().sort({ createdAt: -1 }).limit(3).lean();
  console.log('3 most recent WebhookEvents:');
  console.log(JSON.stringify(events.map(e => ({
    _id: e._id,
    eventId: e.eventId,
    projectId: e.projectId,
    endpointId: e.endpointId,
    status: e.status,
    receivedAt: e.receivedAt
  })), null, 2));

  const userProjectId = "6a8987035c8b8010293b6bc";
  const queryResult = await WebhookEvent.find({ projectId: userProjectId }).limit(3).lean();
  console.log(`\nQuery by projectId "${userProjectId}":`);
  console.log(JSON.stringify(queryResult.map(e => ({ _id: e._id, eventId: e.eventId, projectId: e.projectId })), null, 2));

  try {
     const pIdObj = new mongoose.Types.ObjectId(userProjectId);
     console.log('Valid ObjectId:', String(pIdObj));
  } catch(e) {
     console.log('Invalid ObjectId error:', e.message);
  }
  
  process.exit(0);
}
run();
