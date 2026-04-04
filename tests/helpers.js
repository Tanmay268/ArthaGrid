process.env.JWT_SECRET     = 'test_secret_key_minimum_32_chars_!!';
process.env.JWT_EXPIRES_IN = '1d';
process.env.NODE_ENV       = 'test';

const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');

const stores = { User: [], Transaction: [], AuditLog: [] };

const makeId = () =>
  Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const clone = (obj) => {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
};

const makeQuery = (docs, single = false) => {
  let _docs = [...docs];
  const q = {
    select:   ()     => q,
    populate: ()     => q,
    lean:     ()     => q,
    sort: (spec) => {
      const entries = typeof spec === 'string'
        ? [[spec.replace(/^-/, ''), spec.startsWith('-') ? -1 : 1]]
        : Object.entries(spec);
      const [key, dir] = entries[0];
      _docs = [..._docs].sort((a, b) => {
        const av = new Date(a[key]).getTime() || a[key];
        const bv = new Date(b[key]).getTime() || b[key];
        return dir === -1 ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
      });
      return q;
    },
    skip:  (n) => { _docs = _docs.slice(n); return q; },
    limit: (n) => { _docs = _docs.slice(0, n); return q; },
    then:  (res, rej) => {
      const result = single
        ? (_docs[0] ? wrapDoc(_docs[0]) : null)
        : _docs.map(wrapDoc);
      return Promise.resolve(result).then(res, rej);
    },
    catch: (fn) => Promise.resolve(null).catch(fn),
  };
  return q;
};

const wrapDoc = (raw) => {
  if (!raw) return null;
  const d = clone(raw);
  d._id      = raw._id;
  d.toObject = () => clone(raw);
  d.toJSON   = () => { const o = clone(raw); delete o.password; return o; };
  d.save     = async () => {
    const store = stores[raw.__model__];
    if (store) {
      const idx = store.findIndex(x => x._id === raw._id);
      if (idx >= 0) Object.assign(store[idx], raw);
    }
    return wrapDoc(raw);
  };
  d.comparePassword = async (candidate) => {
    if (!raw.password) return false;
    return bcrypt.compare(candidate, raw.password);
  };
  return d;
};

const toComparable = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).toISOString();
  return v;
};

const matches = (doc, filter) => {
  for (const [k, v] of Object.entries(filter)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const dv = toComparable(doc[k]);
      if ('$ne'  in v && String(doc[k]) === String(v.$ne))           return false;
      if ('$gt'  in v && !(dv >  toComparable(v.$gt)))               return false;
      if ('$gte' in v && !(dv >= toComparable(v.$gte)))              return false;
      if ('$lt'  in v && !(dv <  toComparable(v.$lt)))               return false;
      if ('$lte' in v && !(dv <= toComparable(v.$lte)))              return false;
      if ('$in'  in v && !v.$in.map(String).includes(String(doc[k]))) return false;
    } else {
      if (String(doc[k]) !== String(v)) return false;
    }
  }
  return true;
};

const patched = new Set();

const patchModel = (Model) => {
  const name = Model.modelName;
  if (!stores[name]) stores[name] = [];

  const getStore = () => stores[name];

  Model.create = async (input) => {
    const arr     = Array.isArray(input) ? input : [input];
    const results = [];
    for (const data of arr) {
      const doc = {
        ...clone(data),
        _id: makeId(),
        __model__: name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (doc.password && !doc.password.startsWith('$2')) {
        doc.password = await bcrypt.hash(doc.password, 1);
      }
      if (name === 'User') {
        doc.role     = doc.role     ?? 'viewer';
        doc.isActive = doc.isActive ?? true;
      }
      if (name === 'Transaction') {
        doc.isDeleted   = false;
        doc.description = doc.description ?? '';
        if (doc.date) doc.date = new Date(doc.date).toISOString();
      }
      if (name === 'AuditLog') {
        doc.status = doc.status ?? 'success';
      }
      getStore().push(doc);
      results.push(wrapDoc(doc));
    }
    return Array.isArray(input) ? results : results[0];
  };

  Model.insertMany = (arr) => Model.create(arr);

  // find — excludes soft-deleted
  Model.find = (filter = {}) => {
    const docs = getStore().filter(d => d.isDeleted !== true && matches(d, filter));
    return makeQuery(docs);
  };

  // findOne — does NOT filter isDeleted (needed for login)
  Model.findOne = (filter = {}) => {
    const doc = getStore().find(d => matches(d, filter));
    return makeQuery(doc ? [doc] : [], true);
  };

  // findById — excludes soft-deleted
  Model.findById = (id) => {
    const doc = getStore().find(d => String(d._id) === String(id) && d.isDeleted !== true);
    return makeQuery(doc ? [doc] : [], true);
  };

  Model.findByIdAndUpdate = (id, update, opts = {}) => {
    const store = getStore();
    const idx   = store.findIndex(d => String(d._id) === String(id));
    const result = (async () => {
      if (idx < 0) return null;
      const data = update.$set || update;
      Object.assign(store[idx], data, { updatedAt: new Date().toISOString() });
      return opts.new ? wrapDoc(store[idx]) : null;
    })();
    // Return a thenable that also supports .populate() chaining
    return {
      then: (res, rej) => result.then(res, rej),
      catch: (fn) => result.catch(fn),
      populate: () => ({ then: (res, rej) => result.then(res, rej), catch: (fn) => result.catch(fn) }),
    };
  };

  Model.countDocuments = async (filter = {}) =>
    getStore().filter(d => d.isDeleted !== true && matches(d, filter)).length;

  Model.deleteMany = async () => {
    getStore().splice(0);
    return { deletedCount: 0 };
  };

  Model.aggregate = async () => [];

  patched.add(name);
};

// ObjectId.isValid shim — accept 24-char hex OR our makeId() output
mongoose.Types.ObjectId.isValid = (v) => {
  if (!v) return false;
  const s = String(v);
  return /^[a-f\d]{24}$/i.test(s);
};

const connect = async () => {
  const { User }        = require('../src/models/User');
  const { Transaction } = require('../src/models/Transaction');
  const { AuditLog }    = require('../src/models/AuditLog');
  [User, Transaction, AuditLog].forEach(patchModel);
};

const disconnect = async () => {};

const clearCollections = async () => {
  for (const k of Object.keys(stores)) stores[k].splice(0);
};

module.exports = { connect, disconnect, clearCollections, stores, makeId };
