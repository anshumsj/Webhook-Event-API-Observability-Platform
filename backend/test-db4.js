require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEvent = require('./models/WebhookEvent');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const projectId = "6a898613d5c8b8010293b6b9"; // testing project 1
  try {
    const events = await WebhookEvent.find({ projectId: projectId }).limit(3).lean();
    console.log(`Querying by projectId: ${projectId}`);
    console.log(JSON.stringify(events.map(e => ({ _id: e._id, eventId: e.eventId, projectId: e.projectId })), null, 2));
  } catch (err) {
    console.error("Error querying events:", err.message);
  }

  process.exit(0);
}
run();
