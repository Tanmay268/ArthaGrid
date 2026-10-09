const jwt = require('jsonwebtoken');
const  { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// POST endpoints that only read: the copilot answers questions, it never writes.
const READ_ONLY_POSTS = new Set(['/api/v1/copilot/ask']);

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

    // Public demo accounts can look at everything but change nothing.
    if (user.isDemo && !SAFE_METHODS.has(req.method) && !READ_ONLY_POSTS.has(req.originalUrl.split('?')[0])) {
        throw ApiError.forbidden('This action is not allowed for demo accounts');
    }

    req.user = user;  //Attach to request for downstream use
    next();
};

module.exports = authenticate;
