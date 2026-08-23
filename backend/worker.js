/**
 * Standalone Worker Process
 * ─────────────────────────
 * Run with:  npm run worker
 *
 * This process:
 *   1. Connects to MongoDB (to read/update WebhookEvent documents)
 *   2. Connects to Redis  (to pull jobs from the BullMQ queue)
 *   3. Starts the BullMQ Worker (no Socket.IO — standalone mode)
 *   4. Handles SIGTERM / SIGINT for graceful shutdown
 *
 * Architecture:
 *
 *   Webhook → API Server → MongoDB ──────┐
 *                       → Redis Queue ───┤
 *                                        ▼
 *                               [this worker process]
 *                                        │
 *                               identify + process job
 *                                        │
 *                               update MongoDB status
 *                                        │
 *                               log + complete job
 */

require('dotenv').config();

const connectDB  = require('./config/database');
const { connectRedis } = require('./config/redis');
const { startWorker, shutdownWorker } = require('./queue/webhookWorker');

// ─── Bootstrap ───────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════');
console.log('  HookSight — Standalone Worker Process');
console.log('═══════════════════════════════════════════');

// 1. Connect to MongoDB
connectDB();

// 2. Connect to Redis
connectRedis();

// 3. Start the BullMQ worker in standalone mode (no emitFn → socket skipped)
startWorker(null);

console.log('[Worker] Ready. Waiting for jobs...\n');

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  console.log(`\n[Worker] Received ${signal}. Starting graceful shutdown...`);
  try {
    await shutdownWorker();
    console.log('[Worker] All done. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('[Worker] Error during shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught exception:', err.message);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Worker] Unhandled promise rejection:', reason);
  shutdown('unhandledRejection');
});
