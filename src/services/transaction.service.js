const { Transaction } = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
<<<<<<< HEAD
const anomalyService = require('./anomaly.service');
const cache = require('../utils/cache');

// ─── CREATE ─────────────────────────────────────────────────────────────────

const createTransaction = async (data, userId) => {
  const transaction = await Transaction.create({ ...data, createdBy: userId });
  cache.clear();

  // Non-blocking anomaly hint — never rejects the write, just flags it for
  // the caller (see decisions.md / anomaly.service.js). Only expenses are
  // scored; an unusually large paycheck isn't a "concern" the same way.
  const unusual = transaction.type === 'expense'
    ? await anomalyService.scoreTransaction(transaction.category, transaction.amount, transaction._id)
    : { flagged: false, score: 0 };

  return { transaction, unusual };
};

// ─── GET ALL (with filtering, sorting, pagination) ───────────────────────────

=======
const { log, AUDIT_ACTIONS } = require('../utils/auditLogger');

const createTransaction = async (data, userId, req) => {
  const transaction = await Transaction.create({ ...data, createdBy: userId });

  log({
    action:         AUDIT_ACTIONS.TRANSACTION_CREATE,
    performedBy:    userId,
    targetResource: 'Transaction',
    targetId:       transaction._id,
    changes:        { after: data },
    req,
  });

  return transaction;
};

>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
const getTransactions = async (filters) => {
  const {
    type, category, startDate, endDate,
    minAmount, maxAmount,
    page, limit, sortBy, sortOrder,
  } = filters;

<<<<<<< HEAD
  // Build filter object incrementally — only add keys that were provided
  const query = {};

  if (type)      query.type = type;
  if (category)  query.category = category;
=======
  const query = {};

  if (type)     query.type     = type;
  if (category) query.category = category;
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

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

<<<<<<< HEAD
  // Run count and data fetch in parallel — faster than sequential
  const [total, transactions] = await Promise.all([
    // countDocuments doesn't go through the pre(/^find/) soft-delete hook,
    // so the filter has to be applied explicitly or deleted rows inflate `total`.
    Transaction.countDocuments({ ...query, isDeleted: { $ne: true } }),
=======
  const [total, transactions] = await Promise.all([
    Transaction.countDocuments(query),
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
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

<<<<<<< HEAD
// ─── GET ONE ─────────────────────────────────────────────────────────────────

const getTransactionById = async (id) => {
  const transaction = await Transaction.findById(id)
    .populate('createdBy', 'name email role');

=======
const getTransactionById = async (id) => {
  const transaction = await Transaction.findById(id)
    .populate('createdBy', 'name email role');
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  if (!transaction) throw ApiError.notFound('Transaction not found');
  return transaction;
};

<<<<<<< HEAD
// ─── UPDATE ──────────────────────────────────────────────────────────────────

const updateTransaction = async (id, data, userId) => {
  const transaction = await Transaction.findByIdAndUpdate(
    id,
    { ...data, updatedBy: userId },
    {
      returnDocument: 'after', // return updated document, not original
      runValidators: true,     // run schema validators on update too
    }
  );

  if (!transaction) throw ApiError.notFound('Transaction not found');
  cache.clear();
  return transaction;
};

// ─── SOFT DELETE ─────────────────────────────────────────────────────────────

const deleteTransaction = async (id, userId) => {
  // findByIdAndUpdate bypasses the pre(/^find/) middleware, so we
  // use updateOne with $set to set isDeleted without triggering it
  const result = await Transaction.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: userId } },
    { returnDocument: 'after' }
  );

  if (!result) throw ApiError.notFound('Transaction not found');
  cache.clear();
=======
const updateTransaction = async (id, data, userId, req) => {
  const before = await Transaction.findById(id).lean();
  if (!before) throw ApiError.notFound('Transaction not found');

  const transaction = await Transaction.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate('createdBy', 'name email role');

  log({
    action:         AUDIT_ACTIONS.TRANSACTION_UPDATE,
    performedBy:    userId,
    targetResource: 'Transaction',
    targetId:       transaction._id,
    changes:        { before, after: data },
    req,
  });

  return transaction;
};

const deleteTransaction = async (id, userId, req) => {
  const result = await Transaction.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!result) throw ApiError.notFound('Transaction not found');

  log({
    action:         AUDIT_ACTIONS.TRANSACTION_DELETE,
    performedBy:    userId,
    targetResource: 'Transaction',
    targetId:       result._id,
    changes:        { before: { isDeleted: false }, after: { isDeleted: true } },
    req,
  });

>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  return { message: 'Transaction deleted successfully' };
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
<<<<<<< HEAD
};
=======
};
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
