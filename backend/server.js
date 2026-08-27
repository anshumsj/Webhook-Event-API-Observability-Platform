require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.');
  process.exit(1);
}

const express = require('express');
const http = require('http');
const { connectDB, disconnectDB } = require('./config/database');
const { connectRedis, getRedis, disconnectRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const { startWorker, shutdownWorker } = require('./queue/webhookWorker');
const { getWebhookQueue } = require('./queue/webhookQueue');
const mongoose = require('mongoose');
const requestIdMiddleware = require('./middleware/requestId');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Connect to Redis
connectRedis();

// Request logging middleware
app.use((req, res, next) => {
  if (req.path === '/api/health') return next(); // Skip noisy health checks
  
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} | ${duration}ms`);
  });
  next();
});

// Basic middleware
const helmet = require('helmet');
const cors = require('cors');

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // 1. In development, allow localhost (handles Vite dev ports)
    if (process.env.NODE_ENV !== 'production') {
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }

    // 2. In all environments, check explicitly allowed origins
    if (process.env.ALLOWED_ORIGINS) {
      const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    }

    // If none matched, deny
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '500kb' })); // Parses incoming requests with JSON payloads and 500kb limit
app.use((err, req, res, next) => {
  // Catch malformed JSON requests gracefully
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error(`[${req.requestId || 'sys'}] Malformed JSON request: ${err.message}`);
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload', requestId: req ? req.requestId : 'unknown' } });
  }
  // Catch oversized JSON requests
  if (err.type === 'entity.too.large' && err.status === 413) {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large', requestId: req ? req.requestId : 'unknown' } });
  }
  next(err);
});
app.use(requestIdMiddleware); // Attach req.requestId to all requests

// Routes
app.use('/api/auth/api-keys', require('./routes/apiKeyRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/endpoints', require('./routes/endpointRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'ready' : 'unavailable';
    const redisClient = getRedis();
    const redisStatus = redisClient.status === 'ready' ? 'ready' : 'unavailable';
    
    let queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    try {
      const queue = getWebhookQueue();
      queueCounts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    } catch (qErr) {
      // queue may not be reachable if redis is down
      console.warn('[Health] Failed to get queue counts:', qErr.message);
    }

    const overallStatus = (dbStatus === 'ready' && redisStatus === 'ready') ? 'healthy' : 'unhealthy';
    const httpStatus = overallStatus === 'healthy' ? 200 : 503;

    res.status(httpStatus).json({
      status: overallStatus,
      dependencies: {
        mongodb: dbStatus,
        redis: redisStatus,
        queue: queueCounts
      }
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Internal health check failure' });
  }
});

// Initialize Socket.IO — must come before startWorker so getIO() is available
initSocket(server);

// Start BullMQ worker — pass socket emit so the worker can push real-time updates.
// The worker uses this to emit 'webhook:event:updated' when a job is processed.
const { getIO } = require('./socket');
startWorker((room, event, payload) => {
  try {
    getIO().to(room).emit(event, payload);
  } catch (e) {
    console.error('[Server] Worker socket emit failed:', e.message);
  }
});

let isShuttingDown = false;

const gracefulShutdown = async (signal, err = null) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  if (err) {
    console.error(`[Process] Fatal error: ${err.message}`);
  }
  
  console.log(`\n[Process] Received ${signal || 'Fatal Error'}. Starting graceful shutdown...`);

  // 1. Stop accepting new HTTP requests
  server.close(async () => {
    console.log('[Process] HTTP server closed.');
    try {
      // 2. Shut down BullMQ worker safely
      await shutdownWorker();
      
      // 3. Close Redis
      await disconnectRedis();
      
      // 4. Close MongoDB
      await disconnectDB();
      
      console.log('[Process] Graceful shutdown complete.');
      process.exit(err ? 1 : 0);
    } catch (shutdownErr) {
      console.error('[Process] Error during shutdown:', shutdownErr.message);
      process.exit(1);
    }
  });

  // Force kill if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Process] Graceful shutdown timed out (10s). Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => gracefulShutdown('uncaughtException', err));
process.on('unhandledRejection', (reason, promise) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  gracefulShutdown('unhandledRejection', err);
});

server.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
// Nodemon trigger
