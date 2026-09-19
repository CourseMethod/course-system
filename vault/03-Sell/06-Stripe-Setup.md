# 3.6 — Stripe setup, end to end

**14 minutes · Module 3 · [[00-Module-Overview|Back to module]]**

---

## First: do you need this?

Honest answer — for your first few sales, probably not.

| | Gumroad / Payhip / Lemon Squeezy | Your own Stripe setup |
|---|---|---|
| Time to live | An afternoon | A weekend |
| Cost | 5–10% of every sale, forever | 2.9% + 30p to Stripe |
| Customer emails | Sometimes theirs, not yours | Yours |
| Control | Their page, their rules | Entirely yours |
| Breaks when | They change terms | You break it |

**Start on a platform if you want sales this week.** Move to your own when the percentage
starts to hurt, or when you want to own the customer relationship — which is the thing
that actually compounds.

At £47 a sale, 10% is £4.70. At 100 sales that is £470 — roughly the point where a
weekend of setup pays for itself.

If you have The Engine, the setup is already built and this lesson is about configuring
it. Everything below applies either way.

---

## The concepts, in the right order

Four things, and getting them straight saves hours of confusion.

**Publishable key** (`pk_...`) — goes in your web page. Public by design. Safe to expose.

**Secret key** (`sk_...`) — goes on your server only. Anyone with it can charge cards and
issue refunds as you. Never in your HTML, never in git, never in a screenshot.

**Checkout Session** — a payment page Stripe hosts. Your server creates one and sends the
customer to it. Card details never touch your server, which removes essentially all your
PCI obligations.

**Webhook** — Stripe calling *your* server to say "this payment succeeded". This is the
only trustworthy signal that money arrived.

---

## The rule that matters most

> **The browser redirect is not proof of payment. The webhook is.**

When a customer pays, Stripe sends them back to your success page. It is tempting to
deliver the course there.

Do not. Anyone can type that URL, and a real customer can close the tab before the
redirect fires. Fulfil in the webhook handler, which is signed, verified and retried for
up to three days. The success page should only *read* what the webhook already recorded.

The second rule, close behind:

> **The server decides the price. Always.**

The browser sends a tier name. It never sends an amount. If it did, someone would open
devtools and buy your £97 tier for one penny, and you would find out at your next payout
reconciliation.

---

## Setup, step by step

### 1. Create the account

[stripe.com](https://stripe.com) → sign up. Business details, bank account. Expect
identity verification — usually minutes, occasionally a few days. **Do this early**, not
on launch day.

### 2. Stay in test mode

There is a toggle in the dashboard. Everything below works identically in test mode with
fake cards. Do not switch to live until you have tested the whole flow.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.
Card that declines: `4000 0000 0000 0002` — test this one too.

### 3. Get your keys

Developers → API keys. Copy both into `.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Set up the webhook

Developers → Webhooks → Add endpoint.

- URL: `https://yourdomain.com/api/webhook`
- Events: `checkout.session.completed`, `charge.refunded`,
  `charge.dispute.created`, `checkout.session.async_payment_succeeded`

Copy the **signing secret** (`whsec_...`) into `.env` as `STRIPE_WEBHOOK_SECRET`.

Without that secret, anyone who finds your webhook URL can POST a fake "payment
succeeded" and mint free downloads. It is the most important secret in the system.

### 5. Test webhooks locally

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

It prints a signing secret for local use. In another terminal:

```bash
stripe trigger checkout.session.completed
```

Watch your server logs. You should see the sale recorded and the delivery email sent.

### 6. Buy your own course

The step people skip, and the one that finds the problems.

Go through checkout with the test card. Then, once live, **buy it again with a real
card** and refund yourself. You will discover things no amount of code reading reveals —
a broken link in the email, a typo in the receipt, a delivery that lands in spam.

---

## The mistake that breaks every webhook

If your webhook signature verification fails on every request, it is almost certainly
this: **a JSON body parser ran before the webhook route.**

Stripe signs the exact bytes it sent. `express.json()` consumes the stream and gives you
an object; re-serialising produces different bytes, so the signature never matches.

The fix is to mount the webhook route with a raw body parser *before* any JSON parser.
In this system's `server.js` that ordering is explicit and commented, because it is the
single most common Stripe integration bug and it presents as "everything returns 400"
with no obvious cause.

---

## Going live

Before you flip the switch:

- [ ] Whole flow tested in test mode, including a declined card
- [ ] Live keys in `.env` (`sk_live_`, `pk_live_`) — never committed
- [ ] A **separate live webhook endpoint** configured with its own signing secret
- [ ] Bank account added and verified in Stripe
- [ ] `NODE_ENV=production`
- [ ] One real purchase made and refunded
- [ ] Refund flow tested — it must revoke download access

This system refuses to start with test keys when `NODE_ENV=production`, specifically to
stop you shipping a checkout that appears to work and charges nobody. That failure mode is
silent and expensive.

---

## Fees and payouts

- **2.9% + 30p** per successful charge, roughly, varying by country and card type
- **Refunds:** you get the fee back on most Stripe plans, but check your region
- **Chargebacks:** typically a £15 fee that is *not* returned even if you win
- **Payouts:** every 2–7 days to your bank, with a longer delay on the first one

At £47, Stripe takes about £1.66. Budget for it.

---

## Action Items

1. **Decide: platform or your own.** Write down the reason.
2. **Create the Stripe account today** — verification can take days, and you do not want
   that on launch day.
3. **Get both keys into `.env`.** Test keys only for now.
4. **Configure the webhook** with the four events, and copy the signing secret.
5. **Run `stripe listen` and `stripe trigger`.** Confirm a sale appears in your dashboard.
6. **Complete a full test purchase** including a declined card.
7. **Work through the go-live checklist** before switching to live keys.

---

**Next:** [[07-Automatic-Delivery|3.7 — Automatic delivery]]

**Related:** [[07-Automatic-Delivery|3.7]] · [[09-Refunds-And-Support|3.9]] ·
`docs/Troubleshooting.md`
