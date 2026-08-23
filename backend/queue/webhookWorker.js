const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { QUEUE_NAME } = require('./webhookQueue');
const WebhookEvent = require('../models/WebhookEvent');

/**
 * Builds the BullMQ job processor function.
 *
 * @param {Function|null} emitFn
 *   Optional callback: (room, event, payload) => void
 *   When running inside the server process, the caller passes socket.io's emit.
 *   When running as a standalone process, pass null — socket emission is skipped.
 *
 * Job data shape:
 *   { eventId, projectId, receivedAt, processingTimeMs }
 */
const buildProcessor = (emitFn) => async (job) => {
  const { eventId, projectId, processingTimeMs } = job.data;

  console.log(`[Worker] ▶ Job ${job.id} | eventId: ${eventId} | attempt: ${job.attemptsMade + 1}`);

  // 1. Identify the event in MongoDB
  const updatedEvent = await WebhookEvent.findOneAndUpdate(
    { eventId },
    {
      status:           'processed',
      processedAt:      new Date(),
      processingTimeMs,
    },
    { new: true }
  );

  if (!updatedEvent) {
    // Event was deleted between ingestion and processing — not a retryable error.
    console.warn(`[Worker] ⚠ Event not found in DB, skipping: ${eventId}`);
    return;
  }

  // 2. Log processing
  console.log(`[Worker] ✓ MongoDB updated | eventId: ${eventId} | status: processed | ${processingTimeMs}ms`);

  // 3. Emit real-time update if an emit function was provided (server mode)
  if (typeof emitFn === 'function') {
    try {
      const payload = {
        _id:             String(updatedEvent._id),
        eventId:         updatedEvent.eventId,
        projectId:       String(updatedEvent.projectId),
        eventType:       updatedEvent.eventType,
        status:          'processed',
        receivedAt:      updatedEvent.receivedAt instanceof Date
                           ? updatedEvent.receivedAt.toISOString()
                           : updatedEvent.receivedAt,
        processingTimeMs: updatedEvent.processingTimeMs,
      };
      emitFn(`project:${projectId}`, 'webhook:event:updated', payload);
      console.log(`[Worker] ⚡ Socket emitted webhook:event:updated | projectId: ${projectId}`);
    } catch (socketError) {
      // Socket failure must never cause a job retry
      console.error(`[Worker] Socket emit failed for ${eventId}:`, socketError.message);
    }
  } else {
    console.log(`[Worker]    Socket emit skipped (standalone mode)`);
  }
};

let worker = null;

/**
 * Starts the BullMQ Worker.
 *
 * @param {Function|null} emitFn  Optional socket emit function (see buildProcessor above).
 */
const startWorker = (emitFn = null) => {
  worker = new Worker(QUEUE_NAME, buildProcessor(emitFn), {
    connection: getRedis(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(`[Worker] Started — listening on queue "${QUEUE_NAME}" | concurrency: 5`);
  return worker;
};

/**
 * Gracefully shuts down the active worker.
 * Waits for in-progress jobs to complete before exiting.
 */
const shutdownWorker = async () => {
  if (worker) {
    console.log('[Worker] Shutting down gracefully...');
    await worker.close();
    console.log('[Worker] Shutdown complete.');
  }
};

module.exports = { startWorker, shutdownWorker };
