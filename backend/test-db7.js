require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEndpoint = require('./models/WebhookEndpoint');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const endpointStr = "6a8987035c8b8010293b6bc"; // the user's string
  const endpoint = await WebhookEndpoint.findOne({ endpointId: endpointStr }).lean();
  console.log('Endpoint found by string ID:', endpoint);

  process.exit(0);
}
run();
