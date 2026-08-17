const Workspace = require('../models/Workspace');

const createWorkspace = async (workspaceData) => {
  const workspace = new Workspace(workspaceData);
  return await workspace.save();
};

const getWorkspacesByUserId = async (userId) => {
  return await Workspace.find({
    $or: [{ owner: userId }, { members: userId }]
  }).populate('owner', 'name email').populate('members', 'name email');
};

module.exports = {
  createWorkspace,
  getWorkspacesByUserId
};
