# 3.7 — Automatic delivery

**10 minutes · Module 3 · [[00-Module-Overview|Back to module]]**

---

## Why this has to be automatic

Someone in another timezone buys your course at 3am. If delivery is manual, they wait
eight hours for a file they paid for.

In those eight hours: they check spam twice, they email you, and a meaningful fraction
request a refund or dispute the charge — not because the product is bad, but because
"I paid and got nothing" is the most alarming state a customer can be in.

Automatic delivery is not a convenience for you. It is the difference between a purchase
that completes and one that becomes a support incident.

---

## What good delivery looks like

1. Payment succeeds
2. Webhook fires
3. Customer record created
4. Download link generated
5. Email sent — **within a minute**
6. Customer clicks, gets the file

Steps 3–5 happen without you. You find out when you look at the dashboard.

---

## The download link

A download link is a bearer credential for a paid product. Anyone holding it can have your
course. So it needs four properties, and each defends against a specific real failure:

| Property | Defends against |
|----------|-----------------|
| **Signed** | Someone guessing or forging a link |
| **Expiring** | A link posted publicly working forever |
| **Use-limited** | One purchase serving a thousand downloads |
| **Revocable** | A refunded customer keeping access |

And one property that matters just as much and is usually forgotten:

**Recoverable.** A legitimate customer who hits any of those limits must be able to get a
new link in seconds, without asking you. Locked-out paying customers generate refunds and
bad reviews far faster than piracy costs you anything.

The implementation in this system: an HMAC-signed token containing the customer id and an
expiry, recorded in a database row that tracks uses and revocation. 72-hour expiry, 25
uses, and a self-serve "email me a new link" form on the success page and in the footer.

---

## Be generous with the limits

The instinct is to lock this down hard. Resist it, and think about who the limits actually
affect.

**Piracy is not your problem.** If your course is worth stealing, it will be on a forum
within a week regardless of your link expiry. The people who would share it were never
going to buy it, so the revenue loss is close to zero.

**Locked-out customers are your problem.** They cost you a refund, a support thread,
sometimes a chargeback, and a bad word to everyone they know.

So: 72 hours, 25 uses, unlimited free resends. Generous enough that no honest customer
ever hits a wall, bounded enough that a link posted on Reddit stops working.

---

## Email deliverability, which is the actual hard part

The code is straightforward. **Getting the email into the inbox is not**, and it is the
single most common cause of "I paid and received nothing".

### Use a real sending service

Not Gmail. Gmail rate-limits at around 500/day, flags automated sending, and its
reputation is not yours to control.

Use Postmark, Resend, SES, Mailgun or similar. Postmark in particular is worth the money
for transactional mail — that is what it is built for and its delivery rates reflect it.

### Authenticate your domain

Three DNS records. **This is not optional** — without them, Gmail and Outlook increasingly
reject mail outright rather than filing it in spam.

- **SPF** — which servers may send as your domain
- **DKIM** — a cryptographic signature proving the mail is really from you
- **DMARC** — what to do with mail that fails the first two

Your sending service walks you through all three. It takes twenty minutes and a DNS
propagation wait.

### Send from a domain you own

`hello@yourdomain.com`, not `yourname@gmail.com`. You cannot authenticate a domain you do
not control, and free-mail From addresses on transactional email are treated poorly.

### Keep delivery email plain

The delivery email has exactly one job: get them to the download. Every marketing element
you add — images, tracking-heavy HTML, promotional language — raises the chance it is
filed as promotional rather than transactional.

Short, plain, one obvious link. The template in this system is deliberately austere for
this reason.

### Always send a plain-text version

HTML-only email is a strong spam signal. Every email in this system ships with both parts.

---

## When delivery fails

It will, occasionally. Design for it:

**Record every send.** The `emails` table here logs recipient, template, status, attempts
and any error. When someone says "I never got it", you can answer with a fact rather than
a guess.

**Alert yourself on failure.** A paying customer with no email is the worst state the
system can be in. This one sends you an email with the download link in it, so you can
forward it manually within minutes.

**Never fail the webhook because email failed.** If the handler returns an error, Stripe
retries the whole event — redoing fulfilment for a payment that was never in doubt. Record
the failure, alert, return success.

**Give them a self-serve path.** The resend form removes the most common support request
entirely.

---

## Security note on the resend form

The resend endpoint returns **the same message whether or not the address has a purchase**:

> "If that email address has a purchase with us, a fresh link is on its way."

If it said "no purchase found", it would become a free tool for checking which email
addresses bought from you — which is exactly what a competitor would like to enumerate.
Small detail, real consequence.

---

## Action Items

1. **Choose a sending service.** Not Gmail. Postmark or Resend if undecided.
2. **Set up SPF, DKIM and DMARC** for your domain. Twenty minutes, and it is the
   difference between arriving and not.
3. **Send yourself a test delivery email.** Check Gmail, Outlook and a phone. Check spam.
4. **Test the full path:** buy → email arrives → link works → file opens.
5. **Test the failure path:** break your email config deliberately, make a purchase, and
   confirm the sale is still recorded and you are alerted.
6. **Test the resend form** with an address that has no purchase. Confirm it does not
   reveal that.

---

**Next:** [[08-Email-Sequence|3.8 — The email sequence after a sale]]

**Related:** [[06-Stripe-Setup|3.6 — Stripe setup]] ·
[[09-Refunds-And-Support|3.9 — Refunds and support]] · `docs/Troubleshooting.md`
