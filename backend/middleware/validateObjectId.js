const mongoose = require('mongoose');

const validateObjectId = (paramNames) => {
  return (req, res, next) => {
    const names = Array.isArray(paramNames) ? paramNames : [paramNames];
    
    for (const name of names) {
      const id = req.params[name];
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid ${name} format` });
      }
    }
    
    next();
  };
};

module.exports = validateObjectId;
