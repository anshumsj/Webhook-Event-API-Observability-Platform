const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, workspaceController.createWorkspace);
router.get('/', protect, workspaceController.getWorkspaces);

module.exports = router;
