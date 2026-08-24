require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEvent = require('./models/WebhookEvent');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const today = new Date();
  today.setHours(0,0,0,0);
  const events = await WebhookEvent.find({ createdAt: { $gte: today } }).sort({ createdAt: -1 }).lean();
  
  console.log(`Events created today: ${events.length}`);
  events.slice(0, 10).forEach((e, i) => {
    console.log(`[${i}] ID: ${e._id}, Event: ${e.eventId}, Project: ${e.projectId}, Endpoint: ${e.endpointId}, Time: ${e.createdAt}`);
  });

  process.exit(0);
}
run();
