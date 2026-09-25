const rollupService = require('../services/rollup.service');

const runRollup = async (req, res) => {
  const data = await rollupService.runRollup();
  res.status(200).json({ success: true, data });
};

module.exports = { runRollup };
