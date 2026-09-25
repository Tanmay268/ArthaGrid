const { date, required } = require('joi');
const mongoose = require('mongoose');

const TRANSACTION_TYPES = ['income', 'expense'];

const INCOME_CATEGORIES = ['salary', 'freelance', 'investment', 'gift', 'other_income'];
const EXPENSE_CATEGORIES = [
    'food', 'transport', 'housing', 'utilities', 'healthcare',
    'entertainment', 'education', 'shopping', 'other_expense',
];

// Kept as one combined list (same order as before) since existing schemas/
// validators reference CATEGORIES directly — INCOME_CATEGORIES and
// EXPENSE_CATEGORIES are additive, for features (budgets, recurring
// detection) that only care about one side.
const CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const transactionSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be greater than 0'],
        },
        type: {
            type: String,
            enum: { values: TRANSACTION_TYPES, message: `{VALUE} is not a valid type` },
            required: [true, 'Type is required'],
        },
        category: {
            type: String,
            enum: { values: CATEGORIES, message: `{VALUE} is not a valid category` },
            required: [true, 'Category is required'],
        },
        merchant: {
            type: String,
            trim: true,
            maxLength: [100, 'Merchant cannot exceed 100 characters'],
            default: null,
        },
        date: {
            type: Date,
            required: [true, 'Date is required'],
            default: Date.now(),
        },
        description: {
            type: String,
            trim: true,
            maxLength: [500, 'Description cannot exceed 500 characters'],
            default: '',
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
        isDeleted: {
            type: Boolean,
            default: false,
            select: false,
        },
        deletedAt: {
            type: Date,
            default: null,
            select: false,
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            select: false,
        },
    },
    {
        timestamps: true,
    }
);

//Index for the most common query patterns — date range + type filtering
transactionSchema.index({ date: -1 });  // -1 means descending(i.e latest first)
transactionSchema.index({ type: 1, category: 1 });
transactionSchema.index({ createdBy: 1, date: -1 });
transactionSchema.index({ merchant: 1 });  // used by recurring-expense detection

//Global query middleware — auto-exclude soft-deleted records
// This runs before every find, findOne, findOneAndUpdate etc.
transactionSchema.pre(/^find/, function () {
  this.where({ isDeleted: { $ne: true } });
});

//convert schema to working model to enable CRUD operations
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction, TRANSACTION_TYPES, CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES };
