const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/project/:projectId', protect, analyticsController.getProjectAnalytics);
router.get('/project/:projectId/endpoints', protect, analyticsController.getEndpointHealth);

module.exports = router;
