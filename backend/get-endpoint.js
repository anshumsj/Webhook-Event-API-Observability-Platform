const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/webhook-platform')
.then(async () => {
  const WebhookEndpoint = require('./models/WebhookEndpoint');
  const ep = await WebhookEndpoint.findOne();
  console.log(ep._id.toString());
  process.exit(0);
});
