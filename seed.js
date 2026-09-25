require('dotenv').config();
const connectDB = require('./src/config/db');
const { User } = require('./src/models/User');
const { Transaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES } = require('./src/models/Transaction');
const { Budget } = require('./src/models/Budget');

const randomBetween = (min, max) =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

const randomDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// A handful of recurring monthly charges (same merchant + amount + category,
// ~30 days apart) so recurring-expense detection and the analytics/insights
// endpoints have something realistic to find without needing real usage.
const RECURRING_CHARGES = [
  { merchant: 'Netflix', amount: 649, category: 'entertainment' },
  { merchant: 'Spotify', amount: 119, category: 'entertainment' },
  { merchant: 'Internet Provider', amount: 999, category: 'utilities' },
  { merchant: 'Landlord', amount: 15000, category: 'housing' },
];

const seed = async () => {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Transaction.deleteMany({});
  await Budget.deleteMany({});

  // Create users
  const [admin, analyst, viewer] = await User.create([
    { name: 'Alice Admin',  email: 'admin@test.com',   password: 'Password123', role: 'admin'   },
    { name: 'Bob Analyst',  email: 'analyst@test.com', password: 'Password123', role: 'analyst' },
    { name: 'Carol Viewer', email: 'viewer@test.com',  password: 'Password123', role: 'viewer'  },
  ]);

  const startDate = new Date('2024-07-01');
  const endDate   = new Date('2024-12-31');

  // Generate 60 one-off transactions spread across the last 6 months
  const transactions = [];
  for (let i = 0; i < 60; i++) {
    const isIncome = Math.random() > 0.45; // ~55% expenses, 45% income
    transactions.push({
      amount:      isIncome ? randomBetween(1000, 8000) : randomBetween(50, 2000),
      type:        isIncome ? 'income' : 'expense',
      category:    randomItem(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
      date:        randomDate(startDate, endDate),
      description: `Seeded transaction ${i + 1}`,
      createdBy:   admin._id,
    });
  }

  // One deliberately unusual transaction — well above the food category's
  // normal range — so anomaly detection has something real to flag.
  transactions.push({
    amount: 18500,
    type: 'expense',
    category: 'shopping',
    merchant: 'Electronics Store',
    date: randomDate(startDate, endDate),
    description: 'Seeded anomaly: unusually large purchase',
    createdBy: admin._id,
  });

  // Recurring monthly charges — one transaction per month per charge, 6 months back
  for (const charge of RECURRING_CHARGES) {
    for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
      const date = new Date(endDate);
      date.setMonth(date.getMonth() - monthsAgo);
      transactions.push({
        amount: charge.amount,
        type: 'expense',
        category: charge.category,
        merchant: charge.merchant,
        date,
        description: `${charge.merchant} subscription`,
        createdBy: admin._id,
      });
    }
  }

  await Transaction.insertMany(transactions);

  // A couple of sample budgets so /budgets and the Financial Health Score's
  // "budget adherence" component have real data to work with.
  await Budget.create([
    { category: 'food', monthlyLimit: 8000, createdBy: admin._id },
    { category: 'entertainment', monthlyLimit: 1000, createdBy: admin._id },
    { category: 'shopping', monthlyLimit: 6000, createdBy: admin._id },
  ]);

  console.log('✓ Seeded: 3 users, ~85 transactions (incl. recurring charges + 1 anomaly), 3 budgets');
  console.log('  admin@test.com    / Password123  (admin)');
  console.log('  analyst@test.com  / Password123  (analyst)');
  console.log('  viewer@test.com   / Password123  (viewer)');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
