const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

const generateToken = (userId) => 
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
})

const register = async ({ name, email, password, role }) => {
    const existing = await User.findOne({ email });
    if(existing) throw ApiError.conflict('Email already registered');

    const user = await User.create({ name, email, password, role });
    const token = generateToken(user._id);

    return { 
        user: { id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
        token,
    };
}

const login = async ({ email, password }) => {
    const user = await USer.findOne({ email }).select('+password');
    if(!user) throw ApiError.unauthorized('Invalid credentials');

    const isMatch = await user.comparePassword(password);
    if(!isMatch) throw ApiError.unauthorized('Invalid credentials');

    if(!user.isActive) throw ApiError.forbidden('Account deactivated');

    const token = generateToken(user._id);

    return { 
        user: { id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
        token,
    };
};

module.exports = { register, login };