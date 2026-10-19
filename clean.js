require('dotenv').config();
const connectDB = require('./src/config/db');
const { User } = require('./src/models/User');
const { Transaction } = require('./src/models/Transaction');
const { Budget } = require('./src/models/Budget');
const RefreshToken = require('./src/models/RefreshToken');
const { LIVE, DEMO, runWithTenant } = require('./src/config/tenant');

// Wipes ALL users, transactions, budgets and sessions in ONE database.
//   node clean.js --yes           → the live (real accounts) database
//   node clean.js --demo --yes    → the demo database
//   add --keep-users to keep user accounts (and their logins) and wipe only
//   transactions, budgets and sessions.
// Irreversible, so it refuses to run without --yes.
const args = process.argv.slice(2);
const tenant = args.includes('--demo') ? DEMO : LIVE;

const clean = async () => {
  if (!args.includes('--yes')) {
    console.error(`Refusing to wipe the ${tenant} database without --yes.`);
    process.exit(1);
  }

  await connectDB();

  await runWithTenant(tenant, async () => {
    const counts = {
      users: await User.countDocuments({}),
      transactions: await Transaction.countDocuments({}),
      budgets: await Budget.countDocuments({}),
    };
    if (!args.includes('--keep-users')) await User.deleteMany({});
    await Transaction.deleteMany({});
    await Budget.deleteMany({});
    await RefreshToken.deleteMany({});
    console.log(`🧹 ${tenant} database wiped (removed`, counts, ')');
  });

  process.exit(0);
};

clean().catch(err => {
  console.error(err);
  process.exit(1);
});
