require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEvent = require('./models/WebhookEvent');
const DeliveryAttempt = require('./models/DeliveryAttempt');
const WebhookEndpoint = require('./models/WebhookEndpoint');

async function analyze() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find endpoints with attempts
  const attempts = await DeliveryAttempt.aggregate([
    { $group: { _id: "$endpointId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 }
  ]);
  
  if (attempts.length === 0) {
    console.log("No DeliveryAttempts in DB at all.");
    process.exit(0);
  }
  
  const endpointId = attempts[0]._id;
  const endpoint = await WebhookEndpoint.findById(endpointId);
  
  console.log(`Analyzing Endpoint: ${endpoint?.endpointId || 'Unknown'} (${endpointId})`);
  
  const totalEvents = await WebhookEvent.countDocuments({ endpointId });
  const totalAttempts = await DeliveryAttempt.countDocuments({ endpointId });
  
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const attempts24h = await DeliveryAttempt.countDocuments({ endpointId, startedAt: { $gte: since } });
  
  console.log(`Total WebhookEvents: ${totalEvents}`);
  console.log(`Total DeliveryAttempts (All time): ${totalAttempts}`);
  console.log(`DeliveryAttempts (Last 24h): ${attempts24h}`);

  process.exit(0);
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
