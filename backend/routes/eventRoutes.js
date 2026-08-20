const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { protect } = require('../middleware/authMiddleware');

router.get('/project/:projectId', protect, webhookController.getEventsByProject);
router.get('/:eventId', protect, webhookController.getEventById);

module.exports = router;
