const { Transaction } = require('../models/Transaction');
const ApiError = require('../utils/ApiError');

// ─── CREATE ─────────────────────────────────────────────────────────────────

const createTransaction = async (data, userId) => {
  const transaction = await Transaction.create({ ...data, createdBy: userId });
  return transaction;
};

// ─── GET ALL (with filtering, sorting, pagination) ───────────────────────────

const getTransactions = async (filters) => {
  const {
    type, category, startDate, endDate,
    minAmount, maxAmount,
    page, limit, sortBy, sortOrder,
  } = filters;

  // Build filter object incrementally — only add keys that were provided
  const query = {};

  if (type)      query.type = type;
  if (category)  query.category = category;

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate)   query.date.$lte = new Date(endDate);
  }

  if (minAmount || maxAmount) {
    query.amount = {};
    if (minAmount) query.amount.$gte = minAmount;
    if (maxAmount) query.amount.$lte = maxAmount;
  }

  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  // Run count and data fetch in parallel — faster than sequential
  const [total, transactions] = await Promise.all([
    Transaction.countDocuments(query),
    Transaction.find(query)
      .populate('createdBy', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────

const getTransactionById = async (id) => {
  const transaction = await Transaction.findById(id)
    .populate('createdBy', 'name email role');

  if (!transaction) throw ApiError.notFound('Transaction not found');
  return transaction;
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────

const updateTransaction = async (id, data) => {
  const transaction = await Transaction.findByIdAndUpdate(
    id,
    data,
    {
      new: true,          // return updated document, not original
      runValidators: true, // run schema validators on update too
    }
  );

  if (!transaction) throw ApiError.notFound('Transaction not found');
  return transaction;
};

// ─── SOFT DELETE ─────────────────────────────────────────────────────────────

const deleteTransaction = async (id) => {
  // findByIdAndUpdate bypasses the pre(/^find/) middleware, so we
  // use updateOne with $set to set isDeleted without triggering it
  const result = await Transaction.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!result) throw ApiError.notFound('Transaction not found');
  return { message: 'Transaction deleted successfully' };
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};