const { Transaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES } = require('../models/Transaction');
const { SEED } = require('../data/categorySeed');
const cache = require('../utils/cache');

// ─────────────────────────────────────────────────────────────────────────────
// Category suggestion: a Multinomial Naive Bayes text classifier, written in
// plain JS so it runs inside the existing free-tier service (no Python
// sidecar, no ML dependency, no third-party API — decisions.md #23).
//
// Features are whole words PLUS character trigrams. The trigrams are what
// make it forgiving of typos and unseen variants ("swigy", "zomatto",
// "netflix.com" all still share trigrams with the words the model has seen).
//
// Training data = a small hand-written seed corpus (cold start) + the
// ledger's own transactions, weighted higher — a user's own labels are the
// best evidence of how *they* categorise things. The model is rebuilt lazily
// whenever the ledger changes (utils/cache.js bumps a version counter on
// every write), so suggestions improve as the ledger grows.
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(['the', 'a', 'an', 'for', 'to', 'of', 'and', 'at', 'in', 'on', 'via', 'upi', 'my', 'from', 'with']);
const ALPHA = 0.5; // Laplace/Lidstone smoothing
const LEDGER_WEIGHT = 3; // one of the user's own labelled transactions counts as 3 seed examples
const LEDGER_TRAINING_LIMIT = 5000;

// A suggestion is only offered above this. Naive Bayes posteriors are famously
// over-confident, so this is a "how much better than the alternatives" score,
// NOT a calibrated probability — the UI presents it as a suggestion to confirm.
const MIN_SCORE = 0.5;

const tokenize = (text) =>
    String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

const featuresOf = (text) => {
    const features = [];
    for (const word of tokenize(text)) {
        features.push(`w:${word}`);
        if (word.length >= 4) {
            const padded = `#${word}#`;
            for (let i = 0; i <= padded.length - 3; i++) features.push(`c:${padded.slice(i, i + 3)}`);
        }
    }
    return features;
};

// ─── Pure functions (also used by scripts/evaluate-categorizer.js) ──────────

// examples: [{ text, category, weight? }]
const trainModel = (examples) => {
    const classes = new Map(); // category -> { docs, total, counts: Map }
    const vocabulary = new Set();
    let totalDocs = 0;

    for (const { text, category, weight = 1 } of examples) {
        const feats = featuresOf(text);
        if (feats.length === 0) continue;
        if (!classes.has(category)) classes.set(category, { docs: 0, total: 0, counts: new Map() });
        const c = classes.get(category);
        c.docs += weight;
        totalDocs += weight;
        for (const f of feats) {
            vocabulary.add(f);
            c.counts.set(f, (c.counts.get(f) || 0) + weight);
            c.total += weight;
        }
    }

    return { classes, vocabulary, totalDocs };
};

// type: optional 'income' | 'expense' — restricts the candidate categories,
// which is both more accurate and stops an expense being labelled "salary".
const predict = (model, text, type) => {
    const feats = featuresOf(text).filter((f) => model.vocabulary.has(f));
    if (feats.length === 0) return { suggestion: null, alternatives: [], reason: 'no_known_words' };

    const allowed = type === 'income' ? INCOME_CATEGORIES : type === 'expense' ? EXPENSE_CATEGORIES : null;
    const V = model.vocabulary.size;

    const logScores = [];
    for (const [category, c] of model.classes) {
        if (allowed && !allowed.includes(category)) continue;
        let score = Math.log(c.docs / model.totalDocs);
        for (const f of feats) {
            score += Math.log(((c.counts.get(f) || 0) + ALPHA) / (c.total + ALPHA * V));
        }
        logScores.push({ category, score });
    }
    if (logScores.length === 0) return { suggestion: null, alternatives: [], reason: 'no_candidates' };

    // softmax, shifted by the max for numerical stability
    const max = Math.max(...logScores.map((s) => s.score));
    const exp = logScores.map((s) => ({ category: s.category, value: Math.exp(s.score - max) }));
    const sum = exp.reduce((t, e) => t + e.value, 0);
    const ranked = exp
        .map((e) => ({ category: e.category, score: Math.round((e.value / sum) * 1000) / 1000 }))
        .sort((a, b) => b.score - a.score);

    const top = ranked[0];
    return {
        suggestion: top.score >= MIN_SCORE ? top : null,
        alternatives: ranked.slice(0, 3),
        ...(top.score < MIN_SCORE ? { reason: 'low_confidence' } : {}),
    };
};

const seedExamples = () =>
    Object.entries(SEED).flatMap(([category, texts]) => texts.map((text) => ({ text, category })));

// ─── Model lifecycle: rebuilt when the ledger changes ───────────────────────

let cached = { version: -1, model: null, ledgerExamples: 0 };

const getModel = async () => {
    if (cached.model && cached.version === cache.version()) return cached;

    // find() goes through the soft-delete hook, so deleted transactions
    // don't train the model.
    const rows = await Transaction.find({ $or: [{ description: { $gt: '' } }, { merchant: { $gt: '' } }] })
        .select('description merchant category')
        .sort({ date: -1 })
        .limit(LEDGER_TRAINING_LIMIT)
        .lean();

    const ledger = rows.map((r) => ({
        text: `${r.merchant || ''} ${r.description || ''}`,
        category: r.category,
        weight: LEDGER_WEIGHT,
    }));

    cached = {
        version: cache.version(),
        model: trainModel([...seedExamples(), ...ledger]),
        ledgerExamples: ledger.length,
    };
    return cached;
};

// ─── POST /api/v1/transactions/suggest-category ─────────────────────────────

const suggestCategory = async ({ description, merchant, type }) => {
    const { model, ledgerExamples } = await getModel();
    const result = predict(model, `${merchant || ''} ${description || ''}`, type);
    return {
        ...result,
        basedOn: { seedExamples: seedExamples().length, ledgerExamples },
    };
};

module.exports = { suggestCategory, trainModel, predict, seedExamples, MIN_SCORE };
