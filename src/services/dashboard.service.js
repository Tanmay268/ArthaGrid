const { Transaction } = require('../models/Transaction');

/**
 * Build a $match stage for aggregation pipelines.
 * Aggregation bypasses Mongoose middleware, so we must manually
 * exclude soft-deleted records in every pipeline.
 */
const buildDateMatch = (startDate, endDate) => {
  const match = { isDeleted: { $ne: true } };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate)   match.date.$lte = new Date(endDate);
  }
  return match;
};

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
const getSummary = async ({ startDate, endDate } = {}) => {
  const match = buildDateMatch(startDate, endDate);

  const result = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalIncome: {
          $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
        },
        totalExpenses: {
          $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
        },
        transactionCount: { $sum: 1 },
        avgAmount:        { $avg: '$amount' },
        largestIncome: {
          $max: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
        },
        largestExpense: {
          $max: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalIncome:          { $round: ['$totalIncome', 2] },
        totalExpenses:        { $round: ['$totalExpenses', 2] },
        netBalance:           { $round: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, 2] },
        transactionCount:     1,
        avgTransactionAmount: { $round: ['$avgAmount', 2] },
        largestIncome:        { $round: ['$largestIncome', 2] },
        largestExpense:       { $round: ['$largestExpense', 2] },
        savingsRate: {
          $cond: [
            { $gt: ['$totalIncome', 0] },
            {
              $round: [
                {
                  $multiply: [
                    { $divide: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, '$totalIncome'] },
                    100,
                  ],
                },
                1,
              ],
            },
            0,
          ],
        },
      },
    },
  ]);

  return result[0] ?? {
    totalIncome: 0, totalExpenses: 0, netBalance: 0,
    transactionCount: 0, avgTransactionAmount: 0,
    largestIncome: 0, largestExpense: 0, savingsRate: 0,
  };
};

// ─── CATEGORY BREAKDOWN ───────────────────────────────────────────────────────
const getByCategory = async ({ startDate, endDate, type } = {}) => {
  const match = buildDateMatch(startDate, endDate);
  if (type) match.type = type;

  const results = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id:   { category: '$category', type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        avg:   { $avg: '$amount' },
        min:   { $min: '$amount' },
        max:   { $max: '$amount' },
      },
    },
    {
      $project: {
        _id:      0,
        category: '$_id.category',
        type:     '$_id.type',
        total:    { $round: ['$total', 2] },
        count:    1,
        avg:      { $round: ['$avg', 2] },
        min:      { $round: ['$min', 2] },
        max:      { $round: ['$max', 2] },
      },
    },
    { $sort: { total: -1 } },
  ]);

  return results.reduce(
    (acc, item) => { acc[item.type].push(item); return acc; },
    { income: [], expense: [] }
  );
};

// ─── TRENDS ───────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];

const formatPeriodLabel = (period, idObj) => {
  if (period === 'weekly') return `W${idObj.week} ${idObj.year}`;
  return `${MONTH_NAMES[idObj.month - 1]} ${idObj.year}`;
};

const getTrends = async ({ period = 'monthly', year, startDate, endDate } = {}) => {
  const match = buildDateMatch(startDate, endDate);

  if (year) {
    const y = parseInt(year);
    match.date = { $gte: new Date(`${y}-01-01`), $lte: new Date(`${y}-12-31`) };
  }

  const groupId = period === 'weekly'
    ? { year: { $isoWeekYear: '$date' }, week: { $isoWeek: '$date' } }
    : { year: { $year: '$date' }, month: { $month: '$date' } };

  const results = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id:   { ...groupId, type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } },
  ]);

  const periodMap = new Map();

  for (const row of results) {
    const key = period === 'weekly'
      ? `${row._id.year}-W${String(row._id.week).padStart(2, '0')}`
      : `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;

    if (!periodMap.has(key)) {
      periodMap.set(key, {
        period: key,
        label:  formatPeriodLabel(period, row._id),
        income:   0,
        expenses: 0,
      });
    }

    const entry = periodMap.get(key);
    if (row._id.type === 'income')  entry.income   = Math.round(row.total * 100) / 100;
    if (row._id.type === 'expense') entry.expenses = Math.round(row.total * 100) / 100;
  }

  return Array.from(periodMap.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(e => ({ ...e, net: Math.round((e.income - e.expenses) * 100) / 100 }));
};

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────────────
const getRecentActivity = async ({ limit = 5 } = {}) => {
  const transactions = await Transaction.find()
    .populate('createdBy', 'name email')
    .sort({ date: -1 })
    .limit(Math.min(parseInt(limit), 20));

  return transactions;
};

// ─── OVERVIEW ($facet — single round trip) ────────────────────────────────────
const getOverview = async ({ startDate, endDate } = {}) => {
  const match = buildDateMatch(startDate, endDate);

  const [result] = await Transaction.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id:           null,
              totalIncome:   { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
              totalExpenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
              count:         { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              totalIncome:   { $round: ['$totalIncome', 2] },
              totalExpenses: { $round: ['$totalExpenses', 2] },
              netBalance:    { $round: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, 2] },
              count:         1,
            },
          },
        ],
        topExpenseCategories: [
          { $match: { type: 'expense' } },
          { $group: { _id: '$category', total: { $sum: '$amount' } } },
          { $sort: { total: -1 } },
          { $limit: 5 },
          { $project: { _id: 0, category: '$_id', total: { $round: ['$total', 2] } } },
        ],
        typeBreakdown: [
          { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $project: { _id: 0, type: '$_id', count: 1, total: { $round: ['$total', 2] } } },
        ],
        recentVsPrevious: [
          {
            $group: {
              _id: {
                isRecent: { $gte: ['$date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                type: '$type',
              },
              total: { $sum: '$amount' },
            },
          },
          {
            $project: {
              _id:    0,
              period: { $cond: ['$_id.isRecent', 'last30days', 'prior'] },
              type:   '$_id.type',
              total:  { $round: ['$total', 2] },
            },
          },
        ],
      },
    },
    {
      $project: {
        summary:              { $arrayElemAt: ['$summary', 0] },
        topExpenseCategories: 1,
        typeBreakdown:        1,
        recentVsPrevious:     1,
      },
    },
  ]);

  return result ?? {
    summary: { totalIncome: 0, totalExpenses: 0, netBalance: 0, count: 0 },
    topExpenseCategories: [],
    typeBreakdown: [],
    recentVsPrevious: [],
  };
};

module.exports = { getSummary, getByCategory, getTrends, getRecentActivity, getOverview };
