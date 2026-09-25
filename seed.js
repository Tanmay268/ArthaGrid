require('dotenv').config();
const connectDB = require('./src/config/db');
<<<<<<< HEAD
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
=======
const { User }  = require('./src/models/User');
const { Transaction, CATEGORIES } = require('./src/models/Transaction');

const rand       = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const randDate   = (start, end) => new Date(start.getTime() + Math.random() * (end - start));
const pick       = (arr) => arr[Math.floor(Math.random() * arr.length)];

const incomeCategories  = ['salary', 'freelance', 'investment', 'gift', 'other_income'];
const expenseCategories = ['food', 'transport', 'housing', 'utilities', 'healthcare',
                           'entertainment', 'education', 'shopping', 'other_expense'];

const descriptions = {
  salary:        ['Monthly salary', 'Salary deposit', 'Payroll'],
  freelance:      ['Freelance project', 'Consulting fee', 'Contract work'],
  investment:     ['Dividend income', 'Stock sale', 'Mutual fund return'],
  gift:           ['Birthday gift', 'Festival bonus', 'Family transfer'],
  food:           ['Grocery shopping', 'Restaurant dinner', 'Food delivery'],
  transport:      ['Uber ride', 'Monthly bus pass', 'Fuel refill'],
  housing:        ['Monthly rent', 'Maintenance fee', 'Electricity bill'],
  utilities:      ['Internet bill', 'Mobile recharge', 'DTH subscription'],
  healthcare:     ['Doctor visit', 'Pharmacy', 'Health insurance'],
  entertainment:  ['Movie tickets', 'OTT subscription', 'Weekend outing'],
  education:      ['Online course', 'Books', 'Exam fee'],
  shopping:       ['Amazon order', 'Clothes shopping', 'Electronics'],
};

const seed = async () => {
  await connectDB();
  console.log('Clearing existing data...');
  await User.deleteMany({});
  await Transaction.deleteMany({});

  // ── Create users ──
  const [admin, analyst, viewer] = await User.create([
    { name: 'Alice Admin',   email: 'admin@test.com',   password: 'pass1234', role: 'admin'   },
    { name: 'Bob Analyst',   email: 'analyst@test.com', password: 'pass1234', role: 'analyst' },
    { name: 'Carol Viewer',  email: 'viewer@test.com',  password: 'pass1234', role: 'viewer'  },
  ]);

  console.log('✓ Created 3 users');

  // ── Generate 80 transactions across 12 months ──
  const transactions = [];
  const start = new Date('2024-01-01').getTime();
  const end   = new Date('2024-12-31').getTime();

  for (let i = 0; i < 80; i++) {
    const isIncome = Math.random() > 0.48;
    const category = pick(isIncome ? incomeCategories : expenseCategories);
    const descList  = descriptions[category] || ['Transaction'];

    transactions.push({
      amount:      isIncome ? rand(500, 12000) : rand(30, 3000),
      type:        isIncome ? 'income' : 'expense',
      category,
      date:        randDate(new Date(start), end),
      description: pick(descList),
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
      createdBy:   admin._id,
    });
  }

<<<<<<< HEAD
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
=======
  await Transaction.insertMany(transactions);
  console.log('✓ Created 80 transactions (Jan–Dec 2024)');

  console.log('\n──────────────────────────────────────');
  console.log('Seeded test accounts:');
  console.log('  admin@test.com    / pass1234  → admin');
  console.log('  analyst@test.com  / pass1234  → analyst');
  console.log('  viewer@test.com   / pass1234  → viewer');
  console.log('──────────────────────────────────────\n');
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
