const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Project = require('./models/Project');
const Workspace = require('./models/Workspace');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (process.env.NODE_ENV !== 'production') {
          if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
            return callback(null, true);
          }
        }
        if (process.env.ALLOWED_ORIGINS) {
          const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o);
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
        }
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      socket.user = decoded.user;
      next();
    } catch (error) {
      console.error('[Socket.IO] Authentication error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}, User ID: ${socket.user.id}`);

    // Allow clients to explicitly join project rooms they have access to
    socket.on('join_project', async (projectId) => {
      try {
        const project = await Project.findById(projectId);
        if (!project) {
          console.warn(`[Socket.IO] User ${socket.user.id} tried to join invalid project ${projectId}`);
          return socket.emit('error', { message: 'Project not found' });
        }

        const workspace = await Workspace.findOne({
          _id: project.workspaceId,
          $or: [{ owner: socket.user.id }, { members: socket.user.id }]
        });

        if (!workspace) {
          console.warn(`[Socket.IO] User ${socket.user.id} unauthorized for project ${projectId}`);
          return socket.emit('error', { message: 'Unauthorized to join project room' });
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] User ${socket.user.id} joined room: ${roomName}`);
        
      } catch (error) {
        console.error('[Socket.IO] Error joining project room:', error);
        socket.emit('error', { message: 'Server error joining room' });
      }
    });

    socket.on('leave_project', (projectId) => {
      const roomName = `project:${projectId}`;
      socket.leave(roomName);
      console.log(`[Socket.IO] User ${socket.user.id} left room: ${roomName}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
