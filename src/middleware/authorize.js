const ApiError = require('../utils/ApiError');

<<<<<<< HEAD
const PERMISSIONS = {
    viewer: [
        'read:transactions',
        'read:dashboard',
        'read:budgets',
        'read:users:self',
        'write:users:self',
    ],
    analyst: [
        'read:transactions',
        'read:dashboard',
        'read:analytics',
        'read:budgets',
        'read:users:self',
        'write:users:self',
    ],
    admin: [
        'read:transactions',
        'write:transactions',
        'delete:transactions',
        'read:dashboard',
        'read:analytics',
        'read:budgets',
        'write:budgets',
        'read:admin',
        'read:users',
        'write:users',
        'delete:users',
        'read:users:self',
        'write:users:self',
    ],
};

const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        const userPermissions = PERMISSIONS[req.user.role] || [];

        const hasAll = requiredPermissions.every(p =>
            userPermissions.includes(p)
        );

        if (!hasAll) {
            return next(
                ApiError.forbidden(
                    `Your role (${req.user.role}) does not have permission to perform this action`
                )
            );
        }

        next();
    };
=======
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
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
};

module.exports = { authorize, PERMISSIONS };
