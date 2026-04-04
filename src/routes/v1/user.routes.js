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

module.exports = router;
