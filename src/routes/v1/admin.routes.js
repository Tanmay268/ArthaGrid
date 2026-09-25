const router = require('express').Router();
const controller = require('../../controllers/admin.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');

// Admin-only platform overview — separate from the per-ledger analytics
// every analyst sees.
router.use(authenticate);
router.use(authorize('read:admin'));

router.get('/stats', controller.getStats);

module.exports = router;
