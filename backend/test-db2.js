require('dotenv').config();
const mongoose = require('mongoose');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const Project = require('./models/Project');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Check the endpoint that was used for the newest events
  const endpointObjectId = "6a898613d5c8b8010293b6ba";
  const endpoint = await WebhookEndpoint.findById(endpointObjectId).lean();
  console.log('WebhookEndpoint:');
  console.log(JSON.stringify(endpoint, null, 2));

  // Check the projects
  const projects = await Project.find().lean();
  console.log('\nProjects in DB:');
  console.log(JSON.stringify(projects.map(p => ({ _id: p._id, name: p.name })), null, 2));

  process.exit(0);
}
run();
