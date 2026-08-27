const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config/redis');

const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const userId = req.user && req.user.id ? req.user.id : 'unknown';
    return `${ip}-${userId}`;
  },
  message: { error: { code: 'RATE_LIMITED', message: 'Too many API keys generated, please try again after an hour' } },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => getRedis().call(...args),
    prefix: 'rl:apikey:'
  }),
});

// @route   POST /api/auth/api-keys
// @desc    Generate a new API key
// @access  Private (JWT only)
router.post('/', protect, apiKeyLimiter, apiKeyController.generateApiKey);

// @route   GET /api/auth/api-keys
// @desc    List all active API keys for the user
// @access  Private (JWT only)
router.get('/', protect, apiKeyController.listApiKeys);

// @route   DELETE /api/auth/api-keys/:id
// @desc    Revoke an API key
// @access  Private (JWT only)
router.delete('/:id', protect, apiKeyController.revokeApiKey);

module.exports = router;
