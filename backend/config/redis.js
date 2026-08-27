const Redis = require('ioredis');

let client = null;

/**
 * Creates and returns a singleton Redis client.
 * Uses REDIS_URL from env (supports Redis Cloud, Upstash, local, etc.)
 * Falls back to localhost:6379 if REDIS_URL is not set.
 */
const connectRedis = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  client = new Redis(redisUrl, {
    // Retry strategy: exponential backoff, max 10s between retries
    retryStrategy(times) {
      const delay = Math.min(times * 200, 10000);
      return delay;
    },
    maxRetriesPerRequest: null, // Let ioredis handle reconnection automatically
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on('connect', () => {
    console.log(`[Redis] Connecting to ${redisUrl.replace(/:\/\/.*@/, '://***@')}...`);
  });

  client.on('ready', () => {
    console.log('[Redis] Connected and ready.');
  });

  client.on('error', (err) => {
    // Log the error but do NOT crash the process — Redis is an enhancement layer,
    // not a hard dependency for basic functionality.
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('close', () => {
    console.warn('[Redis] Connection closed.');
  });

  client.on('reconnecting', (delay) => {
    console.log(`[Redis] Reconnecting in ${delay}ms...`);
  });

  return client;
};

/**
 * Returns the active Redis client instance.
 * Throws if connectRedis() has not been called yet.
 */
const getRedis = () => {
  if (!client) {
    throw new Error('[Redis] Client not initialized. Call connectRedis() first.');
  }
  return client;
};

const disconnectRedis = async () => {
  if (client) {
    console.log('[Redis] Disconnecting...');
    await client.quit();
    client = null;
  }
};

module.exports = { connectRedis, getRedis, disconnectRedis };
