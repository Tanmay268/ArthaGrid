const dashboardService = require('../services/dashboard.service');
const auditLogService  = require('../services/auditLog.service');

/**
 * @swagger
 * /dashboard/overview:
 *   get:
 *     summary: Full dashboard overview using $facet (single DB round trip)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: startDate, schema: { type: string } }
 *       - { in: query, name: endDate,   schema: { type: string } }
 *     responses:
 *       200: { description: Summary, top categories, type breakdown, period comparison }
 */
const getOverview = async (req, res) => {
  const data = await dashboardService.getOverview(req.query);
  res.status(200).json({ success: true, data });
};

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Total income, expenses, net balance, savings rate
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: startDate, schema: { type: string } }
 *       - { in: query, name: endDate,   schema: { type: string } }
 *     responses:
 *       200: { description: Financial summary }
 */
const getSummary = async (req, res) => {
  const data = await dashboardService.getSummary(req.query);
  res.status(200).json({ success: true, data });
};

/**
 * @swagger
 * /dashboard/by-category:
 *   get:
 *     summary: Per-category totals, counts, and averages
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: type,      schema: { type: string, enum: [income, expense] } }
 *       - { in: query, name: startDate, schema: { type: string } }
 *       - { in: query, name: endDate,   schema: { type: string } }
 *     responses:
 *       200: { description: Category breakdown grouped by type }
 */
const getByCategory = async (req, res) => {
  const data = await dashboardService.getByCategory(req.query);
  res.status(200).json({ success: true, data });
};

/**
 * @swagger
 * /dashboard/trends:
 *   get:
 *     summary: Monthly or weekly income vs expense trends
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: period,    schema: { type: string, enum: [monthly, weekly], default: monthly } }
 *       - { in: query, name: year,      schema: { type: integer } }
 *       - { in: query, name: startDate, schema: { type: string } }
 *       - { in: query, name: endDate,   schema: { type: string } }
 *     responses:
 *       200: { description: Time-series trend data }
 */
const getTrends = async (req, res) => {
  const data = await dashboardService.getTrends(req.query);
  res.status(200).json({ success: true, data });
};

/**
 * @swagger
 * /dashboard/recent:
 *   get:
 *     summary: Most recent transactions
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 5 } }
 *     responses:
 *       200: { description: Recent transactions }
 */
const getRecentActivity = async (req, res) => {
  const data = await dashboardService.getRecentActivity(req.query);
  res.status(200).json({ success: true, data });
};

/**
 * @swagger
 * /dashboard/audit:
 *   get:
 *     summary: Audit log of all system actions (admin only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: action,      schema: { type: string } }
 *       - { in: query, name: performedBy, schema: { type: string } }
 *       - { in: query, name: startDate,   schema: { type: string } }
 *       - { in: query, name: endDate,     schema: { type: string } }
 *       - { in: query, name: page,        schema: { type: integer } }
 *       - { in: query, name: limit,       schema: { type: integer } }
 *     responses:
 *       200: { description: Paginated audit log }
 */
const getAuditLog = async (req, res) => {
  const result = await auditLogService.getAuditLogs(req.query);
  res.status(200).json({ success: true, ...result });
};

module.exports = {
  getOverview, getSummary, getByCategory,
  getTrends, getRecentActivity, getAuditLog,
};
