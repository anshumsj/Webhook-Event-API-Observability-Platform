require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const events = await db.collection('webhookevents').find().toArray();
  const endpoints = await db.collection('webhookendpoints').find().toArray();
  const project1Id = "6a898613d5c8b8010293b6b9";

  console.log(`Total WebhookEvents: ${events.length}`);

  // 1. Group by projectId
  const byProjectId = {};
  events.forEach(e => {
    const pid = e.projectId ? String(e.projectId) : 'MISSING';
    byProjectId[pid] = (byProjectId[pid] || 0) + 1;
  });
  console.log('\n1. WebhookEvent count grouped by projectId:');
  console.table(byProjectId);

  // 2. Group by endpointId
  const byEndpointId = {};
  events.forEach(e => {
    const eid = e.endpointId ? String(e.endpointId) : 'MISSING';
    byEndpointId[eid] = (byEndpointId[eid] || 0) + 1;
  });
  console.log('\n2. WebhookEvent count grouped by endpointId:');
  console.table(byEndpointId);

  // 3. For every endpoint belonging to project1, count its WebhookEvents
  console.log(`\n3. Event counts for endpoints belonging to Project ${project1Id}:`);
  const project1Endpoints = endpoints.filter(ep => String(ep.projectId) === project1Id);
  const project1EndpointIds = project1Endpoints.map(ep => String(ep._id));
  
  let totalProject1EventsByEndpoint = 0;
  project1Endpoints.forEach(ep => {
    const eid = String(ep._id);
    const count = byEndpointId[eid] || 0;
    console.log(`- Endpoint ${eid}: ${count} events`);
    totalProject1EventsByEndpoint += count;
  });
  console.log(`Total events for Project 1 based on its endpoints: ${totalProject1EventsByEndpoint}`);

  // 4. Where the remaining events belong
  console.log('\n4. Where do the remaining events belong?');
  let remainingCount = 0;
  events.forEach(e => {
    const eid = String(e.endpointId);
    if (!project1EndpointIds.includes(eid)) {
      remainingCount++;
      const ep = endpoints.find(ep => String(ep._id) === eid);
      const epProjectId = ep ? String(ep.projectId) : 'UNKNOWN PROJECT';
      console.log(`- Event ${e._id} belongs to Endpoint ${eid} (which maps to Project ${epProjectId})`);
    }
  });
  console.log(`Total remaining events: ${remainingCount}`);

  // 5. Confirm whether all 28 events returned by API belong to Project 1
  // The API returns events where endpointId IN project1EndpointIds.
  console.log('\n5. Do all events matching Project 1 endpoints actually belong to Project 1?');
  let validAPIEventCount = 0;
  let mismatchedAPIEventCount = 0;
  events.forEach(e => {
    if (project1EndpointIds.includes(String(e.endpointId))) {
      validAPIEventCount++;
      if (String(e.projectId) !== project1Id && e.projectId != null) {
        mismatchedAPIEventCount++;
        console.log(`WARNING: Event ${e._id} has endpoint from Project 1, but its projectId is ${e.projectId}`);
      }
    }
  });
  console.log(`Total events mapped to Project 1 endpoints: ${validAPIEventCount}`);
  console.log(`Mismatched projectId: ${mismatchedAPIEventCount}`);

  // 6. Check whether any events belonging to Project 1 are being incorrectly excluded.
  console.log('\n6. Check whether any events belonging to Project 1 are being incorrectly excluded.');
  let excludedCount = 0;
  events.forEach(e => {
    // If the event HAS projectId = Project 1, but its endpoint is NOT in Project 1's endpoints
    if (String(e.projectId) === project1Id && !project1EndpointIds.includes(String(e.endpointId))) {
      excludedCount++;
      console.log(`EXCLUDED EVENT: ${e._id} has projectId ${project1Id} but endpointId ${e.endpointId}`);
    }
  });
  console.log(`Total excluded events: ${excludedCount}`);

  process.exit(0);
}
run();
