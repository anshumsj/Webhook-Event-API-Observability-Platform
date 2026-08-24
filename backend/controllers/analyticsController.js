const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const analyticsService = require('../services/analyticsService');

const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to access analytics for this project' });
    }

    // 3. Fetch analytics
    const analytics = await analyticsService.getProjectAnalytics(projectId);

    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ message: 'Server error retrieving analytics' });
  }
};

const getEndpointHealth = async (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to access endpoint health for this project' });
    }

    // 3. Fetch endpoint health
    const healthData = await analyticsService.getEndpointHealth(projectId);

    res.status(200).json(healthData);
  } catch (error) {
    console.error('Error fetching endpoint health:', error);
    res.status(500).json({ message: 'Server error retrieving endpoint health' });
  }
};

const getWorkspaceAnalytics = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { timeRange } = req.query;

    // 1. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to access analytics for this workspace' });
    }

    // 2. Fetch analytics
    const analytics = await analyticsService.getWorkspaceAnalytics(workspaceId, timeRange);

    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching workspace analytics:', error);
    res.status(500).json({ message: 'Server error retrieving workspace analytics' });
  }
};

module.exports = {
  getProjectAnalytics,
  getEndpointHealth,
  getWorkspaceAnalytics
};
