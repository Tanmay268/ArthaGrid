require('dotenv').config();
const connectDB = require('./src/config/db');
const { User } = require('./src/models/User');
const { Transaction, CATEGORIES } = require('./src/models/Transaction');

const randomBetween = (min, max) =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

const randomDate = (start, end) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const incomeCategories  = ['salary', 'freelance', 'investment', 'gift', 'other_income'];
const expenseCategories = ['food', 'transport', 'housing', 'utilities', 'healthcare',
                           'entertainment', 'education', 'shopping', 'other_expense'];

const seed = async () => {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Transaction.deleteMany({});

  // Create users
  const [admin, analyst, viewer] = await User.create([
    { name: 'Alice Admin',  email: 'admin@test.com',   password: 'Password123', role: 'admin'   },
    { name: 'Bob Analyst',  email: 'analyst@test.com', password: 'Password123', role: 'analyst' },
    { name: 'Carol Viewer', email: 'viewer@test.com',  password: 'Password123', role: 'viewer'  },
  ]);

  // Generate 60 transactions spread across the last 6 months
  const transactions = [];
  const startDate = new Date('2024-07-01');
  const endDate   = new Date('2024-12-31');

  for (let i = 0; i < 60; i++) {
    const isIncome = Math.random() > 0.45; // ~55% expenses, 45% income
    transactions.push({
      amount:      isIncome ? randomBetween(1000, 8000) : randomBetween(50, 2000),
      type:        isIncome ? 'income' : 'expense',
      category:    randomItem(isIncome ? incomeCategories : expenseCategories),
      date:        randomDate(startDate, endDate),
      description: `Seeded transaction ${i + 1}`,
      createdBy:   admin._id,
    });
  }

  await Transaction.insertMany(transactions);

  console.log('✓ Seeded: 3 users, 60 transactions');
  console.log('  admin@test.com    / Password123  (admin)');
  console.log('  analyst@test.com  / Password123  (analyst)');
  console.log('  viewer@test.com   / Password123  (viewer)');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
