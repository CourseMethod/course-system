# Troubleshooting

Find your symptom. Each entry has the cause and the fix.

**Start here regardless of the problem:**

```bash
npm run check-env                              # config problems, with fixes
curl https://yourdomain.com/api/health/ready   # which subsystem is unhappy
```

The readiness probe tells you whether the database, the course ZIP or Stripe is the
problem, which usually narrows it to one section below.

---

## Contents

**Setup** — [1](#1) [2](#2) [3](#3) [4](#4)
**Stripe & payments** — [5](#5) [6](#6) [7](#7) [8](#8) [9](#9) [10](#10)
**Delivery & downloads** — [11](#11) [12](#12) [13](#13) [14](#14)
**Email** — [15](#15) [16](#16) [17](#17) [18](#18)
**Deployment** — [19](#19) [20](#20) [21](#21) [22](#22) [23](#23)
**Dashboard & data** — [24](#24) [25](#25) [26](#26)
**Customer-reported** — [27](#27) [28](#28) [29](#29)

---

## Setup

### <a id="1"></a>1. The server will not start

**Symptom:** it exits immediately with a list of configuration problems.

That is by design — it refuses to start misconfigured rather than failing silently later.

**Fix:** read the list. Every entry says what is wrong and how to fix it. Then:

```bash
npm run check-env
```

If you have not created `.env` yet: `cp .env.example .env`.

---

### <a id="2"></a>2. `Error: Cannot find module 'better-sqlite3'`

**Cause:** dependencies not installed, or installed for a different Node version.

`better-sqlite3` is a native module — it compiles against your specific Node version.

**Fix:**

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

If it fails to compile, you need build tools:

- **macOS:** `xcode-select --install`
- **Ubuntu/Debian:** `sudo apt install build-essential python3`
- **Windows:** use WSL. Native builds on Windows are genuinely painful.

---

### <a id="3"></a>3. `SQLITE_CANTOPEN: unable to open database file`

**Cause:** the directory in `DATABASE_PATH` does not exist, or is not writable.

**Fix:** the server creates the directory on first run, so this usually means a permissions
problem or a path typo.

```bash
mkdir -p ./data
ls -la ./data          # check you can write to it
```

On a platform, check the volume is actually mounted at the path you configured.

---

### <a id="4"></a>4. `EADDRINUSE: address already in use`

**Cause:** something is already on that port — usually a previous instance you thought you
stopped.

**Fix:**

```bash
lsof -i :3000           # find it
kill <PID>
```

Or just use another port: `PORT=3001 npm start`.

---

## Stripe and payments

### <a id="5"></a>5. Every webhook returns 400

**This is the single most common Stripe integration bug.** If all your webhooks fail with
a signature error, it is almost certainly this.

**Cause:** a JSON body parser ran before the webhook route.

Stripe signs the exact bytes it sent. `express.json()` consumes the stream and hands you a
parsed object; re-serialising produces different bytes, so the signature never verifies.

**Fix:** the webhook route must be mounted **before** `express.json()`, with a raw body
parser. In `server.js`:

```js
app.use('/api', webhookRoutes);        // ← raw body, MUST be first
app.use(express.json({ limit: '64kb' }));
```

If you have reordered these, move it back.

**Other causes of 400 on webhooks:**

- `STRIPE_WEBHOOK_SECRET` is wrong — the **live** endpoint has a different secret from
  your test endpoint and from `stripe listen`
- A proxy is modifying the body. Check nginx is not rewriting anything.

---

### <a id="6"></a>6. Payment succeeds but no customer appears

**Cause:** the webhook is not reaching you, or is failing.

**Diagnose, in order:**

1. **Stripe Dashboard → Developers → Webhooks → your endpoint.** Look at recent
   deliveries. What status?
   - **No deliveries at all** → the endpoint URL is wrong, or does not exist
   - **400** → see [#5](#5)
   - **500** → your handler threw. Check `/api/admin/health/failures`
   - **Timeout** → your server was asleep. See [#20](#20)
2. **Check the Failures tab** in the dashboard
3. **Check the events are subscribed.** You need `checkout.session.completed` at minimum

**Recovering a lost sale:** Stripe retries for up to three days, so it usually
self-corrects. If not, find the payment in Stripe, get the email, and use the dashboard to
create the record manually — or use **Resend** after adding them.

---

### <a id="7"></a>7. Checkout button does nothing

**Diagnose:** open browser devtools → Console.

| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to fetch` | Backend unreachable | Is the server running? Is `API` set right? |
| CORS error | Origin not allowed | See [#21](#21) |
| 400 with `validation_error` | Bad tier name | Should be `method` or `engine` |
| 429 | Rate limited | Wait 10 minutes. Normal if you have been testing |
| 409 `cohort_full` | The cohort cap is reached | Raise or clear `ENGINE_COHORT_LIMIT` |

---

### <a id="8"></a>8. "No such price" or "Invalid API key"

**Cause:** mixing test and live keys.

**Fix:** `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` must **both** be test or **both**
be live. The config validator catches this at startup — if it did not, you are running an
old build.

---

### <a id="9"></a>9. Customers charged but the page said it failed

**Cause:** the browser lost the connection after payment but before the redirect.

**This is fine.** The webhook fulfils independently of the browser. The customer is
recorded and emailed regardless of what their tab showed.

**Fix:** nothing technical. Reply to the customer confirming, and point them at the resend
form.

---

### <a id="10"></a>10. Refund issued in Stripe but access still works

**Cause:** the `charge.refunded` webhook is not subscribed, or is failing.

**Fix:**

1. Stripe → Webhooks → your endpoint → confirm `charge.refunded` is in the event list
2. Check the Failures tab
3. Manually: the customer's status in the dashboard should be `refunded`. If it is not,
   the webhook did not arrive.

---

## Delivery and downloads

### <a id="11"></a>11. Download returns 503 "temporarily unavailable"

**Cause:** the course ZIP does not exist on the server.

**Fix:**

```bash
npm run build-vault
curl https://yourdomain.com/api/health/ready    # "deliverable" should be true
```

On a platform, the build step must run on deploy. Add to `package.json`:

```json
"scripts": { "postinstall": "npm run build-vault || true" }
```

Or commit the ZIP to git if it is under ~50 MB.

**Meanwhile:** the dashboard's Resend gives you a link to send manually, and the customer
gets a message saying it is your fault, not theirs.

---

### <a id="12"></a>12. "This download link has expired"

**Working as designed.** Links last 72 hours by default.

**Fix for the customer:** the resend form on the success page and in the footer. Instant,
free, unlimited.

**If it is happening a lot:** raise `DOWNLOAD_TOKEN_TTL_HOURS`. Be generous — a locked-out
paying customer costs you a refund, and piracy is not meaningfully prevented by a short
expiry.

---

### <a id="13"></a>13. All download links stopped working at once

**Cause:** `TOKEN_SECRET` changed. Every link signed with the old value is now invalid.

**Fix:** you cannot recover the old links. Either restore the previous `TOKEN_SECRET`, or
accept it and handle the resend requests cheerfully.

**Prevention:** treat `TOKEN_SECRET` as permanent. Rotate it only deliberately, knowing
this happens.

---

### <a id="14"></a>14. The ZIP downloads corrupted

**Causes, in order of likelihood:**

1. **Compression applied to the ZIP.** `server.js` excludes `/api/download/` from the
   compression middleware. If you removed that filter, put it back.
2. **A proxy buffering a large response.** Raise `proxy_read_timeout` in nginx.
3. **The file on disk is genuinely corrupt.** `unzip -t dist/course-printer-vault.zip`

---

## Email

### <a id="15"></a>15. No emails are sending at all

**Check the transport first:**

```bash
npm run check-env | grep -i "email transport"
```

If it says `console (nothing is sent)`, that is your answer — set `EMAIL_TRANSPORT=smtp`
and configure it.

**If configured and still failing:** the server verifies the transport at startup. Look for
`Email transport FAILED to verify` in your logs, with the underlying error.

| Error | Fix |
|-------|-----|
| `Invalid login` | Wrong credentials. Gmail needs an App Password, not your password |
| `ECONNREFUSED` | Wrong host or port. 587 with `SMTP_SECURE=false`, or 465 with `true` |
| `ETIMEDOUT` | Your host blocks outbound SMTP. Use an HTTP-based API instead |
| `Sender not verified` | Verify your sending domain in the provider's dashboard |

---

### <a id="16"></a>16. Emails go to spam

The most common cause of "I paid and got nothing", and the most important thing on this
page to fix properly.

**In order of impact:**

1. **Set up SPF, DKIM and DMARC.** Three DNS records. Not optional — Gmail and Outlook
   increasingly reject unauthenticated mail outright. Your provider walks you through it.
2. **Send from a domain you own.** Not `@gmail.com`. You cannot authenticate a domain you
   do not control.
3. **Use a real sending service.** Postmark, Resend, SES. Not Gmail SMTP.
4. **Test at [mail-tester.com](https://mail-tester.com).** Free, scores out of 10, tells
   you exactly what is missing. Aim for 9+.
5. **Keep delivery email plain.** No images, no promotional language, no marketing
   formatting. This system's delivery template is deliberately austere.
6. **Always send plain text alongside HTML.** HTML-only is a strong spam signal. This
   system always does.

**Warm up gradually** if you are on a new domain — do not send 500 emails on day one.

---

### <a id="17"></a>17. Open rates look impossibly high or low

**This is expected, and open rate is not trustworthy.**

Apple Mail Privacy Protection and most corporate gateways pre-fetch images, registering
opens nobody performed. Depending on your audience, 20–60% of recorded opens may be
machines.

**Fix:** use open rate as a relative trend between campaigns, never as an absolute. **Click
rate is far more reliable.** The dashboard says this on the Email tab for the same reason.

---

### <a id="18"></a>18. The follow-up emails never send

**Cause:** only the delivery email is automatic. The rest need a scheduler.

**Fix:** set up a cron job or platform scheduled task. See the scheduler section in
`DEPLOYMENT.md`.

Until then, delivery works — which is the one that matters most. But the day-7 check-in is
the highest-leverage email in the sequence, so do not leave it indefinitely.

---

## Deployment

### <a id="19"></a>19. All my customers disappeared after a deploy

**Cause:** your database is on an ephemeral filesystem, which is wiped on every deploy.

**This is the most expensive mistake in this document.**

**Fix:**

1. Mount a persistent volume (Railway Volumes, Render Disks, Fly Volumes)
2. Set `DATABASE_PATH` to a path inside it, e.g. `/data/course-printer.db`
3. Deploy twice and confirm data survives

**Recovery:** if you have no backup, reconstruct from Stripe — every payment is there with
the customer email. Tedious, but nothing is truly lost.

**Prevention:** export the customer CSV monthly and store it off the server.

---

### <a id="20"></a>20. Webhooks time out intermittently

**Cause:** your host's free tier sleeps when idle and takes ~30 seconds to wake. A webhook
arriving during that window times out.

**Fix:**

- **Railway:** generally does not sleep on paid plans
- **Render free:** upgrade (~$7/mo), or ping `/api/health/live` every 10 minutes from an
  uptime monitor
- **Fly:** set `auto_stop_machines = false`

**Not urgent for correctness** — Stripe retries for three days — but it delays delivery,
and a customer waiting 30 minutes for their course is a customer considering a refund.

---

### <a id="21"></a>21. CORS errors after deploying

**Symptom:** the page loads but nothing works. Console shows
*"blocked by CORS policy"*.

**Cause:** `CORS_ORIGINS` does not include the origin the page is served from.

**Fix:** set it to your exact domains, comma separated, **with protocol and no trailing
slash**:

```
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

`www.` and the apex are **different origins**. Include both if both resolve.

Check your server logs — a blocked request logs `Blocked cross-origin request` with the
origin it saw. Copy that value exactly.

**Never set `*`.** The config validator rejects it.

---

### <a id="22"></a>22. Server refuses to start in production

**Symptom:** works locally, exits on the platform.

**Most likely causes:**

| Message | Fix |
|---------|-----|
| `STRIPE_SECRET_KEY is a TEST key but NODE_ENV=production` | Use live keys, or set `NODE_ENV=development` |
| `PUBLIC_URL must use https://` | Set it to your real domain |
| `CORS_ORIGINS must list your domain(s)` | Set it. Empty fails closed in production |
| `TOKEN_SECRET must be at least 32 characters` | `npm run create-admin-token` |
| `still contains a placeholder value` | You copied `.env.example` and did not edit it |

All of these are deliberate. Each one is a failure that would otherwise be silent and
expensive.

---

### <a id="23"></a>23. Rate limiting blocks everyone, or nobody

**Cause:** `trust proxy` is wrong.

Behind a proxy, `req.ip` is the proxy's address unless configured. Every visitor looks like
one client, so the limiter blocks everyone at once.

**Fix:** `server.js` sets `app.set('trust proxy', 1)` — one hop. That is correct for
Railway, Render, Fly and a single nginx.

If you have two proxies (Cloudflare **and** nginx), set it to `2`. **Do not set `true`** —
that lets a client spoof `X-Forwarded-For` and bypass rate limiting entirely.

---

## Dashboard and data

### <a id="24"></a>24. Admin dashboard says the token was rejected

**Check:**

1. You are pasting `ADMIN_TOKEN`, not `TOKEN_SECRET`
2. No trailing whitespace — a copied newline is a common culprit
3. The token is actually set on the platform, not just in your local `.env`
4. You have not hit the rate limit — 20 attempts per 15 minutes. Wait it out.

---

### <a id="25"></a>25. The dashboard is empty but I have sales

**Cause:** usually you are looking at a different database than you think.

**Check:**

```bash
npm run check-env | grep Database
```

Confirm that path is the mounted volume, not a local file. A common case: the server
started before a volume was mounted, so it is holding a handle to a file that is no longer
reachable at that path. **Restart the service.**

---

### <a id="26"></a>26. `SQLITE_BUSY: database is locked`

**Cause:** two processes writing at once.

**Fix:** the database runs in WAL mode with a 5-second busy timeout, so this should be
rare.

If it persists, you are almost certainly running **two instances** against one file —
check you have not scaled to 2+ replicas. SQLite does not support that. See
`Scaling-Guide.md`.

---

## Customer-reported problems

### <a id="27"></a>27. "I paid and got nothing"

**The one to handle fastest.** Every hour raises the chance of a chargeback.

**Diagnose, in order:**

1. **Dashboard → search their email.** Do they exist?
   - **No** → the webhook failed. See [#6](#6). Find the payment in Stripe.
   - **Yes** → continue
2. **Their customer detail page → emails.** Was one sent?
   - **Failed** → see [#15](#15). Use **Resend**.
   - **Sent** → it is a deliverability problem. See [#16](#16).
3. **Reply immediately** with a direct link. Do not wait until you have diagnosed it.

**Template:**

```
Hi [name],

Sorry about that — here's your download right now:

[LINK]

Worth checking spam too, that's where it usually is. Anything else,
just reply.
```

**Unblock first, debug second.**

---

### <a id="28"></a>28. A chargeback

You have a limited window to submit evidence. The system emails you the moment one opens.

**What wins:**

- The delivery email record — sent time, and whether it was opened
- The download log — proof they downloaded it
- Your refund policy text as displayed at the time
- Any correspondence

All of it is in the dashboard on the customer's detail page.

**Be realistic:** you will lose a fair share of digital-goods disputes even with good
evidence. Prevention is where the effort pays — make refunds easier than going to the
bank, and set a recognisable statement descriptor.

---

### <a id="29"></a>29. "Is this a scam?"

Not a bug, but you will get it, and it deserves a direct answer rather than defensiveness.

Point them at what is verifiable:

- The **full lesson list** is on the sales page. Nothing hidden.
- The refund is **unconditional, 14 days, one email**.
- Payment goes through **Stripe** — you never see their card.

If your page does not currently make those three things obvious, that is the actual fix.
See `vault/03-Sell/03-The-Sales-Page.md`.

---

## Still stuck

Gather these before asking anyone for help — they answer most questions immediately:

```bash
node --version
npm run check-env
curl https://yourdomain.com/api/health/ready
```

Plus the `X-Request-Id` from the failing response, and the matching log line. Every request
carries one specifically so a customer's problem can be traced to a single log entry.
