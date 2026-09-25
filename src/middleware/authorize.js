const ApiError = require('../utils/ApiError');

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
};

module.exports = { authorize, PERMISSIONS };
