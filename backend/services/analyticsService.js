const mongoose = require('mongoose');
const WebhookEvent = require('../models/WebhookEvent');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const DeliveryAttempt = require('../models/DeliveryAttempt');

const HEALTH_WINDOW_HOURS = 24;

const HEALTHY_SUCCESS_RATE = 99;
const DEGRADED_SUCCESS_RATE = 80;
const HEALTHY_LATENCY_MS = 500;
const DEGRADED_LATENCY_MS = 1000;

const classifyEndpointHealth = (successRate, avgLatency, completedAttempts) => {
  if (completedAttempts === 0) return 'no_data';
  
  if (successRate < DEGRADED_SUCCESS_RATE || avgLatency >= DEGRADED_LATENCY_MS) {
    return 'unhealthy';
  } else if (successRate >= HEALTHY_SUCCESS_RATE && avgLatency < HEALTHY_LATENCY_MS) {
    return 'healthy';
  }
  return 'degraded';
};

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
        pendingAttempts: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
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
        pendingAttempts: 0,
        completedAttempts: 0,
        successRate: 0,
        averageLatencyMs: 0,
        retryCount: 0,
        lastDeliveryAt: null
      };
    }

    const completedAttempts = stats.successfulAttempts + stats.failedAttempts;
    const successRate = completedAttempts > 0 ? (stats.successfulAttempts / completedAttempts) * 100 : 0;
    const avgLatency = stats.latencyCount > 0 ? (stats.latencySum / stats.latencyCount) : 0;
    const health = classifyEndpointHealth(successRate, avgLatency, completedAttempts);

    return {
      _id: String(ep._id),
      endpointId: ep.endpointId,
      destinationUrl: ep.destinationUrl,
      health,
      totalAttempts: stats.totalAttempts,
      successfulAttempts: stats.successfulAttempts,
      failedAttempts: stats.failedAttempts,
      pendingAttempts: stats.pendingAttempts,
      completedAttempts,
      successRate: Math.round(successRate * 100) / 100,
      averageLatencyMs: Math.round(avgLatency),
      retryCount: stats.retryCount,
      lastDeliveryAt: stats.lastDeliveryAt
    };
  });
};

const getWorkspaceAnalytics = async (workspaceId, timeRange = '24h') => {
  const objectId = new mongoose.Types.ObjectId(workspaceId);

  // 1. Calculate time boundary
  let since = new Date();
  if (timeRange === '7d') {
    since.setDate(since.getDate() - 7);
  } else if (timeRange === '30d') {
    since.setDate(since.getDate() - 30);
  } else {
    // Default 24h
    since.setHours(since.getHours() - 24);
  }

  // 2. Find projects for this workspace
  const Project = require('../models/Project');
  const projects = await Project.find({ workspaceId: objectId }).select('_id');
  const projectIds = projects.map(p => p._id);

  if (projectIds.length === 0) {
    return {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      successRate: 0,
      retryRate: 0,
      averageLatencyMs: 0,
      deadLettered: 0,
      timeRange
    };
  }

  // 3. Aggregate WebhookEvents (use receivedAt for time window)
  const eventAgg = await WebhookEvent.aggregate([
    { $match: { projectId: { $in: projectIds }, receivedAt: { $gte: since } } },
    { $group: {
        _id: null,
        totalDeliveries: { $sum: 1 },
        successfulDeliveries: { $sum: { $cond: [{ $eq: ["$status", "processed"] }, 1, 0] } },
        failedDeliveries: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        deadLettered: { $sum: { $cond: [{ $eq: ["$status", "retry_exhausted"] }, 1, 0] } },
        eventIds: { $push: "$_id" } // Collect all event IDs for exact population match
    }}
  ]);

  const eventStats = eventAgg[0] || {
    totalDeliveries: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    deadLettered: 0,
    eventIds: []
  };

  let retriedEvents = 0;
  let averageLatencyMs = 0;

  // 4. Aggregate DeliveryAttempts matching the EXACT event population
  if (eventStats.eventIds.length > 0) {
    const attemptAgg = await DeliveryAttempt.aggregate([
      { $match: { webhookEventId: { $in: eventStats.eventIds } } },
      { $facet: {
          retryStats: [
            { $group: { _id: "$webhookEventId", maxAttempt: { $max: "$attemptNumber" } } },
            { $match: { maxAttempt: { $gt: 1 } } },
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

  // 5. Calculate rates safely
  const successRate = eventStats.totalDeliveries > 0 
    ? (eventStats.successfulDeliveries / eventStats.totalDeliveries) * 100 
    : 0;

  const retryRate = eventStats.totalDeliveries > 0 
    ? (retriedEvents / eventStats.totalDeliveries) * 100 
    : 0;

  return {
    totalDeliveries: eventStats.totalDeliveries,
    successfulDeliveries: eventStats.successfulDeliveries,
    failedDeliveries: eventStats.failedDeliveries,
    successRate: Math.round(successRate * 100) / 100,
    retryRate: Math.round(retryRate * 100) / 100,
    averageLatencyMs: Math.round(averageLatencyMs),
    deadLettered: eventStats.deadLettered,
    timeRange
  };
};

const getWorkspaceEndpointHealth = async (workspaceId, timeRange = '24h') => {
  const objectId = new mongoose.Types.ObjectId(workspaceId);

  // 1. Calculate time boundary
  let since = new Date();
  if (timeRange === '7d') since.setDate(since.getDate() - 7);
  else if (timeRange === '30d') since.setDate(since.getDate() - 30);
  else since.setHours(since.getHours() - 24);

  // 2. Find projects for this workspace
  const Project = require('../models/Project');
  const projects = await Project.find({ workspaceId: objectId }).select('_id');
  const projectIds = projects.map(p => p._id);

  if (projectIds.length === 0) return { timeRange, endpoints: [] };

  // 3. Find endpoints for these projects
  const endpoints = await WebhookEndpoint.find({ projectId: { $in: projectIds } }).select('_id endpointId destinationUrl');
  if (endpoints.length === 0) return { timeRange, endpoints: [] };

  const endpointIds = endpoints.map(ep => ep._id);

  // 4. Aggregate recent DeliveryAttempts by endpoint
  const attemptAgg = await DeliveryAttempt.aggregate([
    { $match: { endpointId: { $in: endpointIds }, startedAt: { $gte: since } } },
    {
      $group: {
        _id: "$endpointId",
        totalAttempts: { $sum: 1 },
        successfulAttempts: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
        failedAttempts: { $sum: { $cond: [{ $in: ["$status", ["failed", "timeout"]] }, 1, 0] } },
        pendingAttempts: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        latencySum: { $sum: { $cond: [{ $ne: ["$latencyMs", null] }, "$latencyMs", 0] } },
        latencyCount: { $sum: { $cond: [{ $ne: ["$latencyMs", null] }, 1, 0] } },
        retryCount: { $sum: { $cond: [{ $gt: ["$attemptNumber", 1] }, 1, 0] } },
        lastDeliveryAt: { $max: "$startedAt" }
      }
    }
  ]);

  const attemptMap = {};
  for (const stat of attemptAgg) {
    attemptMap[String(stat._id)] = stat;
  }

  // 6. Format and Classify Health
  const results = endpoints.map(ep => {
    const epIdStr = String(ep._id);
    const stats = attemptMap[epIdStr];

    if (!stats || stats.totalAttempts === 0) {
      return {
        _id: epIdStr,
        endpointId: ep.endpointId,
        destinationUrl: ep.destinationUrl,
        health: 'no_data',
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        pendingAttempts: 0,
        completedAttempts: 0,
        successRate: 0,
        averageLatencyMs: 0,
        retryCount: 0,
        lastDeliveryAt: null,
        // Legacy fields
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deadLettered: 0
      };
    }

    const completedAttempts = stats.successfulAttempts + stats.failedAttempts;
    const successRate = completedAttempts > 0 ? (stats.successfulAttempts / completedAttempts) * 100 : 0;
    const avgLatency = stats.latencyCount > 0 ? (stats.latencySum / stats.latencyCount) : 0;
    const health = classifyEndpointHealth(successRate, avgLatency, completedAttempts);

    return {
      _id: epIdStr,
      endpointId: ep.endpointId,
      destinationUrl: ep.destinationUrl,
      health,
      totalAttempts: stats.totalAttempts,
      successfulAttempts: stats.successfulAttempts,
      failedAttempts: stats.failedAttempts,
      pendingAttempts: stats.pendingAttempts,
      completedAttempts,
      successRate: Math.round(successRate * 100) / 100,
      averageLatencyMs: Math.round(avgLatency),
      retryCount: stats.retryCount,
      lastDeliveryAt: stats.lastDeliveryAt,
      // Legacy fields preserved for backward compatibility
      totalDeliveries: stats.totalAttempts,
      successfulDeliveries: stats.successfulAttempts,
      failedDeliveries: stats.failedAttempts,
      deadLettered: 0
    };
  });

  // 7. Sort
  const healthOrder = { unhealthy: 1, degraded: 2, healthy: 3, no_data: 4 };
  results.sort((a, b) => {
    if (healthOrder[a.health] !== healthOrder[b.health]) {
      return healthOrder[a.health] - healthOrder[b.health];
    }
    if (a.failedAttempts !== b.failedAttempts) {
      return b.failedAttempts - a.failedAttempts;
    }
    return a.successRate - b.successRate;
  });

  return { timeRange, endpoints: results };
};

const getWorkspaceDeliveryTrends = async (workspaceId, timeRange = '24h') => {
  const objectId = new mongoose.Types.ObjectId(workspaceId);

  // 1. Calculate time boundary and UTC buckets
  const buckets = [];
  const now = new Date();
  let since;
  let unit;

  if (timeRange === '7d') {
    unit = 'day';
    const currentBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentBucket);
      d.setUTCDate(d.getUTCDate() - i);
      buckets.push({
        timestamp: d.toISOString(),
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deadLettered: 0,
        retriedDeliveries: 0
      });
    }
  } else if (timeRange === '30d') {
    unit = 'day';
    const currentBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    for (let i = 29; i >= 0; i--) {
      const d = new Date(currentBucket);
      d.setUTCDate(d.getUTCDate() - i);
      buckets.push({
        timestamp: d.toISOString(),
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deadLettered: 0,
        retriedDeliveries: 0
      });
    }
  } else {
    // 24h -> 24 hourly buckets
    unit = 'hour';
    const currentBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0));
    for (let i = 23; i >= 0; i--) {
      const d = new Date(currentBucket);
      d.setUTCHours(d.getUTCHours() - i);
      buckets.push({
        timestamp: d.toISOString(),
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deadLettered: 0,
        retriedDeliveries: 0
      });
    }
  }
  
  since = new Date(buckets[0].timestamp);

  // 2. Find projects for this workspace
  const Project = require('../models/Project');
  const projects = await Project.find({ workspaceId: objectId }).select('_id');
  const projectIds = projects.map(p => p._id);

  if (projectIds.length === 0) return { timeRange, bucket: unit, data: buckets };

  // 3. Aggregate WebhookEvents matching the time boundary
  const eventAgg = await WebhookEvent.aggregate([
    { $match: { projectId: { $in: projectIds }, receivedAt: { $gte: since } } },
    { $group: {
        _id: { $dateTrunc: { date: "$receivedAt", unit: unit } },
        totalDeliveries: { $sum: 1 },
        successfulDeliveries: { $sum: { $cond: [{ $eq: ["$status", "processed"] }, 1, 0] } },
        failedDeliveries: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        deadLettered: { $sum: { $cond: [{ $eq: ["$status", "retry_exhausted"] }, 1, 0] } },
        eventIds: { $push: "$_id" }
    }}
  ]);

  const bucketMap = {};
  const allEventIds = [];
  
  for (const stat of eventAgg) {
    const ts = new Date(stat._id).toISOString();
    bucketMap[ts] = stat;
    allEventIds.push(...stat.eventIds);
  }

  // 4. Aggregate DeliveryAttempts matching EXACT event population for retries
  let retriedEventsSet = new Set();
  if (allEventIds.length > 0) {
    const attemptAgg = await DeliveryAttempt.aggregate([
      { $match: { webhookEventId: { $in: allEventIds } } },
      { $group: { _id: "$webhookEventId", maxAttempt: { $max: "$attemptNumber" } } },
      { $match: { maxAttempt: { $gt: 1 } } }
    ]);
    
    for (const a of attemptAgg) {
      retriedEventsSet.add(String(a._id));
    }
  }

  // 5. Merge into continuous array
  for (const b of buckets) {
    const bData = bucketMap[b.timestamp];
    if (bData) {
      b.totalDeliveries = bData.totalDeliveries;
      b.successfulDeliveries = bData.successfulDeliveries;
      b.failedDeliveries = bData.failedDeliveries;
      b.deadLettered = bData.deadLettered;
      
      let retriesInBucket = 0;
      for (const eid of bData.eventIds) {
        if (retriedEventsSet.has(String(eid))) {
          retriesInBucket++;
        }
      }
      b.retriedDeliveries = retriesInBucket;
    }
  }

  return { timeRange, bucket: unit, data: buckets };
};

module.exports = {
  getProjectAnalytics,
  getEndpointHealth,
  getWorkspaceAnalytics,
  getWorkspaceEndpointHealth,
  getWorkspaceDeliveryTrends
};
