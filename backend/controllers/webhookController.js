const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookEvent = require('../models/WebhookEvent');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const { getWebhookQueue } = require('../queue/webhookQueue');

const ingestWebhook = async (req, res) => {
  const startTime = Date.now();
  try {
    const { endpointId } = req.params;

    // 1. Validate endpoint
    const endpoint = await WebhookEndpoint.findOne({ endpointId });
    if (!endpoint) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Extract event type from common webhook provider headers
    const eventType =
      req.headers['x-github-event'] ||
      req.headers['x-event-type']   ||
      req.body?.type                 ||
      'webhook.received';

    // 3. Persist the raw event immediately — status starts as 'received'
    const event = new WebhookEvent({
      projectId:  endpoint.projectId,
      endpointId: endpoint._id,
      requestId:  req.requestId,
      payload:    req.body,
      headers:    req.headers,
      status:     'received',
      eventType,
    });
    await event.save();

    const ingestTimeMs = Date.now() - startTime;

    // 4. Emit 'webhook:event:created' immediately so the dashboard shows
    //    the event at 'received' status without waiting for the worker.
    try {
      const io = require('../socket').getIO();
      io.to(`project:${event.projectId}`).emit('webhook:event:created', {
        _id:              String(event._id),
        eventId:          event.eventId,
        projectId:        String(event.projectId),
        eventType:        event.eventType,
        status:           'received',
        receivedAt:       event.receivedAt instanceof Date
                            ? event.receivedAt.toISOString()
                            : event.receivedAt,
        processingTimeMs: 0,
      });
    } catch (socketError) {
      console.error(`[${req.requestId}] Socket emit (created) failed:`, socketError.message);
    }

    // 5. Enqueue the job. On success, update event status → 'queued'.
    try {
      const queue = getWebhookQueue();
      await queue.add('process-webhook', {
        eventId:          event.eventId,
        projectId:        String(event.projectId),
        endpointId:       String(event.endpointId),
        receivedAt:       event.receivedAt instanceof Date
                            ? event.receivedAt.toISOString()
                            : event.receivedAt,
        processingTimeMs: ingestTimeMs,
      });

      // Update MongoDB status to 'queued'
      await WebhookEvent.findOneAndUpdate({ eventId: event.eventId }, { status: 'queued' });

      // Notify dashboard: received → queued
      try {
        const io = require('../socket').getIO();
        io.to(`project:${event.projectId}`).emit('webhook:event:updated', {
          _id:             String(event._id),
          eventId:         event.eventId,
          projectId:       String(event.projectId),
          eventType:       event.eventType,
          status:          'queued',
          receivedAt:      event.receivedAt instanceof Date
                             ? event.receivedAt.toISOString()
                             : event.receivedAt,
          processedAt:     null,
          processingTimeMs: 0,
        });
      } catch (socketError) {
        console.error(`[${req.requestId}] Socket emit (queued) failed:`, socketError.message);
      }

      console.log(`[${req.requestId}] Enqueued | eventId: ${event.eventId}`);
    } catch (queueError) {
      console.error(`[${req.requestId}] Failed to enqueue job:`, queueError.message);
      
      // Update MongoDB status to 'failed' so it isn't orphaned as 'received'
      await WebhookEvent.findOneAndUpdate({ eventId: event.eventId }, { status: 'failed' });
      
      return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'We couldn\'t process your webhook at this time. Please try again.', requestId: req ? req.requestId : 'unknown' } });
    }

    // 6. Log summary
    console.log(`[Ingest] ${req.requestId} | endpoint: ${endpointId} | event: ${event.eventId} | ${ingestTimeMs}ms`);

    // 7. Return 202 Accepted — we have received and persisted the event
    res.status(202).json({
      success:   true,
      message:   'Webhook received',
      eventId:   event.eventId,
      requestId: req.requestId,
    });

  } catch (error) {
    // Log only the error message, never the full error object to prevent leaking secrets/payloads
    console.error(`[${req.requestId}] Error ingesting webhook:`, error.message || 'Unknown error');
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'We couldn\'t process your webhook at this time. Please try again.', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getEventsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    
    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found', requestId: req ? req.requestId : 'unknown' } });
    }

    if (req.user.apiKeyWorkspaceId && req.user.apiKeyWorkspaceId !== project.workspaceId.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'API key is not authorized for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access events for this project', requestId: req ? req.requestId : 'unknown' } });
    }
    
    // 3. Build dynamic query
    const { status, endpointId, eventType, from, to, search, sort, order } = req.query;
    const query = { projectId };

    if (status) query.status = status;
    if (eventType) query.eventType = eventType;

    if (endpointId) {
      const endpointExists = await WebhookEndpoint.findOne({ endpointId, projectId });
      if (!endpointExists) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found or does not belong to this project', requestId: req ? req.requestId : 'unknown' } });
      }
      
      query.endpointId = endpointExists._id;
    }

    if (from || to) {
      query.receivedAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid "from" date format', requestId: req ? req.requestId : 'unknown' } });
        }
        query.receivedAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid "to" date format', requestId: req ? req.requestId : 'unknown' } });
        }
        query.receivedAt.$lte = toDate;
      }
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { eventId: { $regex: escapedSearch, $options: 'i' } },
        { eventType: { $regex: escapedSearch, $options: 'i' } },
        { requestId: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // 3.5 Sort logic
    const sortField = sort === 'receivedAt' ? 'receivedAt' : 'receivedAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortOrder, _id: sortOrder };

    // 4. Paginate and Query
    const skip = (page - 1) * limit;
    const total = await WebhookEvent.countDocuments(query);
    const rawEvents = await WebhookEvent.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    // Serialize to plain DTOs — same shape as the socket payload.
    // Returning raw Mongoose docs causes _id to be an ObjectId object,
    // which React rejects as a key and renders as "[object Object]".
    const events = rawEvents.map(e => ({
      _id:             String(e._id),
      eventId:         e.eventId,
      projectId:       String(e.projectId),
      eventType:       e.eventType,
      status:          e.status,
      receivedAt:      e.receivedAt instanceof Date ? e.receivedAt.toISOString() : e.receivedAt,
      processedAt:     e.processedAt instanceof Date ? e.processedAt.toISOString() : (e.processedAt || null),
      processingTimeMs: e.processingTimeMs,
    }));

    res.status(200).json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'We couldn\'t retrieve your events at this time. Please try again.', requestId: req ? req.requestId : 'unknown' } });
  }
};

const redactHeaders = (headersInput) => {
  if (!headersInput) return {};
  const plainHeaders = headersInput instanceof Map
    ? Object.fromEntries(headersInput)
    : Object.assign({}, headersInput);

  const sensitivePatterns = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'stripe-signature', 'x-hub-signature', 'secret', 'signature'];
  const redactedHeaders = {};
  for (const [key, val] of Object.entries(plainHeaders)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitivePatterns.some(pattern => lowerKey.includes(pattern));
    redactedHeaders[key] = isSensitive ? '[REDACTED]' : val;
  }
  return redactedHeaders;
};

const maskUrlCredentials = (urlString) => {
  if (!urlString) return urlString;
  try {
    const url = new URL(urlString);
    if (url.username) url.username = 'REDACTED';
    if (url.password) url.password = 'REDACTED';
    
    const sensitiveQueryParams = ['token', 'key', 'secret', 'api_key', 'apikey', 'auth'];
    const keys = Array.from(url.searchParams.keys());
    for (const key of keys) {
      if (sensitiveQueryParams.some(p => key.toLowerCase().includes(p))) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return url.toString();
  } catch (e) {
    return urlString;
  }
};

const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;

    // 1. Fetch event
    const event = await WebhookEvent.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Fetch project
    const project = await Project.findById(event.projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project associated with event not found', requestId: req ? req.requestId : 'unknown' } });
    }

    if (req.user.apiKeyWorkspaceId && req.user.apiKeyWorkspaceId !== project.workspaceId.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'API key is not authorized for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    // 3. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access this event', requestId: req ? req.requestId : 'unknown' } });
    }

    // 4. Redact sensitive headers
    const redactedHeaders = redactHeaders(event.headers);

    // 5. Fetch delivery attempts
    const DeliveryAttempt = require('../models/DeliveryAttempt');
    const rawAttempts = await DeliveryAttempt.find({ webhookEventId: event._id })
      .sort({ attemptNumber: 1 })
      .select('-__v')
      .lean();

    // Redact attempts telemetry and bound response size
    const attempts = rawAttempts.map(attempt => {
      let responseBody = attempt.responseBody;
      let responseBodyTruncated = false;
      
      if (typeof responseBody === 'string' && responseBody.length > 10000) {
        responseBody = responseBody.substring(0, 10000);
        responseBodyTruncated = true;
      }

      const dto = {
        ...attempt,
        destinationUrl: maskUrlCredentials(attempt.destinationUrl),
        requestHeaders: redactHeaders(attempt.requestHeaders),
        responseHeaders: redactHeaders(attempt.responseHeaders)
      };
      
      if (responseBody !== undefined) {
        dto.responseBody = responseBody;
      }
      if (responseBodyTruncated) {
        dto.responseBodyTruncated = true;
      }
      
      return dto;
    });

    // 7. Build an explicit, clean DTO — never spread toObject() directly,
    //    as it can include Mongoose internals depending on schema config.
    const dto = {
      eventId:          event.eventId,
      requestId:        event.requestId,
      projectId:        String(event.projectId),
      projectName:      project.name,
      eventType:        event.eventType,
      status:           event.status,
      payload:          event.payload,
      headers:          redactedHeaders,
      processingTimeMs: event.processingTimeMs,
      receivedAt:       event.receivedAt,
      processedAt:      event.processedAt || null,
      createdAt:        event.createdAt,
      updatedAt:        event.updatedAt,
      attempts:         attempts
    };

    res.status(200).json(dto);
  } catch (error) {
    console.error('Error fetching event by ID:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'We couldn\'t load your event details at this time. Please try again.', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getProjectEventTypes = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found', requestId: req ? req.requestId : 'unknown' } });

    if (req.user.apiKeyWorkspaceId && req.user.apiKeyWorkspaceId !== project.workspaceId.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'API key is not authorized for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized', requestId: req ? req.requestId : 'unknown' } });

    const types = await WebhookEvent.distinct('eventType', { projectId });
    res.status(200).json(types);
  } catch (error) {
    console.error('Error fetching event types:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'We couldn\'t load your event types at this time. Please try again.', requestId: req ? req.requestId : 'unknown' } });
  }
};

const replayEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    // 1. Fetch event
    const event = await WebhookEvent.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Fetch project and authorize via workspace
    const project = await Project.findById(event.projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project associated with event not found', requestId: req ? req.requestId : 'unknown' } });
    }

    if (req.user.apiKeyWorkspaceId && req.user.apiKeyWorkspaceId !== project.workspaceId.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'API key is not authorized for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access this event', requestId: req ? req.requestId : 'unknown' } });
    }

    // 3. Verify terminal state
    const terminalStates = ['processed', 'failed', 'retry_exhausted'];
    if (!terminalStates.includes(event.status)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Cannot replay event in non-terminal state: ${event.status}`, requestId: req ? req.requestId : 'unknown' } });
    }

    // 4. Fetch endpoint and check availability
    const endpoint = await WebhookEndpoint.findById(event.endpointId);
    if (!endpoint || !endpoint.destinationUrl) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot replay: Endpoint is unavailable or deleted', requestId: req ? req.requestId : 'unknown' } });
    }

    // 5. Queue the replay job
    const queue = getWebhookQueue();
    await queue.add('process-webhook', {
      eventId: event.eventId,
      projectId: String(event.projectId),
      endpointId: String(event.endpointId),
      isManualReplay: true,
      processingTimeMs: 0
    }, {
      attempts: 1 // ensure BullMQ doesn't retry this manual job
    });

    res.status(202).json({
      success: true,
      message: 'Replay successfully queued'
    });
  } catch (error) {
    console.error('Error replaying event:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'We couldn\'t queue your replay at this time. Please try again.', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  ingestWebhook,
  getEventsByProject,
  getEventById,
  getProjectEventTypes,
  replayEvent
};
