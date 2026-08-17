const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, projectController.createProject);
router.get('/:workspaceId', protect, projectController.getProjectsByWorkspace);

module.exports = router;
