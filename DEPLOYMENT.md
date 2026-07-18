# Deploying Strata (free tier)

Target stack — all **free, no credit card**:

| Piece | Provider | Notes |
|---|---|---|
| Database | **Neon** | Serverless Postgres; doesn't expire. |
| Backend | **Render** | Free Docker web service. Sleeps after ~15 min idle → first request cold-starts (~40s). |
| Frontend | **Vercel** | Static SPA hosting. |
| AI (agent + RAG) | **Google Gemini** | One AI Studio key powers chat *and* embeddings via `AI_PROVIDER=openai`. |

Deploy order: **DB → backend → frontend** (the frontend needs the backend URL; the
backend needs the DB URL and the frontend URL for CORS).

> **Known free-tier limitations**
> - **Uploaded PDFs are ephemeral** — Render's disk resets on restart/redeploy, so
>   mix-design/lab-report files uploaded after a deploy will 404 later. DB rows
>   persist (they're in Neon); only the blobs are lost. Fine for a demo.
> - **Cold starts** — the first request after idle takes ~40s while Render wakes.
> - **Gemini free tier is rate-limited** (requests/min + /day). Fine for a demo,
>   not production load.

---

## 1. Database — Neon

1. Create a project at <https://neon.tech> (free plan).
2. Copy the **connection string**. Use the **Direct** connection (not the
   `-pooler` one) to avoid asyncpg/PgBouncer prepared-statement issues.
   It looks like:
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
3. That's it — paste this whole string into the backend's `DATABASE_URL`. The app
   rewrites the scheme to `postgresql+asyncpg` and translates `sslmode` itself
   (`app/database/engine.py::normalize_database_url`). No manual edits needed.

Migrations run automatically on backend deploy (`scripts/start.sh` →
`alembic upgrade head`), which also creates the 5 schemas.

---

## 2. Backend — Render

**Option A — Blueprint (recommended).** The repo ships `render.yaml`.

1. Render Dashboard → **New → Blueprint** → connect this repo.
2. Render reads `render.yaml`, builds `backend/Dockerfile`, and prompts for the
   secrets marked `sync: false`. Fill them in:

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | Neon direct connection string (step 1) |
   | `FRONTEND_URL` | your Vercel URL (fill after step 3, then redeploy) |
   | `LLM_API_KEY` | Gemini key (step 4) |
   | `BREVO_API_KEY` | Brevo API key (see email note below) |
   | `MAIL_FROM` | your verified Brevo sender address |
   | `MAIL_USERNAME` / `MAIL_PASSWORD` | any placeholder (unused with Brevo, but required by config) |

   `SECRET_KEY` is auto-generated; `ENVIRONMENT=production`, `AI_PROVIDER=openai`,
   and `MAIL_PROVIDER=brevo` are preset.

   > **Email — why not Gmail SMTP?** Render's free tier **blocks outbound SMTP
   > ports** (25/465/587), so Gmail SMTP times out. The backend uses Brevo's HTTPS
   > email API instead (`MAIL_PROVIDER=brevo`). Create a free account at
   > [brevo.com](https://www.brevo.com), verify a sender email (set it as
   > `MAIL_FROM`), and generate an API key (Brevo → **SMTP & API → API Keys**) for
   > `BREVO_API_KEY`. Locally you can keep `MAIL_PROVIDER=smtp` with Gmail.

**Option B — manual.** New → **Web Service** → this repo → **Root Directory**
`backend`, **Runtime** Docker, **Health Check Path** `/health`, **Plan** Free.
Add the same env vars (see `backend/.env.sample` for the full list).

Render injects `$PORT`; the container's `scripts/start.sh` migrates then serves on
it. When live, note the URL, e.g. `https://strata-backend.onrender.com`.

> **CORS:** the backend only allows the origin in `FRONTEND_URL` (plus localhost).
> After the frontend is up, set `FRONTEND_URL` to the exact Vercel origin (no
> trailing slash) and redeploy, or browser calls will be blocked.

---

## 3. Frontend — Vercel

1. Vercel → **Add New → Project** → import this repo.
2. **Root Directory** = `frontend/react-app` (Vercel auto-detects Vite).
3. **Environment Variables** → add
   `VITE_API_BASE_URL = https://strata-backend.onrender.com/api/v1`
   (your Render URL + `/api/v1`). This is inlined at **build** time.
4. Deploy. `vercel.json` provides the SPA rewrite so deep links
   (`/auth/verify-otp`, `/external/lab-report`, …) resolve to `index.html`.
5. Copy the Vercel URL → set it as `FRONTEND_URL` on Render (step 2) and redeploy
   the backend.

If you change `VITE_API_BASE_URL` later, **redeploy** the frontend (build-time var).

---

## 4. AI — Google Gemini

1. Get a key at <https://aistudio.google.com/apikey> (free).
2. On Render set `LLM_API_KEY` = that key. `AI_PROVIDER=openai` is already set, so
   the analyst agent + RAG call Gemini's OpenAI-compatible endpoint. Defaults:
   `LLM_MODEL=gemini-2.5-flash`, `EMBED_MODEL=gemini-embedding-001` (override via env
   to switch models or providers — Groq/Cerebras/Mistral/OpenRouter also work by
   changing `LLM_BASE_URL`/`LLM_MODEL`).

---

## 5. Seed demo data (optional)

To get the demo logins (`client@skyline-demo.com` … password `Password123!`),
run the seed **locally against Neon** once — Render free has no shell:

```bash
cd backend
# point at the Neon DB just for this run (Git Bash / WSL):
UV_LINK_MODE=copy DATABASE_URL='postgresql://…neon…/neondb?sslmode=require' \
  uv run python scripts/seed_demo.py
```

(The seed doesn't call the AI provider, so no Gemini key is needed for it.)

---

## Smoke test

1. Open the Vercel URL → register or use a seeded login.
2. Watch for the first-request cold start (~40s) while Render wakes.
3. Try the Chatbot on a project → confirm Gemini answers (agent + charts).
4. Create a pour → dispatch → gate scan → cube flow to confirm the DB round-trips.

## What's deliberately not wired (free-tier scope)

- **Persistent file storage** — uploads are ephemeral. Add Cloudflare R2 / Supabase
  Storage behind `app/core/storage.py` (the interface is already S3-shaped) when
  persistence matters.
- **Always-on backend** — Render free sleeps. Koyeb's free instance stays warm if
  cold starts are a problem (swap the backend host; nothing else changes).
- **Content-Security-Policy** — `vercel.json` sets `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`, but no CSP. A
  useful CSP has to name the backend origin in `connect-src`, and that origin is
  a per-deploy build var (`VITE_API_BASE_URL`), so it can't be hardcoded here
  without breaking a differently-hosted backend. Worth adding once the backend
  host is stable — the refresh token lives in `localStorage` for 7 days, so a CSP
  is the main thing blunting a future XSS.
- **IP-based rate limiting** — per-account limits are in place (`/auth/login`
  locks after repeated failures, OTP attempts are capped, resend is throttled),
  but there is no request-level throttle, so a flood across *many* addresses is
  still unbounded. Needs middleware; see TASKS.md.
