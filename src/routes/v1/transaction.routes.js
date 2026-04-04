const router          = require('express').Router();
const controller      = require('../../controllers/transaction.controller');
const authenticate    = require('../../middleware/authenticate');
const { authorize }   = require('../../middleware/authorize');
const validate        = require('../../middleware/validate');
const validateObjectId = require('../../middleware/validateObjectId');
const {
  createTransactionSchema,
  updateTransactionSchema,
  queryTransactionSchema,
} = require('../../validators/transaction.validator');

router.use(authenticate);

router.get(
  '/',
  authorize('read:transactions'),
  validate(queryTransactionSchema, 'query'),
  controller.getAll
);

router.get(
  '/:id',
  authorize('read:transactions'),
  validateObjectId(),
  controller.getOne
);

router.post(
  '/',
  authorize('write:transactions'),
  validate(createTransactionSchema),
  controller.create
);

router.patch(
  '/:id',
  authorize('write:transactions'),
  validateObjectId(),
  validate(updateTransactionSchema),
  controller.update
);

router.delete(
  '/:id',
  authorize('delete:transactions'),
  validateObjectId(),
  controller.remove
);

module.exports = router;
