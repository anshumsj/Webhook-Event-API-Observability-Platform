const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/auth/api-keys
// @desc    Generate a new API key
// @access  Private (JWT only)
router.post('/', protect, apiKeyController.generateApiKey);

// @route   GET /api/auth/api-keys
// @desc    List all active API keys for the user
// @access  Private (JWT only)
router.get('/', protect, apiKeyController.listApiKeys);

// @route   DELETE /api/auth/api-keys/:id
// @desc    Revoke an API key
// @access  Private (JWT only)
router.delete('/:id', protect, apiKeyController.revokeApiKey);

module.exports = router;
