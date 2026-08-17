const projectService = require('../services/projectService');
const Workspace = require('../models/Workspace');

const createProject = async (req, res) => {
  try {
    const { name, workspaceId } = req.body;
    const userId = req.user.id;

    if (!name || !workspaceId) {
      return res.status(400).json({ message: 'Project name and workspace ID are required' });
    }

    // Authorization check: Does the user belong to the workspace?
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      $or: [{ owner: userId }, { members: userId }]
    });

    if (!workspace) {
      return res.status(403).json({ message: 'Not authorized to create a project in this workspace' });
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
    res.status(500).json({ message: 'Server error creating project' });
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
      return res.status(403).json({ message: 'Not authorized to view projects in this workspace' });
    }

    const projects = await projectService.getProjectsByWorkspaceId(workspaceId);
    res.status(200).json(projects);
  } catch (error) {
    console.error('Error getting projects:', error.message);
    res.status(500).json({ message: 'Server error retrieving projects' });
  }
};

module.exports = {
  createProject,
  getProjectsByWorkspace
};
