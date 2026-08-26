const mongoose = require('mongoose');

const validateObjectId = (paramNames) => {
  return (req, res, next) => {
    const names = Array.isArray(paramNames) ? paramNames : [paramNames];
    
    for (const name of names) {
      const id = req.params[name];
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Invalid ${name} format`, requestId: req ? req.requestId : 'unknown' } });
      }
    }
    
    next();
  };
};

module.exports = validateObjectId;
