const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    trim: true,
    minlength: [2, 'Workspace name must be at least 2 characters long'],
    maxlength: [50, 'Workspace name cannot exceed 50 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Workspace owner is required']
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

const Workspace = mongoose.model('Workspace', workspaceSchema);

module.exports = Workspace;
