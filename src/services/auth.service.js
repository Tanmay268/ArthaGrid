const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');
const { log, AUDIT_ACTIONS } = require('../utils/auditLogger');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const register = async ({ name, email, password, role }, req) => {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('Email already registered');

  const user  = await User.create({ name, email, password, role });
  const token = generateToken(user._id);

  log({
    action:         AUDIT_ACTIONS.USER_REGISTER,
    performedBy:    user._id,
    targetResource: 'User',
    targetId:       user._id,
    req,
  });

  return {
    user:  { id: user._id, name: user.name, email: user.email, role: user.role },
    token,
  };
};

const login = async ({ email, password }, req) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    log({
      action:  AUDIT_ACTIONS.USER_LOGIN_FAIL,
      status:  'failure',
      reason:  'Invalid credentials',
      req,
    });
    throw ApiError.unauthorized('Invalid credentials');
  }

  if (!user.isActive) throw ApiError.forbidden('Account has been deactivated');

  const token = generateToken(user._id);

  log({
    action:         AUDIT_ACTIONS.USER_LOGIN,
    performedBy:    user._id,
    targetResource: 'User',
    targetId:       user._id,
    req,
  });

  return {
    user:  { id: user._id, name: user.name, email: user.email, role: user.role },
    token,
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

module.exports = { register, login, getMe };
