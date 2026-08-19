require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const requestIdMiddleware = require('./middleware/requestId');

const app = express();
const port = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Basic middleware
app.use(express.json()); // Parses incoming requests with JSON payloads
app.use(requestIdMiddleware); // Attach req.requestId to all requests

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running'
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
