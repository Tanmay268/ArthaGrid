// Measures the category classifier two ways and prints the numbers as-is:
//
//   1. Held-out set   — phrases in tests/fixtures/categorizerHoldout.js that
//                       are NOT in the seed corpus (the more honest number).
//   2. 5-fold CV      — cross-validation within the seed corpus itself.
//
//   npm run eval:categorizer
//
// Both are small hand-written sets from a single author; read the results as
// a smoke test of generalisation, not as a benchmark.

const { trainModel, predict, seedExamples } = require('../src/services/categorize.service');
const holdout = require('../tests/fixtures/categorizerHoldout');

const pct = (n, d) => `${((n / d) * 100).toFixed(1)}% (${n}/${d})`;

// 1. Held-out
const model = trainModel(seedExamples());
let hit = 0;
let offered = 0;
let offeredCorrect = 0;
const misses = [];
for (const h of holdout) {
    const r = predict(model, h.text, h.type);
    if (r.alternatives[0]?.category === h.category) hit++;
    else misses.push(`${h.text}  →  ${r.alternatives[0]?.category ?? 'none'} (expected ${h.category})`);
    if (r.suggestion) {
        offered++;
        if (r.suggestion.category === h.category) offeredCorrect++;
    }
}

console.log('Held-out phrases (not in the seed corpus)');
console.log('  top-1 accuracy:                ', pct(hit, holdout.length));
console.log('  suggestion offered (score>=0.5):', pct(offered, holdout.length));
console.log('  accuracy when offered:         ', offered ? pct(offeredCorrect, offered) : 'n/a');
if (misses.length) console.log('  misses:\n    ' + misses.join('\n    '));

// 2. 5-fold cross-validation over the seed corpus
const examples = seedExamples();
const K = 5;
let cvHit = 0;
for (let fold = 0; fold < K; fold++) {
    const train = examples.filter((_, i) => i % K !== fold);
    const test = examples.filter((_, i) => i % K === fold);
    const m = trainModel(train);
    for (const t of test) {
        const type = ['salary', 'freelance', 'investment', 'gift', 'other_income'].includes(t.category) ? 'income' : 'expense';
        if (predict(m, t.text, type).alternatives[0]?.category === t.category) cvHit++;
    }
}
console.log('\n5-fold cross-validation on the seed corpus');
console.log('  top-1 accuracy:                ', pct(cvHit, examples.length));
