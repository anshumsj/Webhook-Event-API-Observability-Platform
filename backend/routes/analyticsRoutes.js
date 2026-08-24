const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/project/:projectId', protect, analyticsController.getProjectAnalytics);
router.get('/project/:projectId/endpoints', protect, analyticsController.getEndpointHealth);
router.get('/workspace/:workspaceId', protect, analyticsController.getWorkspaceAnalytics);
router.get('/workspace/:workspaceId/endpoints', protect, analyticsController.getWorkspaceEndpointHealth);

module.exports = router;
