const userService = require('../services/user.service');
const { isDemoTenant } = require('../config/tenant');
const { demoRestrictionLabels } = require('../config/demoRestrictions');

const getMe = async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    const data = isDemoTenant()
        ? { ...user.toObject(), isDemo: true, demoRestrictions: demoRestrictionLabels() }
        : user;
    res.status(200).json({ success: true, data });
};

const updateMe = async (req, res) => {
    const user = await userService.updateSelf(req.user._id, req.body);
    res.status(200).json({ success: true, data: user });
};

const getAll = async (req, res) => {
    const result = await userService.getUsers(req.query);
    res.status(200).json({ success: true, ...result });
};

const getById = async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json({ success: true, data: user });
};

const updateUser = async (req, res) => {
    const user = await userService.updateUserByAdmin(req.params.id, req.body);
    res.status(200).json({ success: true, data: user });
};

const deactivateUser = async (req, res) => {
    const result = await userService.deactivateUser(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: result });
};

module.exports = { getMe, updateMe, getAll, getById, updateUser, deactivateUser };
