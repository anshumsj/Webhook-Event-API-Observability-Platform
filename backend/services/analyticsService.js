const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const DeliveryAttempt = require('../models/DeliveryAttempt');

const getProjectAnalytics = async (projectId) => {
  const objectId = new mongoose.Types.ObjectId(projectId);

  // 1. Get endpoints for the project to scope DeliveryAttempt queries
  const endpoints = await WebhookEndpoint.find({ projectId: objectId }).select('_id');
  const endpointIds = endpoints.map(ep => ep._id);

  // 2. Aggregate WebhookEvents
  const eventAgg = await WebhookEvent.aggregate([
    { $match: { projectId: objectId } },
    { $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        processedEvents: { $sum: { $cond: [{ $eq: ["$status", "processed"] }, 1, 0] } },
        failedEvents: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        retryExhaustedEvents: { $sum: { $cond: [{ $eq: ["$status", "retry_exhausted"] }, 1, 0] } }
    }}
  ]);

  const eventStats = eventAgg[0] || {
    totalEvents: 0,
    processedEvents: 0,
    failedEvents: 0,
    retryExhaustedEvents: 0
  };

  let retriedEvents = 0;
  let averageLatencyMs = 0;

  // 3. Aggregate DeliveryAttempts (if there are endpoints)
  if (endpointIds.length > 0) {
    const attemptAgg = await DeliveryAttempt.aggregate([
      { $match: { endpointId: { $in: endpointIds } } },
      { $facet: {
          retryStats: [
            { $group: { _id: "$webhookEventId", attemptCount: { $sum: 1 } } },
            { $match: { attemptCount: { $gt: 1 } } },
            { $count: "count" }
          ],
          latencyStats: [
            { $match: { latencyMs: { $ne: null } } },
            { $group: { _id: null, averageLatencyMs: { $avg: "$latencyMs" } } }
          ]
      }}
    ]);

    const attemptStats = attemptAgg[0];
    retriedEvents = attemptStats?.retryStats?.[0]?.count || 0;
    averageLatencyMs = attemptStats?.latencyStats?.[0]?.averageLatencyMs || 0;
  }

  // 4. Calculate rates
  const successRate = eventStats.totalEvents > 0 
    ? (eventStats.processedEvents / eventStats.totalEvents) * 100 
    : 0;

  const retryRate = eventStats.totalEvents > 0 
    ? (retriedEvents / eventStats.totalEvents) * 100 
    : 0;

  return {
    totalEvents: eventStats.totalEvents,
    processedEvents: eventStats.processedEvents,
    failedEvents: eventStats.failedEvents,
    retryExhaustedEvents: eventStats.retryExhaustedEvents,
    successRate: Math.round(successRate * 100) / 100,
    retryRate: Math.round(retryRate * 100) / 100,
    averageLatencyMs: Math.round(averageLatencyMs)
  };
};

module.exports = {
  getProjectAnalytics
};
