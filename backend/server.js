require('dotenv').config();
const express = require('express');

const app = express();
const port = process.env.PORT || 3001;

// Basic middleware
app.use(express.json()); // Parses incoming requests with JSON payloads

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running'
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
