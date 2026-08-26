const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

router.post('/', protect, projectController.createProject);
router.get('/:workspaceId', protect, validateObjectId('workspaceId'), projectController.getProjectsByWorkspace);

module.exports = router;

