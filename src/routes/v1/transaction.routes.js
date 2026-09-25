<<<<<<< HEAD
const router = require('express').Router();
const controller = require('../../controllers/transaction.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');

const {
    createTransactionSchema,
    updateTransactionSchema,
    queryTransactionSchema,
    suggestCategorySchema,
} = require('../../validators/transaction.validator');

// All transaction routes require authentication
router.use(authenticate);

// GET all - viewer, Analyst and Admin all can read
router.get(
    '/',
    authorize('read:transactions'),
    validate(queryTransactionSchema, 'query'),
    controller.getAll
);

// GET one - same read permission
router.get(
    '/:id',
    authorize('read:transactions'),
    controller.getOne
);

// POST /suggest-category - same gate as creating a transaction, since it only
// exists to help fill in the create form (declared before any /:id route)
router.post(
    '/suggest-category',
    authorize('write:transactions'),
    validate(suggestCategorySchema),
    controller.suggestCategory
);

// POST - only Admin can create
router.post(
    '/',
    authorize('write:transactions'),
    validate(createTransactionSchema),
    controller.create
);

router.patch(
    '/:id',
    authorize('write:transactions'),
    validate(updateTransactionSchema),
    controller.update
);

//DELETE - only Admin can delete
router.delete(
    '/:id',
    authorize('delete:transactions'),
    controller.remove
);

module.exports = router;



=======
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
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
