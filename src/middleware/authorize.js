const ApiError = require('../utils/ApiError');

/**
 * Permission registry — single source of truth for role capabilities.
 * Extend here when adding new roles or permissions.
 */
const PERMISSIONS = {
  viewer: [
    'read:transactions',
    'read:dashboard',
    'read:users:self',
  ],
  analyst: [
    'read:transactions',
    'read:dashboard',
    'read:analytics',
    'read:users:self',
  ],
  admin: [
    'read:transactions',
    'write:transactions',
    'delete:transactions',
    'read:dashboard',
    'read:analytics',
    'read:users',
    'write:users',
    'delete:users',
    'read:users:self',
    'read:audit',
  ],
};

/**
 * Middleware factory: authorize(...permissions)
 * Usage: authorize('write:transactions')
 *        authorize('read:dashboard', 'read:analytics')
 */
const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    const userPermissions = PERMISSIONS[req.user.role] ?? [];
    const hasAll = requiredPermissions.every(p => userPermissions.includes(p));

    if (!hasAll) {
      throw ApiError.forbidden(
        `Your role (${req.user.role}) does not have permission to perform this action`
      );
    }

    next();
  };
};

module.exports = { authorize, PERMISSIONS };
