const rollupService = require('../services/rollup.service');
const reportMailer = require('../services/reportMailer.service');

const runRollup = async (req, res) => {
  const data = await rollupService.runRollup();
  res.status(200).json({ success: true, data });
};

const sendWeeklyReports = async (req, res) => {
  const data = await reportMailer.sendWeeklyReports();
  res.status(200).json({ success: true, data });
};

module.exports = { runRollup, sendWeeklyReports };
