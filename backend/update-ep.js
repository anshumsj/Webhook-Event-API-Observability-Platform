require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const WebhookEndpoint = require('./models/WebhookEndpoint');
  await WebhookEndpoint.updateOne(
    { endpointId: '2327509279fac595bcacb6e3' },
    { $set: { destinationUrl: 'http://localhost:4000/success' } }
  );
  console.log('Updated endpoint to point to /success');
  process.exit(0);
});
