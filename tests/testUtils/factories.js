const { User } = require('../../src/models/User');
const jwt = require('jsonwebtoken');

// Creates a user directly in the DB and returns it plus a ready-to-use
// access token, without going through the HTTP /auth/login flow — keeps
// tests focused on the thing they're actually testing.
const createUserWithToken = async ({ role = 'viewer', email, password = 'Password123' } = {}) => {
    const user = await User.create({
        name: 'Test User',
        email: email || `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
        password,
        role,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    });

    return { user, token };
};

module.exports = { createUserWithToken };
