# Deployment guide — edge cases and operations

`DEPLOYMENT.md` in the root covers the happy path for each platform. This file covers what
happens after: domains, certificates, backups, rollback, zero-downtime, and the failures
that only show up in production.

---

## Pre-flight

Run these before every deploy. Two minutes, and it catches most bad deploys.

```bash
npm run check-env      # config validity
npm run test:smoke     # against a local run
npm run build-vault    # confirm the ZIP builds and leaks nothing
git status --ignored | grep "\.env"     # must be IGNORED, not staged
```

---

## Custom domains

### DNS records

| Record | Host | Points to | For |
|--------|------|-----------|-----|
| `CNAME` | `www` | platform target | www subdomain |
| `A` / `ALIAS` | `@` | platform IP/target | apex domain |

Apex domains cannot use CNAME under the DNS spec. Platforms work around it with `ALIAS` or
`ANAME` records — use whatever yours documents. Cloudflare's "CNAME flattening" also solves
it.

### Pick one canonical form

Decide whether you are `yourdomain.com` or `www.yourdomain.com` and redirect the other.
Running both without a redirect splits your analytics and causes CORS confusion.

### After changing a domain — the checklist people miss

1. `PUBLIC_URL` → new domain
2. `CORS_ORIGINS` → new domain (**include both apex and www** if both resolve)
3. **Stripe webhook URL** → new domain
4. Any links in your email templates
5. Redeploy

**Step 3 is the one that catches people.** Webhooks silently stop, sales stop being
fulfilled, and the first sign is an angry customer.

### Propagation

Minutes to 48 hours, usually under an hour. Check with:

```bash
dig yourdomain.com
dig www.yourdomain.com
```

Do not change your domain on launch day.

---

## HTTPS

Every platform in the main guide issues and renews certificates automatically. On a VPS:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot renew --dry-run     # confirm auto-renewal works
```

Certbot installs a renewal timer. **Test it with `--dry-run`** — a certificate that expires
silently takes your site down completely, and it happens at 3am ninety days later.

### Mixed content

If the page loads over HTTPS but resources over HTTP, browsers block them. Everything in
this system uses relative URLs or HTTPS, so this only arises if you have added something.
Check the console.

---

## Environment variables across environments

Keep three separate sets, and never share secrets between them:

| | Local | Staging | Production |
|---|---|---|---|
| `NODE_ENV` | development | production | production |
| Stripe keys | test | test | **live** |
| Webhook secret | from `stripe listen` | staging endpoint | **live endpoint** |
| Database | local file | staging volume | production volume |
| Email | console | a real provider, to yourself | real |

**Each Stripe webhook endpoint has its own signing secret.** Copying production's secret to
staging means staging rejects everything, and vice versa.

---

## Backups

### What actually matters

Your **customer list**. Everything else is rebuildable in an evening.

### Automated database backup

**VPS:**

```bash
# crontab -e
0 3 * * * sqlite3 /var/www/course/backend/data/course-printer.db \
  ".backup '/backups/db-$(date +\%F).db'" && \
  find /backups -name 'db-*.db' -mtime +30 -delete
```

Use `.backup`, not `cp`. Copying a live SQLite file while it is being written produces a
corrupt backup, and you find out when you try to restore it.

**Platforms with volumes:** check whether snapshots are included. Railway and Fly offer
them; do not assume.

### The backup that always works

```
Dashboard → Export CSV → store it somewhere that is not the server
```

Monthly. One click. It is not a full backup — no email history, no events — but it is your
customer list, which is the business.

### Test your restore

An untested backup is a guess.

```bash
sqlite3 /backups/db-2026-09-01.db "SELECT COUNT(*) FROM customers;"
```

Do this once a quarter. Finding out a backup is empty during an incident is the worst
possible time.

---

## Rollback

### Platform rollback

Railway, Render and Fly all keep previous deploys and offer one-click rollback. Use it —
it is faster than debugging under pressure.

### What rollback does not undo

**Database migrations.** This system's migrations are additive (new tables, new indexes),
so rolling back code against a newer schema is safe. If you ever write a destructive
migration, that stops being true — which is why the migration list is append-only and
documented as such.

### Rolling back secrets

If you rotated `TOKEN_SECRET` and rolled back, every download link issued in between is now
invalid. Expect resend requests. See Troubleshooting [#13].

---

## Zero-downtime deploys

At this scale, a few seconds of downtime during deploy is genuinely fine. Stripe retries
webhooks; a visitor refreshes.

If you want it anyway:

**Platform-managed:** Railway, Render and Fly do rolling deploys by default when you have
more than one instance — but **SQLite does not support multiple writers**, so you cannot
scale to two instances without moving to Postgres first. See `Scaling-Guide.md`.

**VPS with pm2:**

```bash
pm2 reload course     # reload, not restart — waits for in-flight requests
```

`reload` drains connections gracefully. `restart` kills them mid-response.

The app handles `SIGTERM` properly: it stops accepting new connections, finishes in-flight
requests, checkpoints the database and exits. A 15-second backstop prevents a hang.

---

## The scheduler for follow-up emails

Only the delivery email is automatic. The rest need triggering.

### Option 1 — platform cron

| Platform | How |
|----------|-----|
| Railway | Add a Cron service to the project |
| Render | New → Cron Job |
| Fly | `fly machine run --schedule` |
| VPS | `crontab` |

Point it at a script that queries customers by `created_at` age and sends the matching
template.

### Option 2 — an in-process timer

Simpler, and it stops when the process stops. Acceptable if your host does not sleep.

### Option 3 — your email provider's automation

MailerLite, Kit and similar have built-in sequences. Push the customer to a list on
purchase and let the provider handle timing. **Often the least work**, and worth
considering before building anything.

---

## Monitoring

### Uptime

Point a free monitor (UptimeRobot, Better Stack) at:

```
https://yourdomain.com/api/health/live
```

Every 5 minutes. On Render's free tier this doubles as a keep-alive.

**Use `/live`, not `/ready`.** Readiness checks Stripe, and a Stripe blip would page you
about something you cannot fix.

### What to alert on

| Signal | Why |
|--------|-----|
| `/api/health/live` failing | The process is down |
| `/api/health/ready` failing for >10 min | A dependency is genuinely broken |
| Admin alert emails | The system tells you about failed deliveries itself |
| Stripe webhook failure rate | Stripe's dashboard shows this |

### Logs

Set `LOG_JSON=true` in production so your host's log search works. Every line carries a
`requestId`, and every response carries it in `X-Request-Id` — so a customer's
"it broke at 14:32" becomes a single search.

Secrets are redacted on both key name and value shape, so a Stripe key caught in an
unexpected field is still masked.

---

## Deploying the vault ZIP

The ZIP must exist on the server or downloads fail with 503.

**Option A — build on deploy** (keeps the repo small):

```json
"scripts": { "postinstall": "npm run build-vault || true" }
```

Requires `zip` on the build image. Most Node buildpacks have it; if not, use option B.

**Option B — commit it** (simplest, reliable):

```bash
npm run build-vault
git add -f backend/dist/*.zip
git commit -m "Build vault v1.0"
```

Fine under ~50 MB. Remember to rebuild and recommit when you update the course.

**Verify either way:**

```bash
curl https://yourdomain.com/api/health/ready | grep deliverable
```

---

## Post-deploy checklist

```
[ ] /api/health/ready → all checks true
[ ] Sales page loads, prices appear (not "Loading pricing…")
[ ] /admin.html accepts your token
[ ] Stripe → Webhooks → recent deliveries succeeding
[ ] Test purchase → email arrives → link works → ZIP opens
[ ] Refund the test purchase → link stops working
```

Five minutes. It catches the deploys that look fine and are not.

---

## Common production-only failures

| Symptom | Cause |
|---------|-------|
| Works locally, 500s in production | Missing env var. Check startup logs |
| Webhooks 400 in production only | Wrong signing secret — live endpoint has its own |
| CORS errors only in production | `CORS_ORIGINS` missing the www or apex variant |
| Rate limiting blocks everyone | `trust proxy` wrong for your proxy count |
| Database empty after deploy | Not on a persistent volume |
| Downloads 503 | ZIP did not build |
| Emails work locally, not deployed | Host blocks outbound SMTP — use an HTTP API |

All of these are in `Troubleshooting.md` with fixes.
