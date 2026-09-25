const { Budget } = require('../models/Budget');
const { Transaction } = require('../models/Transaction');
const ApiError = require('../utils/ApiError');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// First and last instant of the current calendar month — budgets always
// track "this month," there's no historical budget view yet.
const getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
};

// ─── CREATE ─────────────────────────────────────────────────────────────────

const createBudget = async (data, userId) => {
    const existing = await Budget.findOne({ category: data.category });
    if (existing) throw ApiError.conflict(`A budget for "${data.category}" already exists`);

    return Budget.create({ ...data, createdBy: userId });
};

// ─── LIST, with current-month progress attached ────────────────────────────

const getBudgets = async () => {
    const budgets = await Budget.find().sort({ category: 1 });
    if (budgets.length === 0) return [];

    const { start, end } = getCurrentMonthRange();
    const spendRows = await Transaction.aggregate([
        { $match: { type: 'expense', date: { $gte: start, $lte: end } } },
        { $group: { _id: '$category', spent: { $sum: '$amount' } } },
    ]);
    const spendByCategory = new Map(spendRows.map((r) => [r._id, r.spent]));

    return budgets.map((budget) => {
        const spent = round2(spendByCategory.get(budget.category) || 0);
        const percentage = budget.monthlyLimit > 0
            ? Math.round((spent / budget.monthlyLimit) * 1000) / 10 // one decimal place
            : 0;

        return {
            id: budget._id,
            category: budget.category,
            monthlyLimit: budget.monthlyLimit,
            isActive: budget.isActive,
            spent,
            remaining: round2(budget.monthlyLimit - spent),
            percentage,
            isOverBudget: spent > budget.monthlyLimit,
        };
    });
};

// ─── UPDATE ─────────────────────────────────────────────────────────────────

const updateBudget = async (id, data, userId) => {
    const budget = await Budget.findByIdAndUpdate(
        id,
        { ...data, updatedBy: userId },
        { returnDocument: 'after', runValidators: true }
    );

    if (!budget) throw ApiError.notFound('Budget not found');
    return budget;
};

// ─── DELETE ─────────────────────────────────────────────────────────────────

const deleteBudget = async (id) => {
    const budget = await Budget.findByIdAndDelete(id);
    if (!budget) throw ApiError.notFound('Budget not found');
    return { message: 'Budget removed' };
};

module.exports = {
    getCurrentMonthRange,
    createBudget,
    getBudgets,
    updateBudget,
    deleteBudget,
};
