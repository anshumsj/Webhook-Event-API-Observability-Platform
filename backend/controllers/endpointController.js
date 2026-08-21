const WebhookEndpoint = require('../models/WebhookEndpoint');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

const getEndpointsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to view endpoints for this project' });
    }

    // 3. Fetch endpoints for the project
    const endpoints = await WebhookEndpoint.find({ projectId });
    
    res.status(200).json(endpoints);
  } catch (error) {
    console.error('Error getting endpoints:', error.message);
    res.status(500).json({ message: 'Server error retrieving endpoints' });
  }
};

const createEndpoint = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to create endpoints for this project' });
    }

    // 3. Generate new endpoint
    const endpoint = new WebhookEndpoint({
      projectId
    });
    
    await endpoint.save();
    
    res.status(201).json(endpoint);
  } catch (error) {
    console.error('Error creating endpoint:', error.message);
    res.status(500).json({ message: 'Server error creating endpoint' });
  }
};

module.exports = {
  getEndpointsByProject,
  createEndpoint
};
