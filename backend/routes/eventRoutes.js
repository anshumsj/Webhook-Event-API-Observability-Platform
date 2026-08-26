const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { protect } = require('../middleware/authMiddleware');

router.get('/project/:projectId', protect, webhookController.getEventsByProject);
router.get('/project/:projectId/types', protect, webhookController.getProjectEventTypes);
router.get('/:eventId', protect, webhookController.getEventById);
router.post('/:eventId/replay', protect, webhookController.replayEvent);

module.exports = router;
