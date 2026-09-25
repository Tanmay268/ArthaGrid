// Turns k6 --summary-export JSON files into a Markdown table.
//
//   node loadtest/summarize.js loadtest/results/nocache-vus10.json loadtest/results/nocache-vus25.json
//
// Prints exactly what k6 measured — nothing is estimated or smoothed.

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('Usage: node loadtest/summarize.js <k6-summary.json> [...more]');
    process.exit(1);
}

const ms = (n) => (n === undefined ? '—' : `${Math.round(n)}`);
const ENDPOINTS = ['summary', 'transactions', 'budgets', 'metrics', 'insights', 'forecast', 'login'];

const rows = files.map((file) => {
    const m = JSON.parse(fs.readFileSync(file, 'utf8')).metrics;
    const d = m.http_req_duration;
    const failed = m.http_req_failed;
    return {
        name: path.basename(file, '.json'),
        reqs: m.http_reqs.count,
        rps: m.http_reqs.rate.toFixed(1),
        avg: ms(d.avg),
        p95: ms(d['p(95)']),
        max: ms(d.max),
        failed: `${((failed.value ?? failed.rate ?? 0) * 100).toFixed(2)}%`,
        perEndpoint: Object.fromEntries(
            ENDPOINTS.map((e) => [e, ms(m[`http_req_duration{endpoint:${e}}`]?.['p(95)'])])
        ),
    };
});

console.log('| Run | Requests | Req/s | Avg (ms) | p95 (ms) | Max (ms) | Failed |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const r of rows) console.log(`| ${r.name} | ${r.reqs} | ${r.rps} | ${r.avg} | ${r.p95} | ${r.max} | ${r.failed} |`);

console.log('\np95 latency per endpoint (ms):\n');
console.log(`| Run | ${ENDPOINTS.join(' | ')} |`);
console.log(`|---|${ENDPOINTS.map(() => '---:').join('|')}|`);
for (const r of rows) console.log(`| ${r.name} | ${ENDPOINTS.map((e) => r.perEndpoint[e]).join(' | ')} |`);
