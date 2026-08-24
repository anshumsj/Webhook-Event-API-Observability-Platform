require('dotenv').config();
const express = require('express');
const http = require('http');
const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initSocket } = require('./socket');
const { startWorker } = require('./queue/webhookWorker');
const requestIdMiddleware = require('./middleware/requestId');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Connect to Redis
connectRedis();

// Basic middleware
const cors = require('cors');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any localhost port (handles Vite port changes like 5173, 5174, etc.)
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '500kb' })); // Parses incoming requests with JSON payloads and 500kb limit
app.use((err, req, res, next) => {
  // Catch malformed JSON requests gracefully
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error(`[${req.requestId || 'sys'}] Malformed JSON request: ${err.message}`);
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  // Catch oversized JSON requests
  if (err.type === 'entity.too.large' && err.status === 413) {
    return res.status(413).json({ success: false, message: 'Payload too large' });
  }
  next(err);
});
app.use(requestIdMiddleware); // Attach req.requestId to all requests

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/endpoints', require('./routes/endpointRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running'
  });
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

server.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
