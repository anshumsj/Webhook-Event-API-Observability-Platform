const workspaceService = require('../services/workspaceService');

const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Workspace name is required', requestId: req ? req.requestId : 'unknown' } });
    }

    const workspaceData = {
      name,
      owner: userId,
      members: [userId]
    };

    const newWorkspace = await workspaceService.createWorkspace(workspaceData);
    res.status(201).json(newWorkspace);
  } catch (error) {
    console.error('Error creating workspace:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error creating workspace', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getWorkspaces = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspaces = await workspaceService.getWorkspacesByUserId(userId);
    res.status(200).json(workspaces);
  } catch (error) {
    console.error('Error getting workspaces:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving workspaces', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  createWorkspace,
  getWorkspaces
};
