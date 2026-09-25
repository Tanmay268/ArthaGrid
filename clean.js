require('dotenv').config();
const connectDB = require('./src/config/db');
const { User } = require('./src/models/User');
const { Transaction } = require('./src/models/Transaction');
const { Budget } = require('./src/models/Budget');

const clean = async () => {
  await connectDB();

  await User.deleteMany({});
  await Transaction.deleteMany({});
  await Budget.deleteMany({});

  console.log('🧹 All data deleted');
  process.exit(0);
};

clean().catch(err => {
  console.error(err);
  process.exit(1);
});