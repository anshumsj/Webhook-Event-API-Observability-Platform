const { Queue } = require('bullmq');
const { getRedis } = require('../config/redis');

const QUEUE_NAME = 'webhook-processing';

let webhookQueue = null;

/**
 * Returns the singleton BullMQ Queue instance.
 * Lazily initialized on first call so that Redis is ready.
 */
const getWebhookQueue = () => {
  if (!webhookQueue) {
    webhookQueue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,                   // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 1000,                 // 1s, 2s, 4s
        },
        removeOnComplete: { count: 500 }, // Keep last 500 completed jobs for inspection
        removeOnFail:     { count: 100 }, // Keep last 100 failed jobs for debugging
      },
    });

    webhookQueue.on('error', (err) => {
      console.error('[Queue] webhookQueue error:', err.message);
    });
  }
  return webhookQueue;
};

module.exports = { getWebhookQueue, QUEUE_NAME };
