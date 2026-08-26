const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ApiKey = require('../models/ApiKey');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    
    // API Key Authentication
    if (token.startsWith('hk_test_')) {
      try {
        const keyPrefix = token.substring(0, 16);
        const apiKeys = await ApiKey.find({ keyPrefix, revokedAt: null });

        if (apiKeys.length === 0) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API Key', requestId: req ? req.requestId : 'unknown' } });
        }

        let validKey = null;
        for (const keyDoc of apiKeys) {
          const isMatch = await bcrypt.compare(token, keyDoc.hash);
          if (isMatch) {
            validKey = keyDoc;
            break;
          }
        }

        if (!validKey) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API Key', requestId: req ? req.requestId : 'unknown' } });
        }

        // Update lastUsedAt in the background
        ApiKey.updateOne({ _id: validKey._id }, { lastUsedAt: new Date() }).catch(console.error);

        // Mock a user object so existing controllers work seamlessly
        req.user = { id: validKey.userId };
        return next();
      } catch (error) {
        console.error('API Key middleware error:', error);
        return res.status(401).json({ message: 'Not authorized, API key failed' });
      }
    }

    // JWT Authentication
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;
      return next();
    } catch (error) {
      console.error('JWT middleware error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
