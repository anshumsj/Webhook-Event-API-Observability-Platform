const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');
const rateLimit = require('express-rate-limit');

// Replay limiter: 50 requests per 15 minutes per user + IP
const replayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: (req, res) => {
    // Combine IP and user ID for the rate limit key safely using ipKeyGenerator
    const ip = rateLimit.ipKeyGenerator(req, res);
    const userId = req.user && req.user.id ? req.user.id : 'unknown';
    return `${ip}-${userId}`;
  },
  message: { message: 'Too many replay attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/project/:projectId', protect, validateObjectId('projectId'), webhookController.getEventsByProject);
router.get('/project/:projectId/types', protect, validateObjectId('projectId'), webhookController.getProjectEventTypes);
router.get('/:eventId', protect, webhookController.getEventById);
router.post('/:eventId/replay', protect, replayLimiter, webhookController.replayEvent);

module.exports = router;
