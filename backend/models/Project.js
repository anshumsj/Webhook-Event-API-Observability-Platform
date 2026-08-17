const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    minlength: [2, 'Project name must be at least 2 characters long'],
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: [true, 'Workspace ID is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by (User ID) is required']
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
