const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { QUEUE_NAME, RETRY_ATTEMPTS } = require('./webhookQueue');
const WebhookEvent = require('../models/WebhookEvent');

/**
 * Builds a safe socket payload from a Mongoose document.
 * Always returns a plain, serializable object.
 */
const buildSocketPayload = (doc) => ({
  _id:             String(doc._id),
  eventId:         doc.eventId,
  projectId:       String(doc.projectId),
  eventType:       doc.eventType,
  status:          doc.status,
  receivedAt:      doc.receivedAt instanceof Date
                     ? doc.receivedAt.toISOString()
                     : doc.receivedAt,
  processedAt:     doc.processedAt instanceof Date
                     ? doc.processedAt.toISOString()
                     : (doc.processedAt || null),
  processingTimeMs: doc.processingTimeMs,
});

/**
 * Builds the BullMQ job processor.
 *
 * Lifecycle emitted:
 *   job start → status: 'processing'  → webhook:event:updated
 *   job end   → status: 'processed'   → webhook:event:updated
 *
 * Failure (after all retries) is handled in the 'failed' event listener below.
 *
 * @param {Function|null} emitFn  (room, event, payload) => void
 */
const buildProcessor = (emitFn) => async (job) => {
  const { eventId, projectId, processingTimeMs: ingestMs } = job.data;
  const workerStart = Date.now();

  console.log(`[Worker] ▶ Job ${job.id} | eventId: ${eventId} | attempt: ${job.attemptsMade + 1}/${RETRY_ATTEMPTS}`);

  // ── Step 1: Mark as 'processing' ────────────────────────────────────────────
  const processingDoc = await WebhookEvent.findOneAndUpdate(
    { eventId },
    { status: 'processing' },
    { new: true }
  );

  if (!processingDoc) {
    console.warn(`[Worker] ⚠  Event not found, skipping: ${eventId}`);
    return;
  }

  console.log(`[Worker] ⚙  Processing | eventId: ${eventId}`);

  if (typeof emitFn === 'function') {
    emitFn(`project:${projectId}`, 'webhook:event:updated', buildSocketPayload(processingDoc));
  }

  // ── Step 2: Do actual processing work ───────────────────────────────────────
  // 1. Fetch the endpoint to get the destinationUrl
  const WebhookEndpoint = require('../models/WebhookEndpoint');
  const DeliveryAttempt = require('../models/DeliveryAttempt');
  const endpoint = await WebhookEndpoint.findById(job.data.endpointId);

  let statusToSet = 'processed';

  if (!endpoint || !endpoint.destinationUrl) {
    console.warn(`[Worker] ⚠ Skipped delivery: No destination URL configured for endpointId: ${job.data.endpointId}`);
    // Do not claim successful delivery if there is no destination URL.
    statusToSet = 'failed';
  } else {
    // 2. Deliver the webhook
    const attemptNumber = job.attemptsMade + 1;
    const attemptStart = Date.now();
    
    let attemptDoc = await DeliveryAttempt.create({
      webhookEventId: processingDoc._id,
      endpointId: endpoint._id,
      attemptNumber,
      status: 'pending',
      startedAt: new Date(attemptStart),
      destinationUrl: endpoint.destinationUrl,
      requestMethod: 'POST'
    });

    const { deliverWebhook } = require('../services/deliveryService');
    try {
      const result = await deliverWebhook(processingDoc, endpoint.destinationUrl, endpoint.secret);
      
      // Success (2xx)
      await DeliveryAttempt.findByIdAndUpdate(attemptDoc._id, {
        status: 'success',
        responseStatusCode: result.status,
        latencyMs: Date.now() - attemptStart,
        completedAt: new Date(),
        requestHeaders: result.requestHeaders,
        responseHeaders: result.responseHeaders
      });
      statusToSet = 'processed';
    } catch (error) {
      // Failure (non-2xx, network, timeout)
      const isTimeout = error.message.includes('timed out');
      await DeliveryAttempt.findByIdAndUpdate(attemptDoc._id, {
        status: isTimeout ? 'timeout' : 'failed',
        responseStatusCode: error.responseStatusCode,
        responseBody: error.responseBody,
        errorMessage: error.message,
        latencyMs: Date.now() - attemptStart,
        completedAt: new Date(),
        requestHeaders: error.requestHeaders,
        responseHeaders: error.responseHeaders
      });
      
      // Rethrow so BullMQ retries
      throw error;
    }
  }

  const totalMs = ingestMs + (Date.now() - workerStart);

  // ── Step 3: Mark as 'processed' (or 'failed' if skipped) ──────────────────
  const finalDoc = await WebhookEvent.findOneAndUpdate(
    { eventId },
    { status: statusToSet, processedAt: new Date(), processingTimeMs: totalMs },
    { new: true }
  );

  console.log(`[Worker] ${statusToSet === 'processed' ? '✓ Processed' : '❌ Failed (No Destination)'} | eventId: ${eventId} | ${totalMs}ms`);

  if (typeof emitFn === 'function') {
    emitFn(`project:${projectId}`, 'webhook:event:updated', buildSocketPayload(finalDoc));
  }
};

let worker = null;

/**
 * Starts the BullMQ Worker.
 * @param {Function|null} emitFn  Optional socket emit. Null in standalone mode.
 */
const startWorker = (emitFn = null) => {
  worker = new Worker(QUEUE_NAME, buildProcessor(emitFn), {
    connection: getRedis(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed.`);
  });

  // Fires on every failed attempt. Only update to 'retry_exhausted' when all retries exhausted.
  worker.on('failed', async (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    console.error(`[Worker] ❌ Job ${job?.id} attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${err.message}`);

    if (job && attempt >= RETRY_ATTEMPTS) {
      console.error(`[Worker] 💀 All retries exhausted for eventId: ${job.data.eventId}`);
      try {
        const failedDoc = await WebhookEvent.findOneAndUpdate(
          { eventId: job.data.eventId },
          { status: 'retry_exhausted', processedAt: new Date() },
          { new: true }
        );
        if (failedDoc && typeof emitFn === 'function') {
          emitFn(
            `project:${job.data.projectId}`,
            'webhook:event:updated',
            buildSocketPayload(failedDoc)
          );
        }
      } catch (dbErr) {
        console.error('[Worker] Failed to write failed status to DB:', dbErr.message);
      }
    }
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(`[Worker] Started — listening on queue "${QUEUE_NAME}" | concurrency: 5`);
  return worker;
};

/**
 * Gracefully shuts down the active worker.
 * Waits for in-progress jobs to finish before exiting.
 */
const shutdownWorker = async () => {
  if (worker) {
    console.log('[Worker] Shutting down gracefully...');
    await worker.close();
    console.log('[Worker] Shutdown complete.');
  }
};

module.exports = { startWorker, shutdownWorker };
