const express = require('express');
const router = express.Router();
const endpointController = require('../controllers/endpointController');
const { protect } = require('../middleware/authMiddleware');

router.get('/project/:projectId', protect, endpointController.getEndpointsByProject);
router.post('/project/:projectId', protect, endpointController.createEndpoint);

module.exports = router;
