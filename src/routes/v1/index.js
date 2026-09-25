const router = require('express').Router();

<<<<<<< HEAD
router.use('/auth', require('./auth.routes'));
router.use('/transactions', require('./transaction.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/users', require('./user.routes'));
router.use('/budgets', require('./budget.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/copilot', require('./copilot.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/internal', require('./internal.routes'));
=======
router.use('/auth',         require('./auth.routes'));
router.use('/users',        require('./user.routes'));
router.use('/transactions', require('./transaction.routes'));
router.use('/dashboard',    require('./dashboard.routes'));
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

module.exports = router;
