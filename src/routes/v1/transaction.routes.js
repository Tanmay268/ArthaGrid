const router = require('express').Router();
const controller = require('../../controllers/transaction.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');

const {
    createTransactionSchema,
    updateTransactionSchema,
    queryTransactionSchema,
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



