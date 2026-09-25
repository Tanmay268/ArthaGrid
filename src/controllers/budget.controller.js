const budgetService = require('../services/budget.service');

const create = async (req, res) => {
  const budget = await budgetService.createBudget(req.body, req.user._id);
  res.status(201).json({ success: true, data: budget });
};

const getAll = async (req, res) => {
  const data = await budgetService.getBudgets();
  res.status(200).json({ success: true, data });
};

const update = async (req, res) => {
  const budget = await budgetService.updateBudget(req.params.id, req.body, req.user._id);
  res.status(200).json({ success: true, data: budget });
};

const remove = async (req, res) => {
  const result = await budgetService.deleteBudget(req.params.id);
  res.status(200).json({ success: true, ...result });
};

module.exports = { create, getAll, update, remove };
