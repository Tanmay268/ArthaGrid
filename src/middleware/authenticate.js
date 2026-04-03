const jwt = require('jsonwebtoken');
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
};

module.exports = authenticate;
