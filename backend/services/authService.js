const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registerUser = async (userData) => {
  const { name, email, password } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create new user in the database
  const user = await User.create({
    name,
    email,
    passwordHash,
  });

  // Generate JWT token
  const payload = {
    user: {
      id: user._id
    }
  };

  const token = jwt.sign(
    payload, 
    process.env.JWT_SECRET || 'fallback_secret', 
    { expiresIn: '1d' }
  );

  return { user, token };
};

module.exports = {
  registerUser
};
