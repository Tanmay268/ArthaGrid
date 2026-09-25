# Load testing ArthaGrid

This page shows how to load-test ArthaGrid **for free**, in about five minutes, with nothing to sign up for. It also records the results we measured, so the report can point to real numbers instead of guesses.

The tool is [k6](https://k6.io) — free, open source, runs on your own computer. The database is an in-memory MongoDB that starts automatically, so you don't need Atlas or any cloud account.

---

## 1. Run it yourself

**One-time setup**

1. Install k6 (free):
   - Windows: `winget install k6 --source winget` (or download from <https://k6.io/docs/get-started/installation/>)
   - macOS: `brew install k6`
   - Linux: see the k6 install page
2. In the project folder, run `npm install` (you probably already have).

**Every time**

Open **two terminals** in the project folder.

**Terminal 1 — start the test server**

```bash
npm run loadtest:server
```

Wait for the line saying it is listening on port 5050. This starts the *real* ArthaGrid app against a throwaway in-memory database holding 5,000 transactions (about 24 months of history), one admin user, and some budgets. Rate limiting is turned off in this mode so we measure the app itself, not the 300-requests-per-15-minutes safety cap. (That switch is ignored when `NODE_ENV=production`, so it can't be left on by accident in a real deployment.)

**Terminal 2 — run the test**

```bash
k6 run loadtest/k6/load.js
```

That runs 20 simulated users for 30 seconds. When it ends, k6 prints a table and either **✓** or **✗** next to each threshold (the pass/fail bar, explained below).

**Turn the knobs**

| What you want | Command |
|---|---|
| More users | `k6 run -e VUS=100 loadtest/k6/load.js` |
| Longer run | `k6 run -e DURATION=2m loadtest/k6/load.js` |
| No writes (needed to measure the cache) | `k6 run -e WRITE_RATE=0 loadtest/k6/load.js` |
| Test a deployed server instead | `k6 run -e BASE_URL=https://your-app.onrender.com -e LOGIN_EMAIL=… -e LOGIN_PASSWORD=… loadtest/k6/load.js` |
| Save results to a file | `k6 run --summary-export=loadtest/results/my-run.json loadtest/k6/load.js` |

To compare **with and without the response cache**, restart Terminal 1 with the cache on:

```bash
# Windows PowerShell
$env:ANALYTICS_CACHE_TTL_SECONDS=30; npm run loadtest:server
# macOS / Linux / Git Bash
ANALYTICS_CACHE_TTL_SECONDS=30 npm run loadtest:server
```

(The default is `0` = cache off, so the numbers below the "no cache" heading are the honest worst case.)

**Turn saved results into a table for the report**

```bash
node loadtest/summarize.js loadtest/results/*.json
```

> ⚠️ Don't test the free Render deployment hard. The free tier has limited CPU and a monthly bandwidth/hours budget, and hammering someone else's shared machine is rude. Run the heavy tests locally; do at most a short, light run (e.g. `VUS=5 DURATION=20s`) against the deployed URL, and wake it up first with a single request.

---

## 2. What the test actually does

Each simulated user ("virtual user", or VU) repeats what the real frontend does when someone opens the app:

1. `GET /dashboard/summary`
2. `GET /transactions?page=1&limit=20`
3. `GET /budgets`
4. `GET /analytics/metrics`
5. `GET /analytics/insights` ← the heaviest endpoint
6. `GET /analytics/forecast?months=3`
7. Pause one second (a person reading the screen), repeat.

On top of that, every second **one login** happens (deliberately slow — passwords are hashed with bcrypt cost 12) and **two new transactions per second** are written.

So "100 VUs" means roughly 100 people actively clicking around at the same moment — much more than a portfolio project will see, but a fair stress test.

**Pass/fail thresholds** (k6 exits non-zero if any fail):

- fewer than 1% of requests may fail
- 95% of requests must finish in under 800 ms (2 s for the heavier analytics endpoints)

---

## 3. Results we measured

**Setup:** k6 v2.0.0 and the server ran **on the same Windows 11 laptop**, sharing its CPU with each other and with everything else running. The database was in-memory MongoDB with 5,000 transactions. Each run lasted 30 seconds. Treat the numbers as *relative* evidence (how things change as load grows, and what the cache and coalescing fixes did), not as a promise about Render or Atlas performance. Raw k6 output is saved in [`loadtest/results/`](../loadtest/results/).

### 3a. Growing load, cache off (worst case), with writes

| Users (VUs) | Requests | Req/s | Avg (ms) | p95 (ms) | Failed requests |
|---:|---:|---:|---:|---:|---:|
| 10 | 957 | 29.6 | 213 | 879 | 0.00% |
| 25 | 1,544 | 46.4 | 400 | 1,768 | 0.00% |
| 50 | 1,697 | 52.8 | 774 | 3,316 | 0.00% |
| 100 | 2,485 | 67.7 | 1,286 | 6,011 | 0.00% |

What this says, in plain words:

- **Nothing broke.** Zero failed requests even at 100 users with no cache.
- **But it slows down.** Throughput levels off around 50–70 requests/second, and everything just queues, so latency rises. That is the signature of a CPU-bound single process.
- **One endpoint is the culprit.** At 100 users, p95 for `/analytics/insights` was ~6.5 s while the simple endpoints (`summary`, `transactions`, `budgets`) stayed under ~800 ms. Insights runs several database aggregations per request. The pass/fail thresholds above **failed** at 10 users and up in this mode (p95 879 ms at 10 users) — we're reporting that, not hiding it.

### 3b. Same test with the response cache on (30-second cache, read-only traffic)

Writes clear the cache on purpose (so users never see stale numbers after adding a transaction), so this comparison uses `WRITE_RATE=0` for both columns to be fair.

| Users | Mode | Req/s | Avg (ms) | p95 (ms) | Max (ms) | Failed |
|---:|---|---:|---:|---:|---:|---:|
| 25 | cache off | 41.5 | 423 | 1,795 | 2,298 | 0.00% |
| 25 | **cache on** | **105.7** | **70** | **278** | 578 | 0.00% |
| 100 | cache off | 64.8 | 1,324 | 6,006 | 6,869 | 0.00% |
| 100 | **cache on** | **241.1** | **239** | **701** | 1,434 | 0.00% |

That is roughly **3.7× the throughput and about 8.6× lower p95 latency at 100 users**, from a small in-process cache — no Redis, no new service, no cost. `/analytics/insights` p95 at 100 users went from 6,397 ms to 540 ms.

### 3c. A bug the load test found

The first time we ran the cache-on test at 100 users, `/analytics/insights` was *still* slow (p95 6.4 s, max 7.1 s) even though it was "cached". The reason is a classic problem called a **cache stampede**: when the cache entry expires, all 100 users ask for the fresh answer at the same instant, and every one of them triggers the expensive calculation, instead of just one.

Fix: **request coalescing** ("single-flight") — if a calculation for the same key is already running, later requests wait for it and share the result. After the fix, the slowest request dropped from 7.1 s to 1.4 s. (A unit test in `tests/observability.test.js` proves the calculation now runs once for concurrent requests.)

Honest note: overall p95 at 100 users was 536 ms before the fix and 701 ms after. That difference is within run-to-run noise on a shared laptop; the meaningful improvement is the worst case (max latency) and the insights endpoint, not the overall p95.

---

## 4. Reading the results for the report

You can say, truthfully:

- The API handled **100 concurrent active users with 0 failed requests** on a single process.
- **Without** caching, capacity is limited to roughly 50–70 requests/second by the analytics aggregations, and latency grows past the 800 ms target above ~10 users.
- **With** a 30-second in-process cache and request coalescing, the same hardware served ~240 requests/second at 100 users with p95 ≈ 0.7 s.
- The load test found a real defect (cache stampede) that unit tests hadn't, and it was fixed and re-measured.

You should **not** claim:

- these are production numbers for Render + Atlas — they aren't (different CPU, a network hop to a real database, Atlas M0's ~100 ops/sec cap);
- that it "scales to thousands of users" — it wasn't tested there.

---

## 5. How it can scale further (the honest path)

In the order we would do them, cheapest first:

1. **Already done:** response cache + request coalescing (section 3).
2. **Postgres rollups** (built, optional): multi-month trend and forecast reads come from pre-computed daily/monthly tables instead of scanning transactions. Turn it on by setting `POSTGRES_URL`; a GitHub Actions job refreshes it.
3. **Indexes:** check `explain()` on the aggregations as data grows past ~100k rows.
4. **Fix the N+1 query pattern in `getAnomalies`** (several small queries where one grouped aggregation would do).
5. **Lower bcrypt cost** only if logins become the bottleneck (a trade against password-cracking resistance — usually not worth it).
6. **More than one server instance:** the in-process cache is per-instance, so a second instance means each has its own cache (still correct, just less effective). At that point, move the cache to Redis (free tiers exist, e.g. Upstash) so instances share it.
7. **Bigger database tier** — Atlas M0's ~100 ops/sec is the real ceiling on the free plan.

None of steps 3–7 are needed for a portfolio project; they are the roadmap if it ever had real users.
