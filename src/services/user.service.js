const { User } = require('../models/User');
const ApiError = require('../utils/ApiError');

const sanitize = (user) => {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.password;
    return obj;
};

const getUsers = async ({ page = 1, limit = 20, role, isActive } = {}) => {
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive;

    const skip = (page - 1) * limit;

    const [total, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
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

// Uses findById + save() (not findByIdAndUpdate) so a password change goes
// through the model's pre('save') hashing hook — findByIdAndUpdate would
// silently skip it and store the password in plain text.
const updateSelf = async (id, data) => {
    const user = await User.findById(id);
    if (!user) throw ApiError.notFound('User not found');

    if (data.name) user.name = data.name;
    if (data.password) user.password = data.password;
    if (data.weeklyReport !== undefined) user.preferences.weeklyReport = data.weeklyReport;

    await user.save();
    return sanitize(user);
};

const updateUserByAdmin = async (id, data) => {
    const user = await User.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true });
    if (!user) throw ApiError.notFound('User not found');
    return user;
};

const deactivateUser = async (id, actingUserId) => {
    if (id === actingUserId.toString()) {
        throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const user = await User.findByIdAndUpdate(id, { isActive: false }, { returnDocument: 'after' });
    if (!user) throw ApiError.notFound('User not found');
    return { message: 'User deactivated successfully' };
};

module.exports = { getUsers, getUserById, updateSelf, updateUserByAdmin, deactivateUser };
