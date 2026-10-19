const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { getDemoConnection } = require('../../src/config/tenant');

let mongoServer;

const connect = async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
};

const closeDatabase = async () => {
    await getDemoConnection().dropDatabase();
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
};

const clearDatabase = async () => {
    const collections = [
        ...Object.values(mongoose.connection.collections),
        ...Object.values(getDemoConnection().collections),
    ];
    await Promise.all(collections.map((c) => c.deleteMany({})));
};

module.exports = { connect, closeDatabase, clearDatabase };
