const ApiError = require('../utils/ApiError');

//Permission registry - to define what each role can do
const PERMISSIONS = {
    viewer: [
        'read:transactions',
        'read:dashboard',
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
        'delete:transaction',
        'read:dashboard',
        'read:analytics',
        'read:users',
        'write:users',
        'delete:users',
        'read:users:self',
    ],
};

//usage: Authorize('write:transaction')
const authorize = (...requiredPermissions) => {
    return (req, res, next) => {
        const userPermissions = PERMISSIONS[req.user.role] || [];
        const hasAll = requiredPermissions.every(p => userPermissions.includes(p));

        if(!hasAll){
            throw ApiError.forbidden(
                `Your role(${req.user.role}) does not have permission to perform this action`
            );
        }
        next();
    };
};

module.exports = { authorize, PERMISSIONS };