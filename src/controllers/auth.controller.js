const authService = require('../services/auth.service');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:     { type: string, example: Alice Admin }
 *               email:    { type: string, example: alice@example.com }
 *               password: { type: string, example: pass123 }
 *               role:     { type: string, enum: [viewer, analyst, admin], default: viewer }
 *     responses:
 *       201: { description: User registered successfully }
 *       409: { description: Email already registered }
 */
const register = async (req, res) => {
  const result = await authService.register(req.body, req);
  res.status(201).json({ success: true, data: result });
};

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: admin@test.com }
 *               password: { type: string, example: pass123 }
 *     responses:
 *       200: { description: Login successful, returns JWT }
 *       401: { description: Invalid credentials }
 */
const login = async (req, res) => {
  const result = await authService.login(req.body, req);
  res.status(200).json({ success: true, data: result });
};

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user profile }
 *       401: { description: Unauthorized }
 */
const getMe = async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.status(200).json({ success: true, data: user });
};

module.exports = { register, login, getMe };
