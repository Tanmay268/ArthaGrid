const router = require('express').Router();
const controller = require('../../controllers/budget.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createBudgetSchema, updateBudgetSchema } = require('../../validators/budget.validator');

router.use(authenticate);

// GET - viewer, analyst, and admin can all see budgets + progress
router.get('/', authorize('read:budgets'), controller.getAll);

// POST/PATCH/DELETE - admin only, same pattern as transactions
router.post('/', authorize('write:budgets'), validate(createBudgetSchema), controller.create);
router.patch('/:id', authorize('write:budgets'), validate(updateBudgetSchema), controller.update);
router.delete('/:id', authorize('write:budgets'), controller.remove);

module.exports = router;
