# Analytics setup

What to measure, what to ignore, and how to tell the difference.

---

## The principle

**A useful metric answers a question and points at a specific action.** Everything else is
a mood.

"We got 40,000 views" is a mood. "Retention at three seconds was 38%, so the hook failed"
is a metric — it names the problem and the fix.

---

## What is already built in

The system tracks its own funnel. No setup, no third party, no cookie banner.

### How it works

The sales page generates a random `sessionKey` in `sessionStorage` — **not a cookie, not a
fingerprint, not a cross-site identifier**. It exists only to join a visit to a purchase for
funnel arithmetic, and it disappears when the tab closes.

Events recorded:

| Event | When |
|-------|------|
| `page_view` | Page loads |
| `pricing_view` | Pricing scrolls into view |
| `checkout_started` | Buy clicked, session created |
| `purchase_completed` | Webhook confirms payment |
| `download_started` | ZIP served |
| `email_opened` / `email_clicked` | Tracking pixel / link |
| `refund_requested`, `ticket_created` | Support |

**Not recorded:** IP addresses, user agents against events, or anything identifying a
visitor before purchase.

That minimalism is deliberate — it keeps you outside most consent-banner requirements,
which is worth more than the extra data a third-party tracker would provide.

### Where to see it

`/admin.html` — the funnel, daily revenue, sources, email performance.

---

## The five numbers that matter

### 1. Retention at three seconds

**Where:** your platform's per-post analytics.
**Why:** watch time is the dominant ranking signal. If people scroll past in two seconds,
nothing else counts.

| Value | Diagnosis |
|-------|-----------|
| Under 40% | Hook failing. **Fix only this** |
| 40–60% | Weak |
| 60–75% | Working |
| 75%+ | Strong |

**The most actionable number you have.** Do not change your topic, editing or posting time
until it is above 60%.

### 2. Average watch percentage

Good 3-second retention with a low average means the hook promised something the post did
not deliver — usually too much setup before the payoff.

### 3. Shares and saves

The strongest positive signal a platform sees, and your best guide to what to make more of.

**Look at your top three by shares. What do they have in common?** That is your format.

### 4. Sales page conversion

**Where:** `/admin.html` → funnel.

| Rate | Meaning |
|------|---------|
| Under 0.5% | Page or traffic is wrong |
| 0.5–1% | Low. Usually a mismatch between post and page |
| **1–3%** | **Normal for cold traffic** |
| 3%+ | Strong |

**Needs 200+ visitors to mean anything.** Below that you are reading noise.

### 5. Refund rate

**Where:** `/admin.html` → tiles.

| Rate | Meaning |
|------|---------|
| 0–3% | Healthy |
| 3–8% | Fine. Read the reasons |
| 8–15% | The page promises more than the course delivers |
| 15%+ | Stop selling and fix it |

**A high refund rate is a marketing problem, not a quality problem.** The fix is almost
always the sales page — specifically, adding an honest "who this isn't for" section.

---

## Diagnosing with two numbers

The useful trick — combine views and conversion to locate the actual problem:

| Views | Conversion | Problem | Fix |
|-------|-----------|---------|-----|
| Low | — | Nobody sees it | Hooks. Post more |
| High | ~0, no clicks | Wrong audience | Content closer to the problem you solve |
| High | Low, clicks happening | The page | Sales page work |
| **Low** | **High** | **None — it works** | **Post more. Do not redesign** |
| High | Good | Working | Do more of the same |

That fourth row is the one people get wrong. **A low-traffic page converting at 4% is not
failing, it is starved.** The fix is distribution. People routinely rebuild a perfectly
good page instead, and lose the thing that was working.

---

## Attribution

Tag every link you post:

```
https://yourdomain.com/?utm_source=instagram
https://yourdomain.com/?utm_source=tiktok&utm_campaign=launch
https://yourdomain.com/?utm_source=newsletter
```

The page captures these and passes them through checkout into the customer record. The
dashboard's **by-source** table then answers the question everyone otherwise guesses at:

> **Which platform produces buyers, as opposed to views?**

These are frequently different, and the gap is expensive if you do not know about it. A
platform producing 80% of your views and 10% of your sales is telling you something
specific.

### Parameters worth using

| Parameter | Use |
|-----------|-----|
| `utm_source` | The platform: `instagram`, `tiktok`, `reddit` |
| `utm_medium` | The type: `bio`, `post`, `email` |
| `utm_campaign` | The push: `launch`, `blackfriday` |

Keep them lowercase and consistent. `Instagram` and `instagram` become two rows.

---

## Email metrics, and their limits

**Open rate is not trustworthy.**

Apple Mail Privacy Protection and most corporate gateways pre-fetch images, registering
opens nobody performed. Depending on your audience, **20–60% of recorded opens may be
machines.**

| Metric | Trust | Use it for |
|--------|-------|------------|
| Open rate | **Low** | Relative trend between campaigns only |
| Click rate | **High** | Actual engagement |
| Reply rate | **Highest** | Real humans, and a strong deliverability signal |
| Failure rate | Absolute | Something is broken |

Optimise for **clicks and replies**. The dashboard's Email tab carries this warning for the
same reason.

---

## Optional: page analytics

The built-in funnel covers conversion. If you want to know *which pages* and *how far
people scroll*, add a privacy-friendly tool:

| Tool | Cost | Consent banner needed? |
|------|------|------------------------|
| [Plausible](https://plausible.io) | ~£9/mo | No — no cookies, no personal data |
| [Fathom](https://usefathom.com) | ~£12/mo | No |
| [Umami](https://umami.is) | Free, self-hosted | No |
| Google Analytics | Free | **Yes** — and it is heavier |

**Recommendation: Plausible or nothing.** Google Analytics brings consent-banner
obligations, a cookie notice that costs conversions, and far more data than you will act
on.

Add before `</head>` in `web/index.html`:

```html
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

Then add `https://plausible.io` to `scriptSrc` in `middleware/security.js`, or the CSP
blocks it.

---

## The weekly review

**15 minutes, same time each week.** Not daily — daily numbers are noise, and checking them
constantly is a reliable way to feel bad about normal variance.

```
1. Best 3-second retention this week? Why?
2. Most shares? Why?
3. Link clicks?
4. Sales and conversion rate?
5. ONE thing to change next week.
```

Write it in `Weekly-Numbers.md`:

| Week | Posts | Best 3s | Shares | Clicks | Signups | Sales | Conv % | One change |
|------|-------|---------|--------|--------|---------|-------|--------|------------|

**One change per week.** Changing five things at once means learning nothing from the
result.

---

## Sample sizes

The most common analytical error here is concluding from one data point.

| Decision | Minimum before concluding |
|----------|---------------------------|
| Does this format work? | 10 posts of it |
| Does this page convert? | 200 visitors |
| Does this price work? | 200 visitors at that price |
| Does this business work? | 60 posts |
| Is this email subject better? | 200 sends |

Below those numbers, **keep going and do not change anything.** Acting on noise is worse
than acting on nothing, because it destroys the consistency that would have produced a
signal.

---

## Metrics to actively ignore

- **Follower count.** A lagging indicator. Chasing it produces an audience that does not
  buy.
- **Likes.** The weakest signal, almost uncorrelated with sales.
- **Total lifetime views.** Feels good, says nothing.
- **Open rate as an absolute.** See above.
- **Other people's numbers.** You do not know their conversion rate, their costs, or
  whether the screenshot is real.

---

## Exporting your data

```
Dashboard → Export CSV
```

Your customer list, portable. **Do this monthly and store it off the server.**

Fields: id, email, tier, amount, currency, status, download count, utm_source,
utm_campaign, created_at.

Values beginning `=`, `+`, `-` or `@` are escaped, so a malicious "name" cannot execute as
a formula when you open your own export in Excel.

---

## Retention and privacy

The `events` table is the fastest-growing thing in the database, and holding
visitor-level records indefinitely is a liability you do not need.

```js
events.pruneOlderThan(400);   // days
```

Run it periodically. Purchase records in `customers` are untouched — only the analytics
events are pruned.
