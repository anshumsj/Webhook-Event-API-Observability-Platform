const { Queue } = require('bullmq');
const { getRedis } = require('../config/redis');

const QUEUE_NAME = 'webhook-processing';
const RETRY_ATTEMPTS = 5;

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
        attempts: RETRY_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 2000,                 // 2s, 4s, 8s, 16s
        },
        removeOnComplete: { count: 500 },
        removeOnFail:     { count: 100 },
      },
    });

    webhookQueue.on('error', (err) => {
      console.error('[Queue] webhookQueue error:', err.message);
    });
  }
  return webhookQueue;
};

module.exports = { getWebhookQueue, QUEUE_NAME, RETRY_ATTEMPTS };
