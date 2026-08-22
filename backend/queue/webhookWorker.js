const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { QUEUE_NAME } = require('./webhookQueue');
const WebhookEvent = require('../models/WebhookEvent');

/**
 * The processor function for each job.
 *
 * Job data shape:
 *   { eventId: String, projectId: String, receivedAt: String, processingTimeMs: Number }
 *
 * Responsibilities:
 *   1. Update the event status in MongoDB from 'received' → 'processed'.
 *   2. Emit the real-time Socket.IO notification to the project room.
 *
 * This is the ONLY place that touches event status after ingestion.
 */
const processWebhookJob = async (job) => {
  const { eventId, projectId, receivedAt, processingTimeMs } = job.data;

  console.log(`[Worker] Processing job ${job.id} | eventId: ${eventId}`);

  // 1. Update event status in MongoDB
  const updatedEvent = await WebhookEvent.findOneAndUpdate(
    { eventId },
    {
      status: 'processed',
      processedAt: new Date(),
      processingTimeMs,
    },
    { new: true }
  );

  if (!updatedEvent) {
    // The event was deleted between ingestion and processing — not a failure.
    console.warn(`[Worker] Event not found in DB, skipping: ${eventId}`);
    return;
  }

  // 2. Emit real-time update via Socket.IO so the dashboard reflects 'processed' status
  try {
    const io = require('../socket').getIO();
    const socketPayload = {
      _id:             String(updatedEvent._id),
      eventId:         updatedEvent.eventId,
      projectId:       String(updatedEvent.projectId),
      eventType:       updatedEvent.eventType,
      status:          updatedEvent.status,          // 'processed'
      receivedAt:      updatedEvent.receivedAt instanceof Date
                         ? updatedEvent.receivedAt.toISOString()
                         : updatedEvent.receivedAt,
      processingTimeMs: updatedEvent.processingTimeMs,
    };
    io.to(`project:${projectId}`).emit('webhook:event:updated', socketPayload);
  } catch (socketError) {
    // Socket failure must never cause the job to fail / retry
    console.error(`[Worker] Socket emit failed for ${eventId}:`, socketError.message);
  }

  console.log(`[Worker] Done — eventId: ${eventId} | status: processed | ${processingTimeMs}ms`);
};

let worker = null;

/**
 * Starts the BullMQ Worker.
 * Should be called once, after Redis is ready.
 */
const startWorker = () => {
  worker = new Worker(QUEUE_NAME, processWebhookJob, {
    connection: getRedis(),
    concurrency: 5, // Process up to 5 jobs simultaneously
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(`[Worker] Started — listening on queue "${QUEUE_NAME}"`);
  return worker;
};

module.exports = { startWorker };
