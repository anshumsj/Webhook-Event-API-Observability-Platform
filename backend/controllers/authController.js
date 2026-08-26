const authService = require('../services/authService');

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Please provide name, email, and password', requestId: req ? req.requestId : 'unknown' } });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Password must be at least 6 characters long', requestId: req ? req.requestId : 'unknown' } });
    }

    // Call service to register user
    const { user, token } = await authService.registerUser({ name, email, password });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.message === 'User already exists') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message, requestId: req ? req.requestId : 'unknown' } });
    }
    
    console.error('Registration error:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server Error', requestId: req ? req.requestId : 'unknown' } });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Please provide email and password', requestId: req ? req.requestId : 'unknown' } });
    }

    // Call service to login user
    const { user, token } = await authService.loginUser(email, password);

    res.status(200).json({
      message: 'User logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: error.message, requestId: req ? req.requestId : 'unknown' } });
    }
    
    console.error('Login error:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server Error', requestId: req ? req.requestId : 'unknown' } });
  }
};

const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    const user = await authService.getUserById(req.user.id);
    
    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error.message);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server Error', requestId: req ? req.requestId : 'unknown' } });
  }
};

module.exports = {
  register,
  login,
  getMe
};
