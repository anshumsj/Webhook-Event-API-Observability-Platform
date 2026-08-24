const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const DeliveryAttempt = require('../models/DeliveryAttempt');

const HEALTH_WINDOW_HOURS = 24;

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

const getEndpointHealth = async (projectId) => {
  const objectId = new mongoose.Types.ObjectId(projectId);

  // 1. Get endpoints for the project
  const endpoints = await WebhookEndpoint.find({ projectId: objectId }).select('_id endpointId destinationUrl');
  if (endpoints.length === 0) return [];

  const endpointIds = endpoints.map(ep => ep._id);
  
  // Time window boundary
  const since = new Date(Date.now() - HEALTH_WINDOW_HOURS * 60 * 60 * 1000);

  // 2. Aggregate recent DeliveryAttempts by endpoint
  const attemptAgg = await DeliveryAttempt.aggregate([
    { $match: { endpointId: { $in: endpointIds }, startedAt: { $gte: since } } },
    {
      $group: {
        _id: "$endpointId",
        totalAttempts: { $sum: 1 },
        successfulAttempts: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
        failedAttempts: { $sum: { $cond: [{ $in: ["$status", ["failed", "timeout"]] }, 1, 0] } },
        latencySum: { $sum: { $cond: [{ $ne: ["$latencyMs", null] }, "$latencyMs", 0] } },
        latencyCount: { $sum: { $cond: [{ $ne: ["$latencyMs", null] }, 1, 0] } },
        retryCount: { $sum: { $cond: [{ $gt: ["$attemptNumber", 1] }, 1, 0] } },
        lastDeliveryAt: { $max: "$startedAt" }
      }
    }
  ]);

  // Map agg results by _id
  const aggMap = {};
  for (const stat of attemptAgg) {
    aggMap[String(stat._id)] = stat;
  }

  // 3. Format the final array
  return endpoints.map(ep => {
    const stats = aggMap[String(ep._id)];
    
    if (!stats || stats.totalAttempts === 0) {
      return {
        _id: String(ep._id),
        endpointId: ep.endpointId,
        destinationUrl: ep.destinationUrl,
        health: 'no_data',
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        successRate: 0,
        averageLatencyMs: 0,
        retryCount: 0,
        lastDeliveryAt: null
      };
    }

    const successRate = (stats.successfulAttempts / stats.totalAttempts) * 100;
    
    let health = 'no_data';
    if (successRate >= 95) health = 'healthy';
    else if (successRate >= 80) health = 'degraded';
    else health = 'unhealthy';

    const avgLatency = stats.latencyCount > 0 ? (stats.latencySum / stats.latencyCount) : 0;

    return {
      _id: String(ep._id),
      endpointId: ep.endpointId,
      destinationUrl: ep.destinationUrl,
      health,
      totalAttempts: stats.totalAttempts,
      successfulAttempts: stats.successfulAttempts,
      failedAttempts: stats.failedAttempts,
      successRate: Math.round(successRate * 100) / 100,
      averageLatencyMs: Math.round(avgLatency),
      retryCount: stats.retryCount,
      lastDeliveryAt: stats.lastDeliveryAt
    };
  });
};

module.exports = {
  getProjectAnalytics,
  getEndpointHealth
};
