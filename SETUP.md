# Setup

Getting the system running, from nothing to taking real money.

**Budget about two hours**, plus waiting time for Stripe verification and DNS propagation.
Do not attempt this on launch day.

---

## Before you start

You need:

- **Node.js 18.17 or newer** — check with `node --version`. Get it from
  [nodejs.org](https://nodejs.org) if not.
- **A Stripe account** — free, but identity verification can take a few days. **Start this
  first**, then come back.
- **A domain** — ~£12/year from Namecheap, Porkbun or Cloudflare.
- **An email service** — Postmark or Resend. Free tiers are fine.

You do **not** need to know how to code. You do need to follow instructions carefully and
not panic at a terminal.

---

## Stage 1 — Run it locally (15 minutes)

Get it working on your own machine before involving the internet.

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000. You should see the sales page.

**It works with no configuration at all.** Emails print to your terminal instead of
sending, and prices come from the defaults. That is deliberate — a fresh clone runs.

If it did not start, run `npm run check-env`. It reports every problem at once, with the
fix for each.

---

## Stage 2 — Generate your secrets (2 minutes)

```bash
npm run create-admin-token
```

This prints two values. Paste both into `.env`:

```
ADMIN_TOKEN=<the first one>
TOKEN_SECRET=<the second one>
```

**What these do:**

- `ADMIN_TOKEN` — the password to your dashboard. Anyone with it can read every customer
  email address and issue refunds. Put it in a password manager.
- `TOKEN_SECRET` — signs download links. Changing it invalidates every outstanding link,
  so rotate it deliberately, not casually.

They must be different values. The generator produces two, and the server refuses to start
if you paste the same one twice.

---

## Stage 3 — Connect Stripe (30 minutes)

### 3.1 — Get your test keys

[dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys), with **Test mode**
on.

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

The publishable key is public by design and goes in the page. **The secret key never
leaves your server** — not in HTML, not in git, not in a screenshot.

### 3.2 — Set up the webhook

This is the part that actually makes fulfilment work.

Dashboard → **Developers → Webhooks → Add endpoint**

- **URL:** `https://yourdomain.com/api/webhook` (you will set this properly after
  deploying — for now, local testing below)
- **Events:**
  - `checkout.session.completed`
  - `charge.refunded`
  - `charge.dispute.created`
  - `checkout.session.async_payment_succeeded`

Copy the **signing secret** (`whsec_...`) into `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **This is the most important secret in the system.** Without it the server cannot verify
> that a webhook really came from Stripe, so it rejects all of them. With a leaked one,
> someone can forge "payment succeeded" and mint free downloads.

### 3.3 — Test webhooks locally

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

It prints a signing secret for local use — use that one in `.env` while testing.

In another terminal:

```bash
stripe trigger checkout.session.completed
```

Watch your server log. You should see `Sale recorded` and the delivery email printed.

### 3.4 — Buy your own course

Go to http://localhost:3000, click buy, use test card `4242 4242 4242 4242` with any
future expiry and any CVC.

Then test a decline: `4000 0000 0000 0002`. The page should show a useful message, not a
crash.

**This step finds problems no amount of reading does.** Do not skip it.

---

## Stage 4 — Email (30 minutes)

The code is easy. **Getting email into the inbox is the hard part**, and it is the most
common cause of "I paid and received nothing".

### 4.1 — Pick a service

Postmark (best deliverability for transactional) or Resend (nicest to set up). Both have
free tiers.

**Do not use Gmail.** Rate-limited around 500/day, flags automated sending, and its
reputation is not yours to control.

### 4.2 — Configure

```
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your token>
SMTP_PASSWORD=<your token>
EMAIL_FROM="Your Name <hello@yourdomain.com>"
SUPPORT_EMAIL=hello@yourdomain.com
```

### 4.3 — Authenticate your domain

**Three DNS records. This is not optional.** Without them Gmail and Outlook increasingly
reject mail outright rather than filing it in spam.

- **SPF** — which servers may send as your domain
- **DKIM** — a signature proving the mail is really from you
- **DMARC** — what to do with mail that fails the first two

Your email service walks you through all three. Twenty minutes plus DNS propagation.

### 4.4 — Test it

Restart, make a test purchase, and check the email arrives — in Gmail, in Outlook, and on
a phone. **Check spam.**

Then score yourself at [mail-tester.com](https://mail-tester.com). Aim for 9/10 or better.
Anything lower, it tells you what is missing.

---

## Stage 5 — Set your prices (5 minutes)

In `.env`, in **cents**:

```
CURRENCY=usd
PRICE_METHOD=4700
PRICE_ENGINE=9700
```

That is the only place prices exist. The sales page fetches them from the server, so the
number displayed and the number charged cannot drift apart.

### Optional: a real launch price

```
LAUNCH_PRICE_ENDS_AT=2026-10-01T23:59:59Z
PRICE_METHOD_AFTER_LAUNCH=7900
PRICE_ENGINE_AFTER_LAUNCH=14900
```

Leave `LAUNCH_PRICE_ENDS_AT` empty and no countdown appears.

> **Read this before using it.** When that deadline passes, the server genuinely charges
> the higher price. The countdown on the page and the amount at the till are the same
> fact. Do not advertise a deadline you intend to quietly extend — that is a deceptive
> practice, and extending it publicly teaches everyone watching that your deadlines are
> fiction. If you want longer, change the date honestly.

### Optional: a real cohort cap

```
ENGINE_COHORT_LIMIT=15
```

When paid sales of that tier reach 15, checkout for it **actually closes**. Only use this
if the limit is real — it should be, because The Engine tier includes your personal time
and there is a genuine limit to how many of those you can carry.

---

## Stage 6 — Build the course file (2 minutes)

```bash
npm run build-vault
```

Produces two ZIPs in `backend/dist/`. It automatically excludes `.env`, `node_modules`,
your database and any credential file — then verifies afterwards that nothing sensitive
leaked in, and refuses to build if it did.

**Check that verification passed.** Shipping your own `.env` to a customer hands them your
live Stripe secret key.

---

## Stage 7 — Check everything (1 minute)

```bash
npm run check-env
```

It reports configuration problems, tells you whether the course ZIP exists, and refuses to
bless a production setup that would silently fail.

Then, with the server running in another terminal:

```bash
npm run test:smoke
```

17 checks. All should pass.

---

## Stage 8 — Deploy

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for platform-by-platform instructions.

Two things that catch people out, worth flagging now:

**Your database must be on a persistent disk.** On Railway, Render and Fly the default
filesystem is wiped on every deploy. Point `DATABASE_PATH` at a mounted volume or you will
lose your entire customer list the first time you push a change.

**Vercel and Netlify cannot run the backend.** They have no persistent filesystem. They
are fine for the sales page alone.

---

## Stage 9 — Going live

Only when everything above works in test mode.

- [ ] Swap to live keys (`sk_live_`, `pk_live_`)
- [ ] Create a **separate live webhook endpoint** with its own signing secret
- [ ] `NODE_ENV=production`
- [ ] `PUBLIC_URL` set to your real https:// domain
- [ ] `CORS_ORIGINS` set to your real domain(s)
- [ ] Bank account added and verified in Stripe
- [ ] **Statement descriptor** set to something recognisable — if a charge shows as
      "SP* 4X9QTR", people dispute it
- [ ] Work through [SECURITY.md](SECURITY.md)
- [ ] **Buy your own course with a real card**, then refund yourself

The server refuses to start with test keys when `NODE_ENV=production`. That check exists
because the alternative failure is silent: a checkout that looks perfect and charges
nobody.

---

## When something goes wrong

`npm run check-env` first — it catches most configuration problems and tells you the fix.

Then **[docs/Troubleshooting.md](docs/Troubleshooting.md)**, which covers 25+ specific
problems including the ones that are genuinely hard to diagnose:

- Webhooks all returning 400
- Emails going to spam
- The database disappearing on deploy
- Customers paying and receiving nothing
- CORS errors after deploying

---

## The order that actually works

1. Local, no config — **15 min**
2. Secrets — **2 min**
3. Stripe test mode, full flow — **30 min**
4. Email with domain auth — **30 min**
5. Prices — **5 min**
6. Build the ZIP — **2 min**
7. Checks — **1 min**
8. Deploy — **30–60 min**
9. Live keys and a real purchase — **15 min**

Do not skip to step 8. Each stage is verifiable, and finding a problem locally takes
minutes where finding the same problem in production takes hours.
