const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;

  // Check if Authorization header exists and starts with Bearer
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the token from the header (format: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify and decode the token using the secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach the decoded user payload to the request object
      req.user = decoded.user;

      // Pass control to the next middleware or route handler
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
