require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const db = mongoose.connection.db;
  const events = await db.collection('webhookevents').find().sort({ createdAt: -1 }).limit(3).toArray();
  
  console.log('3 most recent WebhookEvents (RAW FROM DB):');
  events.forEach((e, i) => {
    console.log(`[${i}] _id: ${e._id} (${typeof e._id}, ${e._id.constructor.name})`);
    console.log(`    projectId: ${e.projectId} (${typeof e.projectId}, ${e.projectId ? e.projectId.constructor.name : 'N/A'})`);
  });

  process.exit(0);
}
run();
