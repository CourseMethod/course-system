# Deployment

Getting it onto the internet. Pick one platform, follow that section, ignore the rest.

Deeper edge cases, custom domains, backups and rollback: **[docs/Deployment-Guide.md](docs/Deployment-Guide.md)**.

---

## Read this first — the two things that break deployments

### 1. Your database must be on a persistent disk

The backend stores customers in a SQLite file. On most platforms, **the default filesystem
is wiped on every deploy.**

That means: you deploy, take 30 sales, push a small copy fix, and your entire customer list
is gone. No warning, no error.

Every platform section below tells you how to mount a volume. **Do not skip it.**

### 2. Vercel and Netlify cannot run this backend

They are serverless — no persistent filesystem, no long-lived process. They are excellent
for the sales page alone, and they cannot host the database or serve the ZIP.

If you want to use them, put the static page there and the backend elsewhere. See the
split deployment section at the end.

---

## Choosing a platform

| Platform | Persistent disk | Free tier | Difficulty | Recommended for |
|----------|-----------------|-----------|------------|-----------------|
| **Railway** | Yes, volumes | Trial credit | Easiest | Most people |
| **Render** | Yes, disks | Yes (sleeps) | Easy | Free option |
| **Fly.io** | Yes, volumes | Small allowance | Medium | Control |
| **VPS** | Yes, it's a disk | ~£5/mo | Hard | You know Linux |
| Vercel/Netlify | **No** | Generous | Easy | Sales page only |

**If you are unsure: Railway.** It is the shortest path from here to working.

---

## Railway

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

**Check `.env` is not in there** before you push:

```bash
git status --ignored | grep .env
```

It should appear under ignored files. If it appears as staged, stop and fix `.gitignore`.
A Stripe secret key in a public repo is found by bots within minutes.

Then create a repo on GitHub and push.

### 2. Create the service

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Pick your repo
3. **Settings → Root Directory:** `backend`
4. It detects Node and runs `npm start`

### 3. Add a volume — do not skip this

1. Your service → **Variables** tab is next; first go to **Settings → Volumes**
2. **Add Volume**, mount path `/data`
3. Then set `DATABASE_PATH=/data/course-printer.db` in Variables

Without this, every deploy wipes your customers.

### 4. Environment variables

Paste each line from your `.env` into **Variables**. Then override:

```
NODE_ENV=production
PUBLIC_URL=https://your-app.up.railway.app
CORS_ORIGINS=https://your-app.up.railway.app
DATABASE_PATH=/data/course-printer.db
LOG_JSON=true
```

Railway sets `PORT` itself — do not set it.

### 5. Build the vault into the image

The ZIP must exist on the server. Add to `backend/package.json`:

```json
"scripts": {
  "postinstall": "npm run build-vault || true"
}
```

The `|| true` means a build failure does not block the deploy — check the readiness probe
afterwards to confirm the file exists.

Alternative: commit the ZIP to git. Simpler, and fine if it is under ~50 MB.

### 6. Point Stripe at it

Stripe → Webhooks → Add endpoint → `https://your-app.up.railway.app/api/webhook`

Copy the new signing secret into Railway's variables. **It is different from your local
one.**

### 7. Verify

```
https://your-app.up.railway.app/api/health/ready
```

Should return `"status": "ready"` with all checks true. If `deliverable` is false, the ZIP
did not build — see step 5.

---

## Render

### 1. Create the service

1. [render.com](https://render.com) → New → Web Service → connect your repo
2. **Root Directory:** `backend`
3. **Build Command:** `npm install && npm run build-vault`
4. **Start Command:** `npm start`

### 2. Add a disk

**Settings → Disks → Add Disk**
- Mount path: `/data`
- Size: 1 GB is plenty

Then `DATABASE_PATH=/data/course-printer.db`.

### 3. Environment

Same as Railway. `PUBLIC_URL=https://your-app.onrender.com`.

### 4. The free tier sleeps — this matters

Render's free tier spins down after 15 minutes idle and takes ~30 seconds to wake.

**Consequences:**
- A visitor hits a 30-second blank page
- **A Stripe webhook may time out** — Stripe retries, so the sale is not lost, but delivery
  is delayed

Mitigations:
- Upgrade to the paid tier (~$7/mo) before driving real traffic
- Or ping `/api/health/live` every 10 minutes from an uptime monitor

For a live business, pay the $7.

---

## Fly.io

Best control, more setup. `fly.toml` in `backend/`:

```toml
app = "your-course"
primary_region = "lhr"

[build]
  builder = "heroku/buildpacks:20"

[env]
  NODE_ENV = "production"
  DATABASE_PATH = "/data/course-printer.db"

[[mounts]]
  source = "course_data"
  destination = "/data"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false      # keep it awake for webhooks
  min_machines_running = 1

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/api/health/live"
```

```bash
fly launch --no-deploy
fly volumes create course_data --size 1
fly secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
  TOKEN_SECRET=... ADMIN_TOKEN=... SMTP_PASSWORD=...
fly deploy
```

**`auto_stop_machines = false` matters.** A stopped machine misses webhooks.

---

## A plain VPS

For £5/month you get full control and full responsibility.

```bash
# On the server
sudo apt update && sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
sudo npm install -g pm2

git clone your-repo /var/www/course
cd /var/www/course/backend
npm install --production
npm run build-vault

# Create .env with your production values, then:
pm2 start server.js --name course
pm2 save
pm2 startup          # follow the printed instruction
```

Nginx reverse proxy at `/etc/nginx/sites-available/course`:

```nginx
server {
  listen 80;
  server_name yourdomain.com www.yourdomain.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Course ZIPs can be large and slow on poor connections
    proxy_read_timeout 300s;
  }

  # Stripe webhooks must arrive unmodified
  client_max_body_size 2m;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/course /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Back up the database yourself** — nobody else will:

```bash
# crontab -e
0 3 * * * sqlite3 /var/www/course/backend/data/course-printer.db ".backup '/backups/db-$(date +\%F).db'"
```

---

## Split deployment — static page on a CDN

If you want the page on Vercel/Netlify and the backend elsewhere:

1. Deploy `web/` to Vercel or Netlify
2. Deploy `backend/` to Railway/Render/Fly
3. In `web/index.html`, `success.html` and `admin.html`, change:
   ```js
   var API = '/api';
   ```
   to your backend's URL:
   ```js
   var API = 'https://api.yourdomain.com/api';
   ```
4. **Set `CORS_ORIGINS` on the backend to your front-end domain**, or every request is
   blocked by the browser.

This is more moving parts for a marginal gain at small scale. Single deployment is simpler
and fast enough.

---

## Custom domain

1. Buy it (Namecheap, Porkbun, Cloudflare)
2. Add it in your platform's dashboard — they give you a DNS target
3. Add the record at your registrar:
   - `CNAME` for `www` → the target
   - `A` or `ALIAS` for the apex, per your platform's instructions
4. Wait for propagation — minutes to a few hours
5. **Update `PUBLIC_URL` and `CORS_ORIGINS`** to the new domain
6. **Update your Stripe webhook URL**
7. Confirm HTTPS works — every platform above issues certificates automatically

Step 6 is the one people forget. Webhooks silently stop, sales stop being fulfilled, and
the first sign is an angry email.

---

## The email sequence needs a scheduler

Delivery is automatic. The day-2 onwards emails need something to trigger them.

Simplest option — a scheduled job that hits an endpoint you add, or a platform cron:

| Platform | How |
|----------|-----|
| Railway | Cron service in the same project |
| Render | Cron Job service |
| Fly | `fly machine run` on a schedule |
| VPS | `crontab` |

Until you set this up, only the delivery email sends. That is the one that matters most,
so it is not urgent — but the day-7 check-in is the highest-leverage email in the sequence,
so do not leave it forever.

---

## After every deploy

```
1. https://yourdomain.com/api/health/ready     → all checks true
2. Load the sales page                         → prices appear
3. https://yourdomain.com/admin.html           → token works
4. Stripe → Webhooks → your endpoint           → recent deliveries succeeding
5. Make a test purchase                        → email arrives, link works
```

Five minutes. It catches the deploys that look fine and are not.

---

## If it breaks

**[docs/Troubleshooting.md](docs/Troubleshooting.md)** covers the specific failures:
webhooks returning 400, CORS errors, missing ZIP, database gone after deploy, emails in
spam.

Start with `/api/health/ready` — it tells you which subsystem is unhappy.
