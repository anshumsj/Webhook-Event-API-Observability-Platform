const projectService = require('../services/projectService');
const Workspace = require('../models/Workspace');

const createProject = async (req, res) => {
  try {
    const { name, workspaceId } = req.body;
    const userId = req.user.id;

    if (!name || !workspaceId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Project name and workspace ID are required', requestId: req ? req.requestId : 'unknown' } });
    }

    // Authorization check: Does the user belong to the workspace?
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to create a project in this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    const projectData = {
      name,
      workspaceId,
      createdBy: userId
    };

    const newProject = await projectService.createProject(projectData);
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error creating project', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getProjectsByWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // Authorization check: Does the user belong to the workspace?
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized to view projects in this workspace', requestId: req ? req.requestId : 'unknown' } });
    }

    const projects = await projectService.getProjectsByWorkspaceId(workspaceId);
    res.status(200).json(projects);
  } catch (error) {
    console.error('Error getting projects:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error retrieving projects', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  createProject,
  getProjectsByWorkspace
};
