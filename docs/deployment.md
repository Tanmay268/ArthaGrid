# Deployment (free tier, step by step)

This is a plain-language walkthrough for putting ArthaGrid online without paying for anything. It uses five core free services, plus two optional extras (email reports and metrics). That sounds like a lot, but each one takes a few minutes to set up, and none of them need a credit card.

**Status check:** every step below works with the code as it exists today — the API, the Postgres schema, the copilot endpoint, the email report job, the metrics endpoint, the `frontend/` app, and both GitHub Actions workflow files are all built and tested. Nothing here is "coming soon" — you just need to actually create the five free accounts and set the environment variables below to switch each piece on. See [upgrades.md](./upgrades.md) for the full build history if you want it.

For *why* these particular services were chosen (and what their free-tier limits actually are), see the table at the bottom of [architecture.md](./architecture.md#deployment-free-tier). This page is just the "how."

## What you'll end up with

| Piece | Where it runs | What it's for |
|---|---|---|
| The API (this repo's `src/`) | Render | Handles every request |
| The database | MongoDB Atlas | Stores transactions, users, budgets |
| The analytics store | Neon (Postgres) | Stores pre-computed rollup numbers, rebuilt daily |
| The scheduled job | GitHub Actions | Tells the API "rebuild your rollups" once a day |
| The dashboard (`frontend/`) | Vercel | The website people actually look at |

## 1. MongoDB Atlas (if not already set up)

1. Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a free **M0** cluster.
3. Create a database user (username + password) and allow network access from anywhere (`0.0.0.0/0`) — fine for a project at this scale.
4. Copy the connection string. It goes into `MONGO_URI`.

## 2. Neon Postgres (new, for analytics rollups)

1. Create a free account at [neon.tech](https://neon.tech) — no card required.
2. Create a new project (the free plan gives you plenty of room for a project this size).
3. Copy the connection string it gives you. It goes into `POSTGRES_URL`. If the Render logs print a `SECURITY WARNING: The SSL modes 'prefer', 'require'…` message, change `sslmode=require` at the end of the string to `sslmode=verify-full` — it is what the driver already does today, just written explicitly, and it silences the warning.
4. The rollup table (`monthly_metrics`) is created automatically the first time the API starts, from `src/db/schema.sql` — nothing to run by hand. If `POSTGRES_URL` is never set at all, that's fine too — every analytics endpoint just computes live from MongoDB instead (see [decisions.md](./decisions.md) #17).

## 3. Azure OpenAI (for the AI copilot)

1. In the [Azure AI Foundry](https://ai.azure.com/) portal, create (or reuse) an Azure OpenAI resource and deploy the `gpt-5-mini` model, giving the deployment a name (the default ArthaGrid expects is `gpt-5-mini`).
2. From the resource's **Keys and Endpoint** page, put the key into `AZURE_OPENAI_API_KEY` and the endpoint URL (e.g. `https://your-resource.openai.azure.com`) into `AZURE_OPENAI_ENDPOINT`. Set `AZURE_OPENAI_DEPLOYMENT` to whatever you named the deployment if it isn't `gpt-5-mini`.
3. ArthaGrid only ever sends pre-computed summary numbers to Azure OpenAI, never raw transactions — see [decisions.md](./decisions.md) #19 for why that boundary is deliberate.

## 4. Render (the API itself)

1. Create a free account at [render.com](https://render.com).
2. Create a new **Web Service**, pointing at this GitHub repo.
   - **Choose the region closest to your Atlas cluster (and your Neon project).** This matters more than anything else for speed: every request makes several round trips to the database, and a cross-continent round trip costs roughly 200+ ms *each*. Render can't change a service's region after it's created, so pick it now. Check where your cluster lives in Atlas (Cluster → the region shown, e.g. AWS Mumbai) and pick Render's nearest region (e.g. Singapore for India).
3. Build command: `npm ci`. Start command: `npm start`.
4. Add every variable from `.env.example` as an environment variable on the service (the repo's `render.yaml` Blueprint lists them all and marks the secrets, and `.env.render.example` is a production-flavored template — you can use either the Blueprint or the manual steps) (`MONGO_URI`, `JWT_SECRET`, `POSTGRES_URL`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `CRON_SECRET` — make this one up, it's just a shared password between GitHub Actions and your API — and `CORS_ORIGIN`, set to your Vercel URL once you have it from step 5).
5. Under **Settings → Health Check Path** enter `/health`. (An older service may still probe a path that no longer exists, such as `/api/docs`.)
6. Deploy. Note the URL Render gives you (something like `https://arthagrid.onrender.com`) — the frontend and the scheduled job both need it.
7. **Know the trade-off:** a free Render web service falls asleep after 15 minutes with no traffic, and takes about a minute to wake back up on the next request. That's normal, not a bug — nothing to do about it for free.

## 5. Vercel (the frontend)

1. Create a free account at [vercel.com](https://vercel.com).
2. Import this repo, but point Vercel specifically at the `frontend/` folder (its "root directory" setting) — it'll auto-detect the Vite build (`npm run build`, output `dist/`).
3. Set `VITE_API_BASE_URL` to your Render URL from step 4.
4. Deploy. Note the URL Vercel gives you, and go back to Render to set `CORS_ORIGIN` to it — the refresh-token cookie won't work cross-origin without this being set correctly on both sides.
5. **Know the trade-off:** Vercel's free Hobby plan is for personal, non-commercial projects only — fine here, but it isn't a general-purpose free production plan.

## 6. GitHub Actions (the scheduled rollup job)

This one needs no separate account — it runs inside this same GitHub repo.

1. In the repo's Settings → Secrets and variables → Actions, add two secrets:
   - `RENDER_API_URL` — your Render URL from step 4.
   - `CRON_SECRET` — the same value you set on Render in step 4.
2. That's it — `.github/workflows/rollup.yml` is already set up to run once a day and call `POST {RENDER_API_URL}/api/v1/internal/jobs/rollup` with that secret in a header. You can also trigger it manually from the Actions tab to test it before waiting for the schedule.

## 7. Optional extras

Both are off until you set their variables; the app runs fine without them.

**Weekly email report (Resend)**

1. Create a free account at [resend.com](https://resend.com) and make an API key.
2. On Render, set `RESEND_API_KEY`. Until you verify your own domain in Resend, it can only send from its sandbox address to *your own* Resend account email, so also set `REPORT_ALLOWED_RECIPIENTS` to that address.
3. Set `REPORT_ALLOWED_RECIPIENTS` in any case for a public deployment: registration doesn't check that people own the email they type, so without this list anyone could opt someone else's address into reports.
4. `.github/workflows/weekly-report.yml` runs Sundays and reuses the **same two secrets** as the rollup job (`RENDER_API_URL`, `CRON_SECRET`) — nothing new to add on GitHub. Test it from the Actions tab (**Run workflow**). A user then opts in from **Settings → Weekly email report**.
5. Why Resend and not ordinary email (SMTP)? Render's free tier blocks the SMTP ports, so it would work on your laptop and silently fail online. See [decisions.md](./decisions.md) #24.

**Metrics (Grafana Cloud)**

Set `METRICS_TOKEN` on Render and follow [observability.md](./observability.md). Without the token, `/metrics` refuses everyone.

**Speed:** the 30-second response cache is on by default in production (`ANALYTICS_CACHE_TTL_SECONDS=0` turns it off). See [load-testing.md](./load-testing.md) for what it buys.

**Do not** set `DISABLE_RATE_LIMIT` on Render. It is ignored in production on purpose, but there is no reason to set it.

## Checking it worked

1. Visit `https://<your-render-url>/health` — should return `{ "status": "ok" }`.
2. Visit `https://<your-render-url>/api-docs` — the interactive API documentation should load. The same path on your Vercel URL (`/api-docs`) forwards to it.
3. Visit your Vercel URL — the dashboard should load and be able to log in against the Render API.
4. From the GitHub Actions tab, manually run the "rollup" workflow once and check it completes without an error — that confirms Render, Postgres, and the shared secret are all wired together correctly.

## If something's free-tier-broken, not actually broken

- **Every page is slow even when the server is awake (a second or more per request).** Check that Render and Atlas are in the same or a neighbouring region. Per-request time in the Render logs that comes in near-identical multiples of one number (say ~235 ms, ~470 ms, ~700 ms) is the signature of a fixed cost per database round trip — see [load-testing.md](./load-testing.md) section 3d.
- **First page load is really slow.** That's Render waking up from sleep. Reload after a minute.
- **Dashboard says "no data yet" for analytics that need history.** The nightly rollup hasn't run yet — trigger it manually from GitHub Actions once, or wait for the schedule.
- **MongoDB Atlas cluster seems to have disappeared.** It auto-pauses after 30 days of zero connections. Resume it from the Atlas dashboard — no data is lost.
- **Login works, but you get logged out on every page reload.** `CORS_ORIGIN` on Render probably doesn't exactly match your Vercel URL — the refresh-token cookie can't cross origins without a matching, credentialed CORS setup on both sides (see [decisions.md](./decisions.md) #21).
