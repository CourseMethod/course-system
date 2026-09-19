# Resources

Everything referenced anywhere in the course, in one place.

**Nothing here is an affiliate link.** Where a paid tool is listed, the free alternative
is listed beside it.

---

## Writing the course

| Tool | Cost | What for |
|------|------|----------|
| [Obsidian](https://obsidian.md) | Free | Reading and writing the vault |
| VS Code | Free | Alternative — any Markdown editor works |
| [Typora](https://typora.io) | ~$15 | Alternative, nicer to write in |
| Claude / ChatGPT | Free tier, ~£20/mo paid | Structure checks, editing ([[02-Build/06-Using-AI-Properly]]) |

**Markdown reference:** [commonmark.org/help](https://commonmark.org/help) — ten minutes
and you know all of it.

---

## Selling

| Tool | Cost | Notes |
|------|------|-------|
| [Stripe](https://stripe.com) | 2.9% + 30p | What The Engine uses |
| [Gumroad](https://gumroad.com) | ~10% | Fastest path to a first sale |
| [Payhip](https://payhip.com) | 5% free tier | Handles EU VAT for you |
| [Lemon Squeezy](https://lemonsqueezy.com) | ~5% + fees | Merchant of record — handles tax globally |

**Start on a platform if you want sales this week.** Move to Stripe when the percentage
starts to hurt — roughly 100 sales at £47. See [[03-Sell/06-Stripe-Setup]].

Stripe test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` declines.

---

## Hosting

| Service | Free tier | Good for |
|---------|-----------|----------|
| [Railway](https://railway.app) | Trial credit | Easiest for the Node backend |
| [Render](https://render.com) | Yes, sleeps when idle | Good free option |
| [Fly.io](https://fly.io) | Small free allowance | Persistent volumes for SQLite |
| [Vercel](https://vercel.com) | Generous | Static sales page only — no persistent disk |
| [Netlify](https://netlify.com) | Generous | Static sales page only |

**Important:** Vercel and Netlify cannot run the backend as-is — they have no persistent
filesystem, so the SQLite database would vanish on every deploy. See
`docs/Deployment-Guide.md`.

**Domains:** Namecheap, Porkbun, Cloudflare. About £8–15/year. Buy the `.com` if you can.

---

## Email

| Service | Free tier | Notes |
|---------|-----------|-------|
| [Postmark](https://postmarkapp.com) | 100/mo | Best deliverability for transactional |
| [Resend](https://resend.com) | 3,000/mo | Good developer experience |
| [MailerLite](https://mailerlite.com) | 1,000 subscribers | Best free list tool |
| [Buttondown](https://buttondown.email) | 100 subscribers | Simple, plain-text friendly |
| [Kit](https://kit.com) | 10,000 subscribers | Was ConvertKit |
| AWS SES | Very cheap | Cheapest at volume, fiddly setup |

**Do not use Gmail for delivery.** Rate-limited around 500/day, flags automated sending,
and its reputation is not yours to control.

**Authenticate your domain** — SPF, DKIM, DMARC. Twenty minutes, and it is the difference
between arriving and not. See [[03-Sell/07-Automatic-Delivery]].

Check your setup: [mail-tester.com](https://mail-tester.com) — free, gives you a score out
of 10 and tells you what is missing.

---

## Content and distribution

| Tool | Cost | What for |
|------|------|----------|
| [CapCut](https://capcut.com) | Free | Editing short video, auto-captions |
| Your phone | — | Genuinely sufficient. Don't buy a camera |
| [Canva](https://canva.com) | Free tier | Thumbnails, simple graphics |
| [Buffer](https://buffer.com) / [Later](https://later.com) | Free tiers | Scheduling posts |
| Native schedulers | Free | Instagram and TikTok both have one built in |

**Do not buy equipment before post 50.** You will not know what you need, and the
unopened lighting kit is a real and common pattern.

---

## Research — finding what your audience actually says

- **Reddit** — find your subreddit, sort by new, read the questions. The phrasing is the
  point.
- **YouTube comments** under the most popular tutorial in your area — "this was great but
  I still don't understand..." is a list of lessons you should write.
- **Amazon three-star reviews** of books in your area. Five stars tell you nothing, one
  star is usually about shipping. Three stars are written by people who engaged seriously
  and found something missing.
- **Facebook groups and Discords** — search within them for "how do I".
- **Your own inbox** — if people already ask you things, that archive is the most valuable
  research available and you already own it.

Collect verbatim sentences in `Their Words.md`. See [[01-Mindset/04-Finding-Who-Its-For]].

---

## Legal and compliance

**Read [[01-Mindset/06-Ethics-And-Claims]] before writing any sales copy.**

- **FTC Endorsement Guides & Testimonials Rule (16 CFR Part 465)** —
  [ftc.gov/business-guidance](https://www.ftc.gov/business-guidance) · civil penalties per
  violation for fake or misattributed testimonials
- **FTC Rule on Deceptive Earnings Claims** — substantiation required for any income claim
- **UK:** ASA CAP Code · Consumer Protection from Unfair Trading Regulations
- **EU:** Unfair Commercial Practices Directive
- **GDPR / UK GDPR** — if you have EU or UK subscribers, record consent. Your email
  provider does this for you.
- **CAN-SPAM** — unsubscribe link, identity, and a postal address in every marketing email

**If your topic touches medical, financial, legal or immigration advice**, get advice
appropriate to your jurisdiction before selling.

---

## Analytics

- **Your platform's native analytics** — the retention graph is the number that matters
- **`/admin.html`** — sales, conversion funnel, source attribution
- **[Plausible](https://plausible.io)** / **[Fathom](https://usefathom.com)** — privacy-
  friendly page analytics, no cookie banner needed, ~£9/mo
- **Google Analytics** — free, heavier, and brings consent-banner obligations

See [[04-Market/08-Reading-Analytics]] and `docs/Analytics-Setup.md`.

---

## Reference — the numbers worth remembering

| Metric | Healthy | Worry |
|--------|---------|-------|
| 3-second retention | 60%+ | Under 40% → hook problem |
| Sales page conversion | 1–3% cold | Under 0.5% |
| Refund rate | 0–8% | Over 10% → page overpromises |
| Chargeback rate | Under 0.5% | 0.75%+ risks your Stripe account |
| Email open rate | 30–50% | Unreliable — see the caveat in the dashboard |
| Posts before judging | 60 | Most people stop at 12 |
| Visitors before judging a page | 200 | Below this is noise |

---

## The system's own docs

If you have The Engine:

| File | Covers |
|------|--------|
| `START-HERE.md` | Five-minute quick start |
| `SETUP.md` | Full setup |
| `DEPLOYMENT.md` | Every platform, step by step |
| `SECURITY.md` | Hardening before you take real money |
| `docs/Troubleshooting.md` | 25+ problems and their fixes |
| `docs/Marketing-Playbook.md` | 90-day plan with a posting schedule |
| `docs/Analytics-Setup.md` | What to measure and what to ignore |
| `docs/Scaling-Guide.md` | What to change at each revenue level |

---

**Back to** [[00-Command-Center|Command Center]]
