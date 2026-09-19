# 3.9 — Refunds, chargebacks and support

**13 minutes · Module 3 · [[00-Module-Overview|Back to module]]**

---

## The economics nobody explains

A refund costs you the sale price.

**A chargeback costs you the sale price, a non-refundable fee of roughly £15, and a mark
against your account.** Sustained chargeback rates above about 0.75% put your ability to
take payments at risk entirely.

So the single most valuable thing in this lesson: **make refunds so easy that nobody ever
needs to go to their bank.** Every difficult refund process converts a £47 loss into a £62
loss plus account risk.

That is the whole argument. It happens to also be the decent way to treat people.

---

## The guarantee that works

**14 days. No conditions. No questions.**

Put it in its own section on the page, not a footnote.

### Why not a conditional guarantee

You will see "action-based guarantees" — complete the modules, show your work, then you
qualify for a refund. The pitch is that it filters out non-committed buyers.

What it actually does:

- Signals you expect to be asked, and want to make it hard
- Creates an argument at exactly the moment you want a clean exit
- Sends the person to their bank instead, where you lose more
- Reads, to a sceptical buyer, as a reason to not buy at all

An unconditional guarantee converts better and costs less. The refund rate difference is
small; the chargeback and goodwill difference is not.

### Let them keep the files

Clawing back a download from someone who did not want it is petty and impractical. Say so:

> "You keep the files. I'd rather you thought well of this than felt trapped by it."

That sentence does more for your reputation than the £47 does for your bank balance.

---

## How to handle a refund request

**Within one business day. No questions. No retention attempt.**

```
Hi [name],

Refunded — it'll be back on your card in 5–10 days (that's your bank's
timing, not mine).

No hard feelings at all. Keep the vault if it's any use to you.

If there was something specific that didn't work, I'd genuinely like to
know — one line is plenty, and it's how this gets better. But no
obligation.

[Your name]
```

Note what is absent: no "are you sure?", no "have you tried...?", no discount offer, no
three-email retention sequence. Those recover a small number of refunds and generate
chargebacks and bad word-of-mouth from the rest.

**Ask for feedback after refunding, not before.** Before, it is an obstacle. After, it is
a genuine question and people often answer it usefully.

---

## What your refund rate is telling you

| Rate | Meaning |
|------|---------|
| 0–3% | Normal and healthy |
| 3–8% | Fine. Worth reading the reasons |
| 8–15% | Something is wrong. Usually the page promises more than the course delivers |
| 15%+ | Stop selling and fix it |

**A high refund rate is a product-marketing mismatch, not a product quality problem.**
The usual cause is a sales page that oversells. Fixing the page fixes the rate, and the
"who it isn't for" section from [[03-The-Sales-Page]] is the most effective single change.

Track the reasons. Three people giving the same reason is a specific, fixable defect.

---

## Chargebacks

A chargeback is the customer telling their bank the charge was wrong, rather than telling
you. You find out when Stripe notifies you and takes the money back.

### Why they happen

1. **They could not find how to get a refund** — entirely preventable, and the most common
2. **They did not recognise the charge** on their statement
3. **They never received the product** — a delivery failure
4. **Actual fraud** — a stolen card

Numbers 1–3 are yours to prevent.

### Preventing them

- **Refund link in the footer, in the emails, everywhere.** Make it easier than the bank.
- **Set your Stripe statement descriptor** to something recognisable. If it shows as
  "SP* 4X9QTR", people dispute it.
- **Reliable delivery**, with monitoring and alerts ([[07-Automatic-Delivery]]).
- **Reply fast.** Most chargebacks follow an unanswered email.

### If you get one

You have a limited window to submit evidence. What wins:

- The delivery email record — sent time, and whether it was opened
- The download log — proof they downloaded it
- Your refund policy text, as displayed on the page at the time
- Any correspondence
- Proof of what was purchased and delivered

The admin dashboard in this system surfaces all of this in one place, and the system
emails you the moment a dispute opens, because the window is short.

Be realistic: you will lose a fair share of digital-goods disputes even with good
evidence. Prevention is where the effort pays.

---

## Support

### Reply within 24 hours

That is the whole standard. Not "be available constantly" — reply once a day, reliably.

A slow reply produces a refund request. An unanswered one produces a chargeback.

### Reply-to must be a real inbox

"Reply to this email" is the best support channel you have. A `no-reply@` address tells
people you do not want to hear from them, and they act accordingly.

### The tickets that repeat

Four of them will be most of your volume:

| Ticket | Prevention |
|--------|-----------|
| "I didn't get the email" | Deliverability ([[07-Automatic-Delivery]]) + self-serve resend |
| "My link expired" | Self-serve resend form |
| "How do I open this?" | Root `README.md` + orientation email |
| "Can I get a refund?" | Just do it |

Every one is preventable with something you build once. The system here includes the
resend form and the acknowledgement emails specifically because these four make up the
bulk of a course business's support.

### Canned replies save real time

Keep a file of them. Not to be impersonal — to be fast and consistent. Templates for all
four of the above are in `Templates/Support-Replies.md`.

---

## The thing worth internalising

Your customers are overwhelmingly reasonable people who bought something in good faith.
A small number will want their money back, usually for legitimate reasons.

Treating that gracefully costs you a few pounds and earns disproportionate goodwill.
Fighting it costs you more money, more time, and eventually your payment processor.

---

## Action Items

1. **Write your guarantee.** 14 days, unconditional. Put it in its own section on the
   page.
2. **Put a refund link in the footer** and in your emails. Easier to find than the bank.
3. **Set your Stripe statement descriptor** to your recognisable brand name. Do it today.
4. **Write the four canned replies** in `Templates/Support-Replies.md`.
5. **Decide your reply commitment** — 24 hours — and put it on the page so it is a
   promise you keep.
6. **Test the refund flow end to end**: request → refund issued → access revoked →
   confirmation email received.

---

**Module 3 complete.** You have a live page that takes money and delivers automatically.

**Next:** [[04-Market/00-Module-Overview|Module 4 — Market]]

**Related:** [[03-The-Sales-Page|3.3]] · [[07-Automatic-Delivery|3.7]] ·
`docs/Troubleshooting.md`
