const express = require('express');
const router = express.Router();
const endpointController = require('../controllers/endpointController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

router.get('/project/:projectId', protect, validateObjectId('projectId'), endpointController.getEndpointsByProject);
router.post('/project/:projectId', protect, validateObjectId('projectId'), endpointController.createEndpoint);
router.patch('/:endpointId', protect, endpointController.updateEndpoint);

module.exports = router;

