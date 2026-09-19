# Scaling guide

What to change, and when. Organised by revenue, because that is what actually changes your
constraints.

**The overriding principle: do not scale before you need to.** Every entry here is work
that produces nothing until the corresponding pressure exists. Premature scaling is a
comfortable way to avoid marketing.

---

## Where the current architecture runs out

Be clear about the actual limits, so you know how far away they are.

| Component | Comfortable to | Hard limit |
|-----------|----------------|------------|
| SQLite + one instance | ~50,000 customers | One writer. No horizontal scaling |
| One Node process | ~500 concurrent requests | CPU on your instance |
| ZIP served from disk | ~100 concurrent downloads | Bandwidth and disk I/O |
| In-memory rate limiting | One instance | Not shared across instances |
| Email via one provider | Provider's tier | Rate limits |

**In practice:** this handles a business selling a few thousand courses a year without
complaint. Most people never reach any of these limits.

The one that binds first is not a limit at all — it is that **SQLite means one instance**,
so you cannot run two for redundancy without changing the database.

---

## £0–1,000/month

**Roughly 0–20 sales/month. Everything is fine. Change nothing.**

At this stage the bottleneck is distribution, and it is not close. Any hour spent on
infrastructure is an hour not spent on the thing that is actually limiting you.

**Do only this:**

- [ ] Persistent volume for the database
- [ ] Monthly CSV export, stored off the server
- [ ] Uptime monitor on `/api/health/live`
- [ ] Paid tier on your host if the free one sleeps (~£7/mo) — a sleeping server misses
      webhooks

**Costs:** £7–15/month total.

**Resist:** rewriting anything, adding a CDN, containerising, switching database, building
a mobile app.

---

## £1,000–5,000/month

**Roughly 20–100 sales/month. Small operational improvements only.**

### Do

**Automated database backups**, daily, retained 30 days:

```bash
0 3 * * * sqlite3 /data/course-printer.db ".backup '/backups/db-$(date +\%F).db'" \
  && find /backups -name 'db-*.db' -mtime +30 -delete
```

Use `.backup`, not `cp` — copying a live SQLite file mid-write gives you a corrupt backup
you discover during a restore.

**Test the restore.** Once. An untested backup is a guess.

**Move the ZIP to object storage** if downloads are a meaningful share of your bandwidth
bill. Cloudflare R2 has no egress fees, which matters here. Keep the signed-token check on
your server and issue a short-lived presigned URL.

**Set up the email sequence scheduler** properly if you have not. The day-7 check-in is the
highest-leverage email you send.

**A second product** ([`vault/05-Bonus/01-Your-Second-Product.md`]) — at this level this is
higher-return than any infrastructure work, because your existing customers are the
cheapest audience you will ever reach.

### Do not

- Move to Postgres. You are nowhere near needing it.
- Hire a developer.
- Run ads unless you know your conversion rate on a 200+ visitor sample.

---

## £5,000–20,000/month

**Roughly 100–400 sales/month. Now some things genuinely need attention.**

### Database — the decision point

You are still fine on SQLite by volume. You move to Postgres when you want **more than one
instance**, for redundancy or zero-downtime deploys.

If you do:

1. `models/db.js` and the model files are the only things that change. Routes, services and
   middleware are untouched — that separation was the point of the layering.
2. Swap `better-sqlite3` for `pg`. The main work is that Postgres is async, so model
   functions gain `await`.
3. Migrate: `sqlite3 db.sqlite .dump` → transform → import. Or, for a few thousand rows,
   read-and-insert with a script.
4. Move rate limiting to Redis at the same time, or limits stop working correctly across
   instances.

**Budget a weekend. Do it before you need it, not during an outage.**

### Email

At a few thousand sends a month, reliability matters more than cost.

- Dedicated IP if your provider offers one (needs consistent volume to warm up)
- Monitor bounce and complaint rates — a complaint rate above ~0.1% threatens your sending
  reputation
- Prune addresses that have hard-bounced

### Support

At ~50 tickets/month, first hire is a VA. Give them
`vault/Templates/03-Support-Replies.md` and authority to issue refunds without asking.

**Authority to refund is the important part.** A VA who has to check with you turns a
one-hour resolution into a two-day one, which is where chargebacks come from.

### Money

- Separate business bank account, if you have not
- Talk to an accountant about structure — the right answer varies by country and it is
  cheap advice
- **VAT/sales tax:** thresholds vary and digital goods have their own rules. EU VAT on
  digital goods applies from the first sale to an EU consumer. Consider a merchant of
  record (Lemon Squeezy, Paddle) which handles all of it for a percentage — frequently
  worth it purely for the compliance.

---

## £20,000+/month

**400+ sales/month. A real business with real obligations.**

### Infrastructure

- **Postgres**, managed (Neon, Supabase, RDS)
- **Two or more instances** behind a load balancer
- **Redis** for rate limiting and sessions
- **CDN** for static assets and the ZIP
- **Structured logging** to a real platform (Better Stack, Datadog)
- **Error tracking** (Sentry)
- **Staging environment** that mirrors production

### Process

- CI running the smoke tests on every push
- Deploy from a branch, not your laptop
- Runbooks for the common incidents
- Documented on-call, even if on-call is you

### Team

Rough order:

1. **VA for support** (~£500/mo)
2. **Editor for content** if filming is the bottleneck
3. **Part-time developer** for maintenance
4. Everything else much later

**Do not hire a marketing agency for a course business.** They cost more than they return
at this scale and cannot replicate the thing that works, which is you replying to people
personally.

---

## Traffic spikes

A post going viral is the one time capacity matters, and it arrives without warning.

### What breaks first

1. **Rate limits.** The general limiter allows 300 requests per IP per 15 min — fine for
   real users, but if `trust proxy` is misconfigured everyone shares one IP and they all
   get blocked at once. **Check this before you need it.**
2. **Download bandwidth.** A hundred concurrent ZIP downloads will saturate a small
   instance.
3. **Email provider limits.** Free tiers cap daily sends; a spike hits the cap and delivery
   emails stop.

### Preparing cheaply

- [ ] Verify `trust proxy` matches your proxy count (see `Security-Hardening.md`)
- [ ] Know your email provider's daily limit
- [ ] Have the ZIP on object storage, or know how to move it quickly
- [ ] Know how to scale your instance up — the button, before you need it

### During a spike

1. Watch `/api/health/ready`
2. Scale the instance vertically — one bigger machine, since SQLite prevents horizontal
   scaling
3. If downloads are saturating: move the ZIP to R2/S3 and issue presigned URLs
4. Raise the download rate limit temporarily if legitimate customers are being blocked

**Do not panic-refactor during a spike.** Scale vertically, survive it, then improve.

---

## When to move off this system entirely

Honest answer: probably never, but the cases where it is right:

- **You need a real membership area** with progress tracking and drip content.
- **You are selling subscriptions** with dunning, proration and plan changes. Use Stripe
  Billing rather than building it.
- **You have a team** needing roles and permissions.
- **You are doing serious volume** — 10,000+ customers — and want a platform's operational
  maturity rather than your own.

Even then, **export your customer list first** and keep it. That is the business; the
software is replaceable.

---

## Costs at each stage

| Revenue | Hosting | Email | Other | Total |
|---------|---------|-------|-------|-------|
| £0–1k | £7 | £0 | £1 domain | **~£8/mo** |
| £1–5k | £20 | £15 | £10 backups | **~£45/mo** |
| £5–20k | £50 | £50 | £100 tools | **~£200/mo** |
| £20k+ | £200 | £150 | £500 team/tools | **~£850/mo+** |

Even at the top row that is a rounding error against revenue. **The economics of this
business are extremely good; the constraint is never infrastructure cost.**

---

## The thing to keep in mind

Every entry in this document is a response to a pressure that exists. None of it makes you
money on its own.

The question that matters at every stage is the same one: **is infrastructure actually my
bottleneck, or is it distribution?**

For almost everyone, almost always, it is distribution. Scaling work feels productive,
has a clear finish line, and is a very comfortable way to avoid posting.
