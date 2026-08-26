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
    const endpoints = await WebhookEndpoint.find({ projectId }).select('-secret');
    
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

    const { destinationUrl } = req.body;

    // 3. Generate new endpoint
    const endpoint = new WebhookEndpoint({
      projectId,
      destinationUrl: destinationUrl || null
    });
    
    await endpoint.save();
    
    res.status(201).json(endpoint);
  } catch (error) {
    console.error('Error creating endpoint:', error.message);
    res.status(500).json({ message: 'Server error creating endpoint' });
  }
};

const updateEndpoint = async (req, res) => {
  try {
    const { endpointId } = req.params;
    const userId = req.user.id;
    const { destinationUrl } = req.body;

    // 1. Find the endpoint
    const endpoint = await WebhookEndpoint.findOne({ endpointId });
    if (!endpoint) {
      return res.status(404).json({ message: 'Webhook endpoint not found' });
    }

    // 2. Find its project
    const project = await Project.findById(endpoint.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Associated project not found' });
    }

    // 3. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to update this endpoint' });
    }

    // 4. Validate URL
    if (destinationUrl) {
      try {
        new URL(destinationUrl);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid destination URL format' });
      }
    }

    // 5. Update and save
    endpoint.destinationUrl = destinationUrl || null;
    await endpoint.save();

    res.status(200).json(endpoint);
  } catch (error) {
    console.error('Error updating endpoint:', error.message);
    res.status(500).json({ message: 'Server error updating endpoint' });
  }
};

module.exports = {
  getEndpointsByProject,
  createEndpoint,
  updateEndpoint
};
