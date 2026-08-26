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
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to view endpoints for this project', requestId: req ? req.requestId : 'unknown' } });
    }

    // 3. Fetch endpoints for the project
    const endpoints = await WebhookEndpoint.find({ projectId }).select('-secret');
    
    res.status(200).json(endpoints);
  } catch (error) {
    console.error('Error getting endpoints:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving endpoints', requestId: req ? req.requestId : 'unknown' } });
  }
};

const createEndpoint = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to create endpoints for this project', requestId: req ? req.requestId : 'unknown' } });
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
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error creating endpoint', requestId: req ? req.requestId : 'unknown' } });
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
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Webhook endpoint not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Find its project
    const project = await Project.findById(endpoint.projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Associated project not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 3. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to update this endpoint', requestId: req ? req.requestId : 'unknown' } });
    }

    // 4. Validate URL
    if (destinationUrl) {
      try {
        new URL(destinationUrl);
      } catch (err) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid destination URL format', requestId: req ? req.requestId : 'unknown' } });
      }
    }

    // 5. Update and save
    endpoint.destinationUrl = destinationUrl || null;
    await endpoint.save();

    res.status(200).json(endpoint);
  } catch (error) {
    console.error('Error updating endpoint:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error updating endpoint', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  getEndpointsByProject,
  createEndpoint,
  updateEndpoint
};
