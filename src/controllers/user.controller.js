const userService = require('../services/user.service');

<<<<<<< HEAD
const getMe = async (req, res) => {
    const user = await userService.getUserById(req.user._id);
    res.status(200).json({ success: true, data: user });
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
=======
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: List of users with pagination }
 *       403: { description: Forbidden }
 */
const getAllUsers = async (req, res) => {
  const result = await userService.getAllUsers(req.query);
  res.status(200).json({ success: true, ...result });
};

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User object }
 *       404: { description: User not found }
 */
const getUserById = async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json({ success: true, data: user });
};

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     summary: Activate or deactivate a user (admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: User status updated }
 */
const updateStatus = async (req, res) => {
  const user = await userService.updateUserStatus(
    req.params.id, req.body.isActive, req.user._id, req
  );
  res.status(200).json({ success: true, data: user });
};

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Change a user's role (admin only)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [viewer, analyst, admin] }
 *     responses:
 *       200: { description: Role updated }
 */
const updateRole = async (req, res) => {
  const user = await userService.updateUserRole(
    req.params.id, req.body.role, req.user._id, req
  );
  res.status(200).json({ success: true, data: user });
};

module.exports = { getAllUsers, getUserById, updateStatus, updateRole };
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
