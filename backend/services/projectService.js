const Project = require('../models/Project');
const WebhookEndpoint = require('../models/WebhookEndpoint');

const createProject = async (projectData) => {
  const project = new Project(projectData);
  const savedProject = await project.save();
  
  // Automatically generate an endpoint for this new project
  const endpoint = new WebhookEndpoint({
    projectId: savedProject._id
  });
  await endpoint.save();
  
  return savedProject;
};

const getProjectsByWorkspaceId = async (workspaceId) => {
  return await Project.find({ workspaceId }).populate('createdBy', 'name email');
};

module.exports = {
  createProject,
  getProjectsByWorkspaceId
};
