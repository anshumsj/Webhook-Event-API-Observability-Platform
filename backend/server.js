require('dotenv').config();
const express = require('express');
const http = require('http');
const connectDB = require('./config/database');
const { initSocket } = require('./socket');
const requestIdMiddleware = require('./middleware/requestId');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Basic middleware
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173', // Allow frontend origin
  credentials: true
}));
app.use(express.json()); // Parses incoming requests with JSON payloads
app.use(requestIdMiddleware); // Attach req.requestId to all requests

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/endpoints', require('./routes/endpointRoutes'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running'
  });
});

// Initialize Socket.IO
initSocket(server);

server.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
