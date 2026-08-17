const authService = require('../services/authService');

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
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
      return res.status(400).json({ message: error.message });
    }
    
    console.error('Registration error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
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
      return res.status(401).json({ message: error.message });
    }
    
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server Error' });
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
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  register,
  login,
  getMe
};
