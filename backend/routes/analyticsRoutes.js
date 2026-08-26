const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

router.get('/project/:projectId', protect, validateObjectId('projectId'), analyticsController.getProjectAnalytics);
router.get('/project/:projectId/endpoints', protect, validateObjectId('projectId'), analyticsController.getEndpointHealth);
router.get('/workspace/:workspaceId', protect, validateObjectId('workspaceId'), analyticsController.getWorkspaceAnalytics);
router.get('/workspace/:workspaceId/endpoints', protect, validateObjectId('workspaceId'), analyticsController.getWorkspaceEndpointHealth);
router.get('/workspace/:workspaceId/trends', protect, validateObjectId('workspaceId'), analyticsController.getWorkspaceDeliveryTrends);

module.exports = router;

