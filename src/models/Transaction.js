const { date, required } = require('joi');
const mongoose = require('mongoose');

const TRANSACTION_TYPES = ['income', 'expense'];

const CATEGORIES = [
    'salary', 'freelance', 'investment', 'gift', 'other_income',
    'food', 'transport', 'housing', 'utilities', 'healthcare',
    'entertainment', 'education', 'shopping', 'other_expense',
];

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
        isDeleted: {
            type: Boolean,
            default: false,
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

//Global query middleware — auto-exclude soft-deleted records
// This runs before every find, findOne, findOneAndUpdate etc.
transactionSchema.pre(/^find/, function () {
  this.where({ isDeleted: { $ne: true } });
});

//convert schema to working model to enable CRUD operations
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Transaction, TRANSACTION_TYPES, CATEGORIES };
