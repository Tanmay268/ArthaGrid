const router = require('express').Router();
router.use('/auth', require('./auth.routes'));

// Day 2+: router.use('/transactions', require('./transaction.routes'));
router.use('/transactions', require('./transaction.routes'));

// Day 3+: router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;