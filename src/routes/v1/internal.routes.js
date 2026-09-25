const router = require('express').Router();
const controller = require('../../controllers/internal.controller');
const verifyCronSecret = require('../../middleware/verifyCronSecret');

// Not part of the public API — never documented in openapi.yaml/Swagger UI.
// Called only by the scheduled GitHub Actions workflow (.github/workflows/rollup.yml).
router.post('/jobs/rollup', verifyCronSecret, controller.runRollup);
router.post('/jobs/weekly-report', verifyCronSecret, controller.sendWeeklyReports);

module.exports = router;
