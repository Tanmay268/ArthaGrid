const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

// Two isolated datastores share one codebase:
//   live — real accounts (the default database in MONGO_URI)
//   demo — the public demo logins, in a separate database, so nothing a
//          visitor does can ever touch real data (and vice versa).
//
// The tenant for a request is decided once (authenticate / login) and carried
// through AsyncLocalStorage, so services keep importing `Transaction`, `User`
// etc. exactly as before — the exported models are thin proxies that resolve
// to the live or demo model of whichever tenant the current request belongs to.

const LIVE = 'live';
const DEMO = 'demo';

const storage = new AsyncLocalStorage();

const currentTenant = () => storage.getStore() || LIVE;
const isDemoTenant = () => currentTenant() === DEMO;
const runWithTenant = (tenant, fn) => storage.run(tenant, fn);

let demoConnection = null;

// Same cluster, different database by default (free Atlas tiers allow it);
// set DEMO_MONGO_URI to put the demo data on a different cluster entirely.
const getDemoConnection = () => {
    if (demoConnection) return demoConnection;

    if (process.env.DEMO_MONGO_URI) {
        demoConnection = mongoose.createConnection(process.env.DEMO_MONGO_URI);
    } else {
        const demoName = process.env.DEMO_DB_NAME || 'arthagrid-demo';
        demoConnection = mongoose.connection.useDb(demoName, { useCache: true });
    }
    return demoConnection;
};

const connectionFor = (tenant) => (tenant === DEMO ? getDemoConnection() : mongoose.connection);

// Registers `schema` as model `name` on both databases and returns a proxy
// that routes every static call / `new Model()` to the right one.
const tenantModel = (name, schema) => {
    const perTenant = {};
    const resolve = () => {
        const tenant = currentTenant();
        if (!perTenant[tenant]) {
            const conn = connectionFor(tenant);
            perTenant[tenant] = conn.models[name] || conn.model(name, schema);
        }
        return perTenant[tenant];
    };

    return new Proxy(function TenantModel() {}, {
        get(_, prop) {
            const model = resolve();
            const value = model[prop];
            return typeof value === 'function' && prop !== 'prototype' ? value.bind(model) : value;
        },
        construct(_, args) {
            const Model = resolve();
            return new Model(...args);
        },
        has: (_, prop) => prop in resolve(),
    });
};

module.exports = {
    LIVE,
    DEMO,
    currentTenant,
    isDemoTenant,
    runWithTenant,
    getDemoConnection,
    tenantModel,
};
