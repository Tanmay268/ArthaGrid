const transactionService = require('../services/transaction.service');
const categorizeService = require('../services/categorize.service');

const create = async (req, res) => {
  const { transaction, unusual } = await transactionService.createTransaction(req.body, req.user._id);
  res.status(201).json({ success: true, data: transaction, unusual });
};

const getAll = async (req, res) => {
  const result = await transactionService.getTransactions(req.query);
  res.status(200).json({ success: true, ...result });
};

const getOne = async (req, res) => {
  const transaction = await transactionService.getTransactionById(req.params.id);
  res.status(200).json({ success: true, data: transaction });
};

const update = async (req, res) => {
  const transaction = await transactionService.updateTransaction(req.params.id, req.body, req.user._id);
  res.status(200).json({ success: true, data: transaction });
};

const remove = async (req, res) => {
  const result = await transactionService.deleteTransaction(req.params.id, req.user._id);
  res.status(200).json({ success: true, ...result });
};

const suggestCategory = async (req, res) => {
  const data = await categorizeService.suggestCategory(req.body);
  res.status(200).json({ success: true, data });
};

module.exports = { create, getAll, getOne, update, remove, suggestCategory };
