const copilotService = require('../services/copilot.service');

const ask = async (req, res) => {
  const data = await copilotService.askCopilot(req.body.question);
  res.status(200).json({ success: true, data });
};

module.exports = { ask };
