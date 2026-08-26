const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const analyticsService = require('../services/analyticsService');

const getProjectAnalytics = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { timeRange } = req.query;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access analytics for this project', requestId: req ? req.requestId : 'unknown' } });
    }

    // 3. Fetch analytics
    const analytics = await analyticsService.getProjectAnalytics(projectId, timeRange);

    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving analytics', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getEndpointHealth = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { timeRange } = req.query;

    // 1. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: project.workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access endpoint health for this project', requestId: req ? req.requestId : 'unknown' } });
    }

    // 3. Fetch endpoint health
    const healthData = await analyticsService.getEndpointHealth(projectId, timeRange);

    res.status(200).json(healthData);
  } catch (error) {
    console.error('Error fetching endpoint health:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving endpoint health', requestId: req ? req.requestId : 'unknown' } });
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
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access analytics for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Fetch analytics
    const analytics = await analyticsService.getWorkspaceAnalytics(workspaceId, timeRange);

    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching workspace analytics:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving workspace analytics', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getWorkspaceEndpointHealth = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { timeRange } = req.query;

    // 1. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access endpoint health for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Fetch endpoint health
    const health = await analyticsService.getWorkspaceEndpointHealth(workspaceId, timeRange);

    res.status(200).json(health);
  } catch (error) {
    console.error('Error fetching workspace endpoint health:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving workspace endpoint health', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getWorkspaceDeliveryTrends = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { timeRange } = req.query;

    // 1. Authorize via workspace
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: req.user.id }, { members: req.user.id }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to access trends for this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    // 2. Fetch trends
    const trends = await analyticsService.getWorkspaceDeliveryTrends(workspaceId, timeRange);

    res.status(200).json(trends);
  } catch (error) {
    console.error('Error fetching workspace delivery trends:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving workspace delivery trends', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  getProjectAnalytics,
  getEndpointHealth,
  getWorkspaceAnalytics,
  getWorkspaceEndpointHealth,
  getWorkspaceDeliveryTrends
};
