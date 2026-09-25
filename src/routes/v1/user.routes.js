<<<<<<< HEAD
const router = require('express').Router();
const controller = require('../../controllers/user.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const {
    selfUpdateSchema,
    adminUpdateSchema,
    listUsersQuerySchema,
} = require('../../validators/user.validator');

router.use(authenticate);

// Self-service routes — must be declared before "/:id" so "me" isn't
// swallowed as an id param.
router.get('/me', authorize('read:users:self'), controller.getMe);
router.patch('/me', authorize('write:users:self'), validate(selfUpdateSchema), controller.updateMe);

// Admin-only user management
router.get('/', authorize('read:users'), validate(listUsersQuerySchema, 'query'), controller.getAll);
router.get('/:id', authorize('read:users'), controller.getById);
router.patch('/:id', authorize('write:users'), validate(adminUpdateSchema), controller.updateUser);
router.patch('/:id/deactivate', authorize('delete:users'), controller.deactivateUser);
=======
const router          = require('express').Router();
const controller      = require('../../controllers/user.controller');
const authenticate    = require('../../middleware/authenticate');
const { authorize }   = require('../../middleware/authorize');
const validate        = require('../../middleware/validate');
const validateObjectId = require('../../middleware/validateObjectId');
const Joi             = require('joi');

const statusSchema = Joi.object({ isActive: Joi.boolean().required() });
const roleSchema   = Joi.object({ role: Joi.string().valid('viewer', 'analyst', 'admin').required() });

router.use(authenticate);
router.use(authorize('read:users'));

router.get('/',                                          controller.getAllUsers);
router.get('/:id',    validateObjectId(),               controller.getUserById);
router.patch('/:id/status', validateObjectId(), validate(statusSchema), controller.updateStatus);
router.patch('/:id/role',   validateObjectId(), validate(roleSchema),   controller.updateRole);
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

module.exports = router;
