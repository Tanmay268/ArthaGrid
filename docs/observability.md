# Observability (seeing what the server is doing)

"Observability" just means: can you tell, from the outside, whether the server is healthy and how fast it is? ArthaGrid gives you two ways, both free.

| | What it is | Who it's for | Needs anything extra? |
|---|---|---|---|
| **Admin page** (`/admin` in the app) | A screen showing users, transaction volume, popular categories, request count, average/p95/p99 latency, error rate, memory, and whether each optional service is connected | A human admin, in the browser | No — log in as an admin |
| **`/metrics` endpoint** | The same numbers (and more) in Prometheus's standard text format | Tools like Prometheus or Grafana | A token, and something to scrape it |

---

## 1. The admin page — nothing to set up

Log in as an admin and open **Admin** in the sidebar. It calls `GET /api/v1/admin/stats`.

Two honest notes about the numbers:

- **They reset when the server restarts.** They live in the server's memory. On Render's free tier the server sleeps after 15 idle minutes and forgets them, so read them as "since the server last started" (the page shows how long it has been up).
- **Percentiles are estimates.** p95/p99 are worked out from latency "buckets" (the same method Prometheus uses), so they're accurate to the bucket size, not to the millisecond.

The page shows only totals and shares — never an individual transaction's amount, description or merchant.

---

## 2. `/metrics` for Prometheus / Grafana

### Turn it on

Set a long random value in the environment (locally in `.env`, on Render in the dashboard):

```
METRICS_TOKEN=some-long-random-string
```

Then request it with that token:

```bash
curl -H "Authorization: Bearer some-long-random-string" http://localhost:5000/metrics
```

- **No token set on the server → `/metrics` answers 401 to everyone.** That is deliberate: metrics reveal route names and traffic patterns, so there is no "open" mode.
- Wrong token → 401.

### What you get

- `http_request_duration_seconds` — a histogram (count, sum, buckets) labeled by `method`, `route` and `status_code`. From it you can graph requests/second, error rate, and latency percentiles.
- Standard Node process metrics: CPU, memory, event-loop lag, garbage collection.

**Labels are kept bounded on purpose.** `/transactions/64b7f0c2…` and `/transactions/64c1…` are both recorded as `/transactions/:id`, and any URL that doesn't match a real route (a bot probing `/wp-admin`) is recorded as `unmatched`. Without that, a scanner could create thousands of separate metric series and fill memory or blow through a free Grafana plan's series limit.

### Scrape it with Prometheus (free, self-run)

A minimal `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: arthagrid
    scheme: https
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials: some-long-random-string
    static_configs:
      - targets: ['your-app.onrender.com']
```

Run Prometheus locally with Docker (`docker run -p 9090:9090 -v ./prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus`) and open <http://localhost:9090>. Useful queries:

```
# requests per second, by route
sum by (route) (rate(http_request_duration_seconds_count[5m]))

# 95th-percentile latency
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

# share of requests that were server errors
sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count[5m]))
```

### Hosted dashboards: Grafana Cloud free tier

Grafana Cloud has a free plan with a metrics allowance. It does not reach out and scrape your URL by itself — you run a small collector (Grafana Alloy, or Prometheus with `remote_write`) that scrapes ArthaGrid with the bearer token and forwards the data to your Grafana Cloud account. Grafana's own onboarding page for your account gives the exact snippet with your credentials.

> **Honest status:** the `/metrics` endpoint is built and tested (`tests/observability.test.js`, including the 401 cases and the label normalization). The Prometheus config and queries above use standard, documented settings, but **we did not run this against a live Grafana Cloud account**. Also note: a collector on your laptop only collects while your laptop is on. A collector that is always on needs a host, and free hosting doesn't offer an always-on worker — the same limitation that shaped [decisions.md](./decisions.md) #18.

---

## 3. What is *not* built

- **OpenTelemetry tracing** (following a single request through every step). It needs a collector running somewhere always-on, which the free tier doesn't give us. Metrics + structured logs (pino) cover what a project this size needs.
- **Alerting.** Nothing pages you when errors spike. Grafana can do this once you have a collector; ArthaGrid itself doesn't.
