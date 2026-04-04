require('dotenv').config();
const connectDB = require('./src/config/db');
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
    { name: 'Alice Admin',   email: 'admin@test.com',   password: 'pass123', role: 'admin'   },
    { name: 'Bob Analyst',   email: 'analyst@test.com', password: 'pass123', role: 'analyst' },
    { name: 'Carol Viewer',  email: 'viewer@test.com',  password: 'pass123', role: 'viewer'  },
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
      createdBy:   admin._id,
    });
  }

  await Transaction.insertMany(transactions);
  console.log('✓ Created 80 transactions (Jan–Dec 2024)');

  console.log('\n──────────────────────────────────────');
  console.log('Seeded test accounts:');
  console.log('  admin@test.com    / pass123  → admin');
  console.log('  analyst@test.com  / pass123  → analyst');
  console.log('  viewer@test.com   / pass123  → viewer');
  console.log('──────────────────────────────────────\n');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
