const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/transactions', require('./transaction.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/users', require('./user.routes'));

module.exports = router;
