# 3.8 — The email sequence after a sale

**12 minutes · Module 3 · [[00-Module-Overview|Back to module]]**

---

## Why bother

Because the sale is not the finish line. What happens in the two weeks afterwards decides:

- Whether they **use** the course (which decides everything else)
- Whether they **refund**
- Whether they become a **testimonial** ([[05-Bonus/04-Collecting-Testimonials]])
- Whether they buy anything from you **again**

A customer who opens the vault in the first 48 hours rarely refunds. One who files it
"for the weekend" often does. The sequence exists to move people from the second group to
the first.

---

## The sequence

Six emails over 45 days. All of them are in `backend/templates/` if you have The Engine,
and in `Templates/Email-Sequence.md` either way.

| When | Email | Job |
|------|-------|-----|
| Immediately | **Delivery** | Get them the file |
| +15 min | **Welcome** | Set expectations, prevent overwhelm |
| Day 2 | **Orientation** | Remove setup friction |
| Day 7 | **Check-in** | Catch the people who have not started |
| Day 21 | **What others built** | Show it working, ask for their story |
| Day 30 | **Upgrade** | Only to lower-tier customers |
| Day 45 | **Feedback request** | Collect real testimonials |

---

## 1. Delivery — the most important email you will ever send

If this fails or lands in spam, the customer's experience is "I paid and got nothing",
and that becomes a refund or a chargeback within the hour.

**Rules:**

- Send within a minute
- Subject line plain and searchable: `The Method — your download link`. No emoji, no
  marketing language, nothing that trips a promotional filter
- The link is the first thing after one sentence
- No upsell, no story, no branding flourish
- Tell them how long the link lasts and that a replacement is free and instant

This is a transactional email. Every marketing element you add raises the chance it does
not arrive.

---

## 2. Welcome (+15 minutes)

Now you can be warmer. Its job is preventing the thing that kills completion: **overwhelm.**

Forty lessons is intimidating. Without guidance, people either binge it (and retain
nothing) or postpone it (and never start).

So the welcome email says, in effect: *do not read it all. Read one lesson, do the thing
at the bottom, then read the next.* Then it gives a realistic week-by-week picture so they
can tell progress from motion, and ends with **one specific thing to do today**.

That last part matters most. "Get started when you can" produces nothing. "Open lesson
1.2 and do the twelve-minute exercise" produces a started customer.

---

## 3. Orientation (Day 2)

Pure friction removal. The four questions everyone actually asks:

- "Obsidian looks complicated" → the three shortcuts you need, and what to ignore
- "Do I have to use Obsidian?" → no, here is what else works
- "Where do I start?" → the Command Center
- "My link expired" → here is a new one, free, always

Answering these before they are asked removes most of your early support volume.

---

## 4. Check-in (Day 7)

The highest-leverage email in the sequence, and it works by being genuinely easy to reply
to.

Give three possible answers, one of which is permission to admit they have not started:

> - **"Building"** — reply with your topic, I'm curious
> - **"Stuck"** — reply with what
> - **"Haven't opened it"** — reply with just that. No judgement, and I have a suggestion

That third option is the point. A meaningful fraction of buyers have not opened it by day
seven, and they are the ones who refund and who never become advocates. Making it socially
easy to admit gets you a reply, and a reply is a chance to help.

**Ask a real question and mean it.** Emails that ask for a reply and receive one are also
the strongest possible deliverability signal — replies teach the mail provider that your
address is wanted.

---

## 5. What others built (Day 21)

Social proof, and a request.

**Important:** this email renders real testimonials from your database. If you have none,
the version in this system sends a different email entirely — asking what they are
building — rather than inventing anyone.

Do not put placeholder quotes in here "for now". See
[[01-Mindset/06-Ethics-And-Claims]].

---

## 6. Upgrade (Day 30, lower tier only)

Segment this properly — sending an upgrade email to someone who already bought the top
tier makes you look like you are not paying attention.

The structure that works:

1. Name the wall they are about to hit, specifically
2. Explain what the upgrade removes
3. Price, as the difference only
4. **Explicitly say they do not need it**

That fourth part is what makes the other three credible:

> "And to be straight with you: you do not need this. Everything it automates can be done
> by hand. Gumroad will take payments and deliver a file for a cut of each sale, and for
> your first few sales that is genuinely the sensible choice."

Counter-intuitive, and it converts better than pressure — because the reader has been
pitched a thousand times and almost never told the truth about whether they need it.

**One upsell email. Not a five-part sequence.** You sold them something; let them use it.

---

## 7. Feedback request (Day 45)

How the testimonials table gets filled with real material.

The critical detail: **ask for the feedback and ask for permission to publish it as two
separate questions.** Conflating them is how sellers end up publishing quotes they were
never given permission to use.

And if they mention numbers, say up front that you will ask for a screenshot before
publishing — framed as *"because if I put a figure on a sales page I have to be able to
stand behind it"*, which is both true and reassuring rather than suspicious.

---

## Practical notes

**Transactional vs marketing.** Delivery and receipts are transactional and may be sent
regardless. The rest are arguably marketing — include an unsubscribe link, and honour it.
The templates here do.

**Unsubscribes are fine.** Someone who does not want your emails was never going to buy
again. A clean list delivers better than a large one.

**Reply-to must be a real inbox you read.** "Reply to this email" is the single best
support channel you have, and a `no-reply@` address tells people you do not want to hear
from them.

**Do not automate beyond day 45** on a first product. You do not have enough to say yet,
and a sequence that runs for six months with nothing new is how people learn to ignore
you.

---

## Action Items

1. **Read the six templates** in `Templates/Email-Sequence.md` and rewrite them in your
   voice. They are a structure, not a script.
2. **Check your delivery email** against the rules: plain subject, link first, no upsell.
3. **Write your day-7 check-in** with three easy replies, including permission to say "I
   haven't started".
4. **Segment the upsell** so it only reaches lower-tier customers.
5. **Send yourself the whole sequence** and read each one on a phone.
6. **Confirm reply-to** goes to an inbox you actually read.

---

**Next:** [[09-Refunds-And-Support|3.9 — Refunds, chargebacks and support]]

**Related:** [[07-Automatic-Delivery|3.7 — Automatic delivery]] ·
[[05-Bonus/04-Collecting-Testimonials|5.4 — Collecting testimonials]]
