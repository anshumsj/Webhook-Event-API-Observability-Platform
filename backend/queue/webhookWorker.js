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
  // This is where future logic lives: forwarding, filtering, alerting, etc.
  // Currently a stub — the processing time is the measured round-trip.
  const totalMs = ingestMs + (Date.now() - workerStart);

  // ── Step 3: Mark as 'processed' ─────────────────────────────────────────────
  const processedDoc = await WebhookEvent.findOneAndUpdate(
    { eventId },
    { status: 'processed', processedAt: new Date(), processingTimeMs: totalMs },
    { new: true }
  );

  console.log(`[Worker] ✓  Processed | eventId: ${eventId} | ${totalMs}ms`);

  if (typeof emitFn === 'function') {
    emitFn(`project:${projectId}`, 'webhook:event:updated', buildSocketPayload(processedDoc));
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

  // Fires on every failed attempt. Only update to 'failed' when all retries exhausted.
  worker.on('failed', async (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    console.error(`[Worker] ❌ Job ${job?.id} attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${err.message}`);

    if (job && attempt >= RETRY_ATTEMPTS) {
      console.error(`[Worker] 💀 All retries exhausted for eventId: ${job.data.eventId}`);
      try {
        const failedDoc = await WebhookEvent.findOneAndUpdate(
          { eventId: job.data.eventId },
          { status: 'failed', processedAt: new Date() },
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
