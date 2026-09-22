const { Transaction } = require('../models/Transaction');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: build a base $match stage from optional date range filters
// Every dashboard endpoint accepts ?startDate=&endDate= to scope the data
// ─────────────────────────────────────────────────────────────────────────────

const buildDateMatch = (startDate, endDate) => {
    const match = { isDeleted: { $ne: true } };

    const isValidDate = (d) => d && !isNaN(new Date(d));

    if(isValidDate(startDate) || isValidDate(endDate)){
        match.date = {};

        if(isValidDate(startDate)){
            match.date.$gte = new Date(startDate);
        }

        if(isValidDate(endDate)){
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // include full day
            match.date.$lte = end;
        }
    }
    return match;
}

module.exports = { buildDateMatch };


// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/summary
// Returns: totalIncome, totalExpenses, netBalance, transactionCount,
//          avgTransactionAmount, largestIncome, largestExpense
// ─────────────────────────────────────────────────────────────────────────────

const getSummary = async ({ startDate, endDate } = {}) => {
    const match = buildDateMatch(startDate, endDate);

    const result = await Transaction.aggregate([
        // Stage 1: Filter to the date range (and exclude soft-deleted)
        { $match: match },

        // Stage 2: Group ALL documents into one bucket
        // _id: null means "one group for everything"
        {
            $group: {
                _id: null,
                totalIncome: {
                    $sum: {
                        $cond: [ { $eq: ['$type', 'income'] }, '$amount', 0],
                    },
                },
                totalExpenses: {
                    $sum: {
                        $cond: [ { $eq: ['$type', 'expense'] }, '$amount', 0],
                    },
                },
                transactionCount: {
                    $sum: 1,
                },
                avgAmount: {
                    $avg: '$amount',
                },
                largestIncome: {
                    $max: {
                        $cond: [{ $eq: ['$type', 'income']}, '$amount', 0],
                    },
                },
                largestExpense: {
                    $max: {
                        $cond: [{$eq: ['$type', 'expense']}, '$amount', 0],
                    },
                },
            },
        },

        // Stage 3: Shape the output — compute derived fields, round numbers
        //
        // Every projected field must live inside this single $project object —
        // a pipeline stage can only have one top-level operator key. (Fields
        // like transactionCount/savingsRate used to be accidentally placed as
        // siblings of $project instead of inside it, which made MongoDB reject
        // the whole pipeline with an "exactly one field" error.)
        {
            $project: {
                _id: 0,
                totalIncome: { $round: ['$totalIncome', 2] },
                totalExpenses: { $round: ['$totalExpenses', 2] },
                netBalance: { $round: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, 2] },
                transactionCount: 1,
                avgTransactionAmount: { $round: ['$avgAmount', 2] },
                largestIncome: { $round: ['$largestIncome', 2] },
                largestExpense: { $round: ['$largestExpense', 2] },
                savingsRate: {
                    $cond: [
                        { $gt: ['$totalIncome', 0] },
                        {
                            $round: [
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                { $subtract: ['$totalIncome', '$totalExpenses'] },
                                                '$totalIncome',
                                            ],
                                        },
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

    // If no transactions exist, return zeros instead of empty array
    return result[0] ?? {
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        transactionCount: 0,
        avgTransactionAmount: 0,
        largestIncome: 0,
        largestExpense: 0,
        savingsRate: 0,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/by-category
// Returns: per-category totals, counts, averages — split by income vs expense
// ─────────────────────────────────────────────────────────────────────────────
const getByCategory = async ({ startDate, endDate, type } = {}) => {
    const match = buildDateMatch(startDate, endDate);
    if(type) match.type = type; //filter to just income or expense

    const results = await Transaction.aggregate([
        { $match: match },
         
        // Group by both category AND type to get separate income/expense rows
        {
            $group: {
                _id: { category: '$category', type: '$type' },
                total: { $sum: '$amount' }   ,
                count: { $sum: 1},
                avg: { $avg: '$amount' },
                min: { $min: '$amount'},
                max: { $max: '$amount'},
            },
        },

        //shape each row cleanly
        {
            $project: {
                _id: 0,
                category: '$_id.category',
                type: '$_id.type',
                total: { $round: ['$total', 2] },
                count: 1,
                avg: { $round: ['$avg', 2] },
                min: { $round: ['$min', 2] },
                max: { $round: ['$max', 2] },
            },
        },
        // Sort by total descending so biggest categories come first
        { $sort: { total: -1 } },
    ]);

    // Group into { income: [...], expense: [...] } for easier frontend consumption
    const grouped = results.reduce(
        (acc, item) => {
            acc[item.type].push(item);
            return acc;
        },
        { income: [], expense: [] }
    );

    return grouped;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/trends?period=monthly&year=2024
// GET /dashboard/trends?period=weekly&startDate=2024-10-01&endDate=2024-12-31
// Returns: time-series data with income and expense per period
// ─────────────────────────────────────────────────────────────────────────────
const getTrends = async ({ period = 'monthly', year, startDate, endDate } = {}) => {
  const match = buildDateMatch(startDate, endDate);

  // If year is provided, scope to that year
  if (year) {
    const y = parseInt(year);
    match.date = {
      $gte: new Date(`${y}-01-01`),
      $lte: new Date(`${y}-12-31`),
    };
  }

  // Build the grouping key based on period
  // $dateToString formats dates into strings MongoDB can group by
  const groupId =
    period === 'weekly'
      ? {
          year:  { $isoWeekYear: '$date' },
          week:  { $isoWeek: '$date' },
        }
      : {
          year:  { $year: '$date' },
          month: { $month: '$date' },
        };

  const results = await Transaction.aggregate([
    { $match: match },

    // Group by time period + type
    {
      $group: {
        _id: { ...groupId, type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },

    // Sort chronologically
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } },
  ]);

  // ── Transform raw results into clean time-series format ──────────────────
  // Raw output looks like:
  //   [{ _id: { year: 2024, month: 10, type: 'income' }, total: 5000 },
  //    { _id: { year: 2024, month: 10, type: 'expense' }, total: 3200 }, ...]
  //
  // We want:
  //   [{ period: 'Oct 2024', income: 5000, expenses: 3200, net: 1800 }, ...]

  const periodMap = new Map();

  for (const row of results) {
    const key =
      period === 'weekly'
        ? `W${row._id.week}-${row._id.year}`
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

  // Compute net and convert to sorted array
  return Array.from(periodMap.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(entry => ({
      ...entry,
      net: Math.round((entry.income - entry.expenses) * 100) / 100,
    }));
};

// Format { year: 2024, month: 10 } → "Oct 2024"
// Format { year: 2024, week: 42 }  → "W42 2024"
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];

const formatPeriodLabel = (period, idObj) => {
  if (period === 'weekly') return `W${idObj.week} ${idObj.year}`;
  return `${MONTH_NAMES[idObj.month - 1]} ${idObj.year}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/recent?limit=5
// Returns: last N transactions with computed running balance
// ─────────────────────────────────────────────────────────────────────────────
const getRecentActivity = async ({ limit = 5 } = {}) => {
  const transactions = await Transaction.find()
    .populate('createdBy', 'name email')
    .sort({ date: -1 })
    .limit(Math.min(parseInt(limit), 20)); // cap at 20

  return transactions;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/overview  ← THE STANDOUT ENDPOINT
// Uses $facet to run ALL summary queries in a single DB round trip
// ─────────────────────────────────────────────────────────────────────────────
const getOverview = async ({ startDate, endDate } = {}) => {
  const match = buildDateMatch(startDate, endDate);

  const [result] = await Transaction.aggregate([
    { $match: match },

    // $facet runs multiple independent sub-pipelines on the same
    // matched dataset simultaneously — one DB round trip total
    {
      $facet: {

        // Facet 1: overall summary numbers
        summary: [
          {
            $group: {
              _id: null,
              totalIncome: {
                $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] },
              },
              totalExpenses: {
                $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] },
              },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              totalIncome:   { $round: ['$totalIncome', 2] },
              totalExpenses: { $round: ['$totalExpenses', 2] },
              netBalance: {
                $round: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, 2],
              },
              count: 1,
            },
          },
        ],

        // Facet 2: top 5 expense categories
        topExpenseCategories: [
          { $match: { type: 'expense' } },
          { $group: { _id: '$category', total: { $sum: '$amount' } } },
          { $sort: { total: -1 } },
          { $limit: 5 },
          { $project: { _id: 0, category: '$_id', total: { $round: ['$total', 2] } } },
        ],

        // Facet 3: income vs expense count breakdown
        typeBreakdown: [
          { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $project: { _id: 0, type: '$_id', count: 1, total: { $round: ['$total', 2] } } },
        ],

        // Facet 4: last 30 days vs previous 30 days comparison
        recentVsPrevious: [
          {
            $group: {
              _id: {
                isRecent: {
                  $gte: ['$date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)],
                },
                type: '$type',
              },
              total: { $sum: '$amount' },
            },
          },
          {
            $project: {
              _id: 0,
              period: { $cond: ['$_id.isRecent', 'last30days', 'prior'] },
              type:   '$_id.type',
              total:  { $round: ['$total', 2] },
            },
          },
        ],
      },
    },

    // Flatten the summary array (facet always returns arrays)
    {
      $project: {
        summary:             { $arrayElemAt: ['$summary', 0] },
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

module.exports = {
  buildDateMatch,
  getSummary,
  getByCategory,
  getTrends,
  getRecentActivity,
  getOverview,
};