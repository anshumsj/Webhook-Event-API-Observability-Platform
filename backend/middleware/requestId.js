const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
  // Support distributed tracing by checking for incoming X-Request-ID header
  const requestId = 
    req.headers['x-request-id'] || 
    `req_${crypto.randomBytes(4).toString('hex')}`;
    
  req.requestId = requestId;
  next();
};

module.exports = requestIdMiddleware;
