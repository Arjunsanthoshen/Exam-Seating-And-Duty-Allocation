# Production Deployment Guide
## Exam Seating & Duty Allocation System

This guide outlines the production deployment architecture, environment variables, database initialization, and step-by-step deployment instructions for cloud platforms like **Render**, **Railway**, or containerized environments.

---

## 1. System Architecture Overview

- **Frontend**: React 19 Single Page Application (SPA).
  - Centralized API configuration via `REACT_APP_API_URL` (configured in [`frontend/src/api/config.js`](file:///home/arjun/Documents/miniproject/ExamSeating&DutyAllocation/frontend/src/api/config.js)).
  - Production build output: `frontend/build`.
  - Supports client-side routing (redirect all unmatched paths to `index.html`).
- **Backend**: Node.js & Express API.
  - Connection pooling with automatic reconnection and SSL support for cloud databases.
  - Dynamic on-the-fly PDF report recovery for ephemeral container filesystems.
  - Health check endpoint: `GET /api/health`.
  - Supports single-service deployment (Express serving `frontend/build`) or decoupled split deployment.
- **Database**: MySQL 8.0+ / MariaDB 10.4+.
  - Fully defined schema across all 13 core tables in [`backend/database/schema.sql`](file:///home/arjun/Documents/miniproject/ExamSeating&DutyAllocation/backend/database/schema.sql).
  - Automated zero-downtime migration and initial admin account bootstrapping in [`backend/database/init_db.js`](file:///home/arjun/Documents/miniproject/ExamSeating&DutyAllocation/backend/database/init_db.js).

---

## 2. Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `PORT` | Optional | Port on which Express listens | `5000` (Render defaults to `10000`) |
| `NODE_ENV` | Recommended | Environment mode | `production` |
| `JWT_SECRET` | **Required** | Secret key for signing auth tokens (enforced in production) | `super_secure_random_key_here` |
| `FRONTEND_URL` / `CORS_ORIGIN` | **Required** | Origin(s) allowed by CORS (comma-separated if multiple) | `https://exam-seating-frontend.onrender.com` |
| `MYSQL_URL` / `DATABASE_URL` | Optional* | Full MySQL connection URI (preferred on Railway/Aiven) | `mysql://user:pass@host:3306/college` |
| `DB_HOST` | Optional* | MySQL host (if `MYSQL_URL` not used) | `mysql.railway.internal` / `localhost` |
| `DB_PORT` | Optional* | MySQL port | `3306` |
| `DB_USER` | Optional* | MySQL user | `root` |
| `DB_PASSWORD` | Optional* | MySQL password | `your_db_password` |
| `DB_NAME` | Optional* | MySQL database name | `college` |
| `DB_SSL` | Optional | Enable SSL connection to database | `true` (for cloud MySQL) |
| `ADMIN_EMAIL` | Optional | Initial admin email bootstrapped by `db:init` | `admin@sjcetpalai.ac.in` |
| `ADMIN_PASSWORD` | Optional | Initial admin password bootstrapped by `db:init` | `Admin@Exam2026!` |

*\* Either provide `MYSQL_URL` OR provide discrete `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.*

### Frontend (`frontend/.env`)

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `REACT_APP_API_URL` | **Required** | Backend API base URL | `https://exam-seating-backend.onrender.com` |

---

## 3. Database Migration & Initialization

Before starting the application, run the automated database initialization script. This runs `schema.sql` to create all tables and bootstraps the initial administrator account:

```bash
# From repository root:
npm run db:init

# Or directly in backend:
npm run db:init --prefix backend
```

> [!NOTE]
> To seed development test data (batches, teachers, exam schedules) for local staging, run `npm run db:seed`. (Protected: disabled by default in production unless `FORCE_DEV_SEED=true`).

---

## 4. Deploying to Render (Recommended)

### Option A: Automatic Blueprint Deployment (`render.yaml`)
1. Push this repository to GitHub.
2. Log into the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Select your repository. Render will automatically parse [`render.yaml`](file:///home/arjun/Documents/miniproject/ExamSeating&DutyAllocation/render.yaml) and configure:
   - Backend Web Service (`exam-allocation-backend`)
   - Frontend Static Site (`exam-allocation-frontend`)
5. Under Environment Variables, link your MySQL database credentials (`MYSQL_URL` or `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`).
6. Deploy!

### Option B: Manual Service Creation on Render

#### Step 1: Managed MySQL Database
Create a MySQL database (e.g. on [Railway](https://railway.app), [Aiven](https://aiven.io), or [PlanetScale](https://planetscale.com)) and copy the connection URL.

#### Step 2: Backend Web Service
1. In Render, click **New +** -> **Web Service**.
2. Settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/api/health`
3. Add Environment Variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=<generate a secure 32+ char key>`
   - `MYSQL_URL=<your cloud mysql URI>`
   - `DB_SSL=true`
   - `FRONTEND_URL=<your frontend render URL>`
4. In Render's **Shell** tab or locally with the remote connection string, run `npm run db:init` to populate tables.

#### Step 3: Frontend Static Site
1. In Render, click **New +** -> **Static Site**.
2. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
3. Add Environment Variable:
   - `REACT_APP_API_URL=https://<your-backend-slug>.onrender.com`
4. Add Rewrite Rule:
   - Under **Redirects/Rewrites**:
     - `/*` -> `/index.html` (Type: `Rewrite`)

---

## 5. Verification & Health Monitoring

Once deployed:
1. Verify API health check:
   ```bash
   curl -I https://<your-backend-slug>.onrender.com/api/health
   # Expected: HTTP 200 OK {"status":"ok","database":"connected",...}
   ```
2. Log into the admin portal using the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Generate reports to confirm dynamic PDF compilation.

---

## 6. Puppeteer / Chrome on Render — How It Works

PDF generation uses [Puppeteer](https://pptr.dev/) which requires a Chromium binary.

### Why a special setup is needed

Render's **free tier web services** have an ephemeral filesystem: the `~/.cache` home directory (where Puppeteer defaults to storing Chrome) **is not guaranteed to persist** from the build container to the running container. This causes `chrome not found` errors at runtime even though the build succeeded.

### The fix (`backend/scripts/install-chrome.js` + in-project cache)

1. `backend/scripts/install-chrome.js` explicitly sets `PUPPETEER_CACHE_DIR` to `backend/.cache/puppeteer` and installs Chrome. This guarantees Chrome is written to `/opt/render/project/src/backend/.cache/puppeteer`, which survives the container transition.
2. Both `.puppeteerrc.cjs` (root) and `backend/.puppeteerrc.cjs` point to `backend/.cache/puppeteer`.
3. In `backend/server.js`, `PUPPETEER_CACHE_DIR` is initialized to `path.resolve(__dirname, ".cache", "puppeteer")` at the very top before Puppeteer is loaded, ensuring that running `node backend/server.js` from the repository root always resolves the in-project cache.
4. `server.js` features a multi-tiered fallback resolver (`resolveChromeExecutable`) that inspects the in-project cache, user cache, and system Chromium paths before launching.

The `buildCommand` in `render.yaml` runs `node backend/scripts/install-chrome.js` to ensure Chrome is always installed to this exact location during build.

### Troubleshooting PDF generation failures

If PDF generation fails on Render, check the service logs for `[PDF]` lines:
- **`[PDF] Chrome executable could not be found...`** — Chrome was not installed to the expected path during build. Re-deploy the service (triggering a fresh build) and verify the build log shows `[Puppeteer Install] Chrome successfully installed into: /opt/render/project/src/backend/.cache/puppeteer`.
- **`[PDF] Launching Chrome: /opt/render/project/src/backend/.cache/puppeteer/chrome/...`** — Chrome found and PDF generation initialized successfully.

To manually override the Chrome path (e.g. to use a system-installed Chromium), set the `PUPPETEER_EXECUTABLE_PATH` environment variable in the Render dashboard.
