const analyticsService = require('../services/analytics.service');
const forecastService = require('../services/forecast.service');
const anomalyService = require('../services/anomaly.service');
const recurringService = require('../services/recurring.service');
const healthScoreService = require('../services/healthScore.service');
const insightsService = require('../services/insights.service');
const reportService = require('../services/report.service');

const getMetrics = async (req, res) => {
  const data = await analyticsService.getMetrics(req.query);
  res.status(200).json({ success: true, data });
};

const getForecast = async (req, res) => {
  const data = await forecastService.getForecast(req.query);
  res.status(200).json({ success: true, data });
};

const getAnomalies = async (req, res) => {
  const data = await anomalyService.getAnomalies();
  res.status(200).json({ success: true, data });
};

const getRecurring = async (req, res) => {
  const data = await recurringService.getRecurringExpenses();
  res.status(200).json({ success: true, data });
};

const getHealthScore = async (req, res) => {
  const data = await healthScoreService.getHealthScore();
  res.status(200).json({ success: true, data });
};

const getInsights = async (req, res) => {
  const data = await insightsService.getInsights();
  res.status(200).json({ success: true, data });
};

const getWeeklyReport = async (req, res) => {
  const data = await reportService.getWeeklyReport();
  res.status(200).json({ success: true, data });
};

module.exports = { getMetrics, getForecast, getAnomalies, getRecurring, getHealthScore, getInsights, getWeeklyReport };
