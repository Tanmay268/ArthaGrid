// seed.js (run once with: node seed.js)
require('dotenv').config();
const connectDB = require('./src/config/db');
const { User } = require('./src/models/User');

const seed = async () => {
  await connectDB();
  await User.deleteMany({});
  await User.create([
    { name: 'Tanmay Admin',   email: 'admin@test.com',   password: 'pass1234', role: 'admin' },
    { name: 'Yash Analyst',   email: 'analyst@test.com', password: 'pass1234', role: 'analyst' },
    { name: 'Kanav Viewer',  email: 'viewer@test.com',  password: 'pass1234', role: 'viewer' },
  ]);
  console.log('Seeded 3 users');
  process.exit();
};

seed();