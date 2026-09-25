const mongoose = require('mongoose');
const { EXPENSE_CATEGORIES } = require('./Transaction');

// Budgets are global per category (one shared ledger, same as transactions —
// see decisions.md: no per-user data isolation yet), not per-user. Only
// expense categories make sense here — there's no such thing as an income
// "budget".
const budgetSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            enum: { values: EXPENSE_CATEGORIES, message: `{VALUE} is not a valid expense category` },
            required: [true, 'Category is required'],
            unique: true, // one budget per category
        },
        monthlyLimit: {
            type: Number,
            required: [true, 'Monthly limit is required'],
            min: [0.01, 'Monthly limit must be greater than 0'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required'],
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = { Budget };
