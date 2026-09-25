const router = require('express').Router();
const controller = require('../../controllers/analytics.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { metricsSchema, forecastSchema } = require('../../validators/analytics.validator');

// Same gate as the existing /dashboard analytics endpoints — analyst/admin only
router.use(authenticate);
router.use(authorize('read:analytics'));

router.get('/metrics', validate(metricsSchema, 'query'), controller.getMetrics);
router.get('/forecast', validate(forecastSchema, 'query'), controller.getForecast);
router.get('/anomalies', controller.getAnomalies);
router.get('/recurring', controller.getRecurring);
router.get('/health-score', controller.getHealthScore);
router.get('/insights', controller.getInsights);

module.exports = router;
