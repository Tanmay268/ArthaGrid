const dashboardService = require('../services/dashboard.service');

const getSummary = async (req, res) => {
  const data = await dashboardService.getSummary(req.query);
  res.status(200).json({ success: true, data });
};

const getByCategory = async (req, res) => {
  const data = await dashboardService.getByCategory(req.query);
  res.status(200).json({ success: true, data });
};

const getTrends = async (req, res) => {
  const data = await dashboardService.getTrends(req.query);
  res.status(200).json({ success: true, data });
};

const getRecentActivity = async (req, res) => {
  const data = await dashboardService.getRecentActivity(req.query);
  res.status(200).json({ success: true, data });
};

const getOverview = async (req, res) => {
  const data = await dashboardService.getOverview(req.query);
  res.status(200).json({ success: true, data });
};

module.exports = { getSummary, getByCategory, getTrends, getRecentActivity, getOverview };