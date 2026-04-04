const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');
const { log, AUDIT_ACTIONS } = require('../utils/auditLogger');

const getAllUsers = async ({ page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;

  const [total, users] = await Promise.all([
    User.countDocuments(),
    User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const updateUserStatus = async (id, isActive, performedBy, req) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user._id.toString() === performedBy.toString()) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  user.isActive = isActive;
  await user.save();

  log({
    action:         isActive ? AUDIT_ACTIONS.USER_ACTIVATE : AUDIT_ACTIONS.USER_DEACTIVATE,
    performedBy,
    targetResource: 'User',
    targetId:       user._id,
    changes:        { before: { isActive: !isActive }, after: { isActive } },
    req,
  });

  return user;
};

const updateUserRole = async (id, role, performedBy, req) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user._id.toString() === performedBy.toString()) {
    throw ApiError.badRequest('You cannot change your own role');
  }

  const previousRole = user.role;
  user.role = role;
  await user.save();

  log({
    action:         AUDIT_ACTIONS.USER_ROLE_CHANGE,
    performedBy,
    targetResource: 'User',
    targetId:       user._id,
    changes:        { before: { role: previousRole }, after: { role } },
    req,
  });

  return user;
};

module.exports = { getAllUsers, getUserById, updateUserStatus, updateUserRole };
