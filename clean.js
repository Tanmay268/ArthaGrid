require('dotenv').config();
const connectDB = require('./src/config/db');
const { User } = require('./src/models/User');
const { Transaction } = require('./src/models/Transaction');

const clean = async () => {
  await connectDB();

  await User.deleteMany({});
  await Transaction.deleteMany({});

  console.log('🧹 All data deleted');
  process.exit(0);
};

clean().catch(err => {
  console.error(err);
  process.exit(1);
});