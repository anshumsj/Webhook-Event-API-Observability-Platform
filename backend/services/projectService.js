const Project = require('../models/Project');

const createProject = async (projectData) => {
  const project = new Project(projectData);
  return await project.save();
};

const getProjectsByWorkspaceId = async (workspaceId) => {
  return await Project.find({ workspaceId }).populate('createdBy', 'name email');
};

module.exports = {
  createProject,
  getProjectsByWorkspaceId
};
