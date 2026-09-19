# Course Printer

**A complete system for building a digital course and the machine that sells it.**

Forty written lessons, a production sales page, Stripe checkout, automatic delivery, a
customer database, an admin dashboard and a seven-email sequence. All of it as files you
own, on infrastructure you control.

New here? Read **[START-HERE.md](START-HERE.md)** first — five minutes.

---

## What's in the box

```
course-system-premium/
├── START-HERE.md          Five-minute quick start
├── README.md              This file
├── SETUP.md               Getting it running, properly
├── DEPLOYMENT.md          Putting it on the internet
├── MARKETING.md           Distribution strategy and calendar
├── SECURITY.md            Pre-launch security checklist
│
├── vault/                 THE COURSE — 40 lessons, 5 modules
│   ├── 00-Command-Center.md
│   ├── 01-Mindset/        8 lessons — what to teach, and what you may claim
│   ├── 02-Build/          9 lessons — writing it
│   ├── 03-Sell/           9 lessons — pricing, page, checkout, delivery
│   ├── 04-Market/         9 lessons — distribution from zero
│   ├── 05-Bonus/          5 lessons — second product, prices, testimonials
│   ├── Templates/         8 fill-in templates
│   └── Resources.md       Every tool and link
│
├── web/                   THE SALES SYSTEM
│   ├── index.html         Sales page
│   ├── success.html       Post-purchase
│   └── admin.html         Dashboard
│
├── backend/               THE ENGINE
│   ├── server.js          Entry point
│   ├── config/            Env loading + validation
│   ├── routes/            HTTP endpoints
│   ├── middleware/        Auth, rate limits, errors, security headers
│   ├── models/            Database + schema migrations
│   ├── services/          Business logic
│   ├── templates/         Email templates
│   ├── utils/             Logger, tokens, retry, validation
│   └── scripts/           check-env, build-vault, smoke-test
│
└── docs/
    ├── Deployment-Guide.md    Every platform, every edge case
    ├── Troubleshooting.md     25+ problems and fixes
    ├── Security-Hardening.md  Beyond the basics
    ├── Marketing-Playbook.md  90-day plan with a schedule
    ├── Analytics-Setup.md     What to measure, what to ignore
    └── Scaling-Guide.md       What to change at each revenue level
```

---

## Quick start

**To read the course:**

```
Install Obsidian (obsidian.md) → Open folder as vault → select vault/
→ open 00-Command-Center.md
```

**To run the system:**

```bash
cd backend
npm install
cp .env.example .env
npm run check-env      # reports exactly what's missing
npm start              # http://localhost:3000
```

It runs with no Stripe keys and no email configured — emails print to your terminal. See
[SETUP.md](SETUP.md) to connect the real thing.

---

## How it works

```
Visitor lands on sales page
        ↓
Page fetches prices from /api/config          ← one source of truth
        ↓
Clicks buy → server creates Stripe session    ← server decides the price
        ↓
Pays on Stripe's hosted checkout              ← card never touches your server
        ↓
Stripe webhook → your server                  ← signature verified, idempotent
        ↓
Customer recorded → signed link issued → email sent
        ↓
Customer downloads                            ← expiring, use-limited, revocable
        ↓
Follow-up sequence over 45 days
```

Every step is visible in the admin dashboard, including the ones that failed.

---

## What makes this different from a template

**Prices live in one place.** The page fetches them from the server, which reads them from
`.env`. The price displayed and the price charged cannot drift apart.

**Urgency is enforced, not decorated.** Configure a launch deadline and the server really
does charge more when it passes. Configure a cohort cap and checkout really closes. There
is no fake countdown in this codebase and adding one would take deliberate effort.

**Testimonials require consent in software.** The database refuses to publish a testimonial
without recorded permission. That friction is the point — fabricated testimonials carry
civil penalties per violation under 16 CFR Part 465, and they are the fastest way to lose
your Stripe account.

**Failures are visible.** Failed webhooks and failed emails appear in the dashboard and
email you. A customer who paid and got nothing is the worst state the system can be in, and
it is designed to be impossible to miss.

**The webhook is idempotent.** Stripe retries. Without deduplication a retried event sends
a second copy of the course and double-counts the sale. This one claims each event id
exactly once.

---

## Requirements

**To read the course:** a computer. Obsidian is free and optional — every lesson is plain
Markdown.

**To run the system:**
- Node.js 18.17+
- A Stripe account (free)
- A domain (~£12/year)
- Somewhere to run Node with a persistent disk (Railway, Render, Fly — free tiers work)
- An email service (Postmark, Resend — free tiers work)

You do not need to know how to code. You do need to follow a technical guide carefully.

---

## Testing

```bash
npm run check-env      # configuration validity, with fixes for each problem
npm run test:smoke     # 17 checks against a running server
```

The smoke tests cover the things that must not break: secret keys not leaking into public
config, admin auth rejecting bad tokens, forged download tokens rejected, unsigned webhooks
rejected, and the resend endpoint not revealing who is a customer.

---

## Honest limitations

Worth knowing before you rely on it:

- **SQLite, single instance.** Correct for this scale, and it does not scale horizontally.
  `docs/Scaling-Guide.md` covers when and how to move.
- **No automated test suite beyond smoke tests.** The smoke tests cover the critical paths.
  Deeper coverage is left to you.
- **The email sequence needs a scheduler.** Delivery is automatic; the day-2 onwards emails
  need a cron job or scheduled task. See `docs/Deployment-Guide.md`.
- **One admin, one token.** Fine for a solo operator. Add per-user auth before sharing.
- **Your host's free tier probably sleeps.** A sleeping server misses webhooks. See the
  deployment guide.

---

## Before you take real money

Work through **[SECURITY.md](SECURITY.md)**. It is a checklist, not an essay, and it
covers the handful of things that would actually hurt: live keys in git, a missing webhook
secret, an unprotected dashboard, a database that vanishes on deploy.

And read **`vault/01-Mindset/06-Ethics-And-Claims.md`** before writing a word of sales
copy.

---

## Licence and what you may do

- Use everything here to build and sell your own product. You owe nothing on what you
  earn.
- Modify any of it.
- You may not resell the vault itself as a finished product, or redistribute the lessons
  verbatim.

The distinction is between **using** the system and **reselling** the system.

---

## A note on expectations

This system makes no promise about what you will earn, and you should be suspicious of any
that does. What you make depends on your topic, your audience, your execution and how long
you keep going — variables that swamp anything the software contributes.

What it does do is remove the technical and structural obstacles, so the only remaining
variable is whether you write the thing and put it in front of people.

That part is still on you.
