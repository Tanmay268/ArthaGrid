const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${paramName} format: '${id}'`);
    }
    next();
  };
};

module.exports = validateObjectId;
