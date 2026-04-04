const { Transaction } = require('../models/Transaction');
const ApiError = require('../utils/ApiError');
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

const getTransactions = async (filters) => {
  const {
    type, category, startDate, endDate,
    minAmount, maxAmount,
    page, limit, sortBy, sortOrder,
  } = filters;

  const query = {};

  if (type)     query.type     = type;
  if (category) query.category = category;

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

const getTransactionById = async (id) => {
  const transaction = await Transaction.findById(id)
    .populate('createdBy', 'name email role');
  if (!transaction) throw ApiError.notFound('Transaction not found');
  return transaction;
};

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

  return { message: 'Transaction deleted successfully' };
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
