const jwt = require('jsonwebtoken');
<<<<<<< HEAD
const  { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('+isActive');
    if(!user) throw ApiError.unauthorized('User no longer exist');
    if(!user.isActive) throw ApiError.forbidden('Account has beed deactivated');

    req.user = user;  //Attach to request for downstream use
    next();
=======
const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);
  if (!user)          throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Account has been deactivated');

  req.user = user;
  next();
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
};

module.exports = authenticate;
