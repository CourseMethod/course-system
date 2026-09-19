# 5.5 — Systemising so it runs without you

**11 minutes · Module 5 · [[00-Module-Overview|Back to module]]**

---

## What "passive" actually means

Not "no work". A course business that genuinely required nothing would be a lottery ticket.

What it means in practice: **the work is front-loaded and repeated work is automated**, so
your ongoing time goes into things that compound rather than things that merely maintain.

Realistically, a working course business takes **two to four hours a week** once
established: posting, replying, and occasional updates. That is genuinely small. It is not
zero, and anyone selling you zero is lying.

---

## What should already be automatic

If you built The Engine, these happen without you:

| Task | Handled by |
|------|-----------|
| Taking payment | Stripe Checkout |
| Recording the customer | Webhook → database |
| Generating a download link | Signed token on fulfilment |
| Sending the course | Delivery email |
| The follow-up sequence | Scheduled emails |
| Resending lost links | Self-serve form |
| Refund → revoking access | `charge.refunded` webhook |
| Alerting you when something breaks | Admin alert email |

That covers most of what would otherwise be daily work. If any of these still requires you,
that is the first thing to fix — see [[03-Sell/07-Automatic-Delivery]].

---

## What is left, and how to reduce it

### Support

Four questions are most of your volume, and all four are preventable:

| Question | Permanent fix |
|----------|---------------|
| "I didn't get the email" | Deliverability + self-serve resend |
| "My link expired" | The resend form |
| "How do I open this?" | Root `README.md` + orientation email |
| "Can I get a refund?" | Just do it, within a day |

**Every repeated question is a documentation bug.** When you answer something twice, add
it to the FAQ, the orientation email, or the README. The third person never asks.

Keep canned replies in `Templates/Support-Replies.md` — not to be impersonal, but to be
fast and consistent.

### Content

Batching is the whole answer ([[04-Market/05-Content-Calendar]]).

One planning session and one filming session a week produces a fortnight of posts. Trying
to make content daily is what makes it feel like a job.

### Updates

Not weekly. **Quarterly at most.**

When you update: bump the version, email your customers, mention it publicly. "Lifetime
updates" is a promise about occasional improvement, not continuous production, and
treating it as the latter is how people burn out.

---

## The weekly rhythm

Two to four hours, and it fits into fixed slots:

**Sunday, 60 min**
- Review last week's numbers ([[04-Market/08-Reading-Analytics]])
- Fill next week's calendar
- Write five scripts

**Monday, 90 min**
- Film and edit the week's posts
- Schedule them

**Daily, 20 min**
- Reply to comments and DMs
- Answer any support email

**Monthly, 30 min**
- Check failed webhooks and emails in the dashboard
- Check refund rate and reasons
- Review testimonial submissions
- Export a customer CSV backup

That monthly slot is the one people skip, and it is where quiet failures surface.

---

## What to check monthly

The dashboard's **Failures** tab is there for one reason: things fail silently, and a
customer who paid and received nothing will not always tell you.

- **Failed webhooks** — someone may have paid and got nothing
- **Failed emails** — same
- **Refund rate trend** — rising means the page overpromises
  ([[03-Sell/09-Refunds-And-Support]])
- **Disputes** — respond immediately; the window is short

Thirty minutes a month. It is the difference between finding a delivery problem yourself
and hearing about it in a public review.

---

## Back up the thing that matters

Your customer list is the business. Everything else is replaceable.

- **Export the CSV monthly.** One click in the dashboard. Store it somewhere that is not
  the server.
- **Back up the database file** if you are self-hosting. Most platforms do not do this for
  you by default — check rather than assume.
- **Keep your course files** in version control or a sync service.

A server can be rebuilt in an evening. A lost customer list cannot be rebuilt at all.

---

## When to hire

Later than you think, and in this order:

1. **A VA for support**, at maybe 50 tickets a month. Give them the canned replies.
2. **An editor for content**, if filming is the bottleneck rather than ideas.
3. **Nobody else** for a long time.

Do not hire a marketing agency for a course business at this scale. They cost more than
the business makes and cannot replicate the thing that actually works, which is you
replying to comments personally.

---

## Knowing when to stop optimising

There is a point where further automation costs more than the time it saves.

If you are spending a weekend automating something that takes ten minutes a week, that
weekend pays back in six years. Do it by hand.

**Automate what is frequent, repetitive and rule-based.** Leave the rest. Conversations
with customers, in particular, should stay manual for as long as you can bear — they are
the thing that actually sells, and automating them away removes the mechanism
([[04-Market/06-Comments-And-DMs]]).

---

## Action Items

1. **Audit what still requires you.** Anything on the "should be automatic" table that is
   not — fix that first.
2. **Write the four canned replies** in `Templates/Support-Replies.md`.
3. **Set your weekly rhythm** as real calendar blocks, including the monthly check.
4. **Do this month's check now** — failures tab, refund rate, testimonials, CSV export.
5. **Set a recurring reminder** for the monthly CSV backup. Store it off the server.
6. **List the three things you do most often.** Automate only those; leave the rest.

---

**Module 5 complete. That is the whole system.**

Back to [[00-Command-Center|the Command Center]].

**Related:** [[03-Sell/09-Refunds-And-Support|3.9]] ·
[[04-Market/05-Content-Calendar|4.5]] · `docs/Scaling-Guide.md`
