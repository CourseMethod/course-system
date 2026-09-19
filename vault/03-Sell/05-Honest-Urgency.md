# 3.5 — Honest urgency and real scarcity

**11 minutes · Module 3 · [[00-Module-Overview|Back to module]]**

---

## The problem with urgency

It works. That is not in dispute — a deadline reliably increases conversion, because
without one there is no cost to deciding later, and "later" usually means never.

It is also the place where course sellers most often cross from persuasion into fraud,
and the line is simple enough to state in two sentences:

> **A deadline is honest if the thing it promises actually happens.**
> **A limit is honest if the thing it promises actually runs out.**

Everything else in this lesson follows from those.

---

## What fake urgency costs you

Three distinct costs, and people usually only consider the third.

**1. It is a deceptive practice.** Under the FTC Act in the US, the CPRs in the UK, and
equivalents elsewhere, a deadline you do not intend to honour is actionable. So is a
scarcity claim about a product that cannot run out.

**2. Payment processors treat it as a fraud signal.** Stripe and its peers have seen every
variant. Fake countdowns correlate with chargebacks, and account review is not a process
you want to be in.

**3. It is spotted in about four seconds.** Refresh the page and the timer resets. Your
reader has done this before, on other sites, and they will do it to you. At that moment
every other claim on the page becomes suspect — including the true ones.

That third cost is the one that matters commercially. You do not get caught and punished;
you get quietly disbelieved and they leave.

---

## Honest urgency that works

### 1. A real launch price

The cleanest option. You state a price, a date, and a higher price after that date. Then
the price actually goes up and stays up.

> "Launch price is £47 until Friday 3rd October. After that it's £79."

To make it real: **change it on Friday.** Not "extend the launch because sales were slow"
— that is the same lie with extra steps, and anyone who saw the first deadline notices.

This system enforces it in software. You set `LAUNCH_PRICE_ENDS_AT` and the higher prices
in `.env`; when the deadline passes, the server charges the higher amount and the page
shows the new price. The countdown and the till are the same fact, and you could not make
them disagree without editing code.

### 2. A real cohort limit

If your offer includes **your time** — support, feedback, a call — the limit is genuine.
You cannot support unlimited people at once, and saying so is straightforwardly true.

> "The Engine includes 30 days of direct support. I can carry about 15 of those at a time,
> so that tier closes at 15 and reopens when the current group finishes."

This is real scarcity and it is the strongest version available to you, because it has an
actual mechanism behind it. The backend counts real sales and closes checkout at the cap.

### 3. A genuinely time-limited bonus

> "Buy before Friday and I'll review your first draft personally. I can do a handful of
> these, so it's this week only."

Real, because your time is real. Honour it precisely.

### 4. Real-world deadlines

If your course is about tax returns, the filing deadline is urgency you did not have to
manufacture. Most topics have something like this — a season, a term, a renewal date.

---

## What not to do

| Don't | Why |
|-------|-----|
| A countdown that resets on refresh | Deceptive, and trivially caught |
| "Only 5 copies left" of a digital file | Files do not run out. Everyone knows this |
| "Price goes up tonight" every night | Same lie, repeated |
| "27 people viewing this page" | Almost always fabricated; assume it is disbelieved |
| "Sale ends soon" with no date | Meaningless, and reads as meaningless |
| Extending a deadline you announced | Teaches people your deadlines are fiction |
| A permanent "was £197" nobody paid | Fictitious pricing — a specific regulatory offence |

---

## The case for no urgency at all

Entirely viable. Many good products sell at a fixed price with no deadline, and their
pages are calmer and more credible for it.

You lose some conversion from people who would have been pushed over the line. You gain a
page that does not have to be defended, and you never have to remember what you claimed.

**If you cannot make urgency real, do not fake it — omit it.** The default configuration
in this system has no countdown for exactly that reason: you have to deliberately
configure a real launch window to get one.

---

## A note on the "closing forever" launch

Some sellers run a cart that opens and closes on a cycle, with the course genuinely
unavailable in between.

This is honest if it is true, and it does produce strong urgency. It also costs you every
sale during the closed period, requires real discipline, and irritates people who arrive
at the wrong moment.

Not recommended for a first product. You need sales more than you need scarcity.

---

## How to word it

Honest urgency should sound matter-of-fact, not breathless. The tone is the tell.

> Weak: "🔥 HURRY! Price DOUBLES at midnight! Don't miss out!!!"
> Strong: "Launch price ends Friday. After that it's £79."

The second is more credible precisely because it is not trying. If your urgency is real,
you do not need to shout about it — stating it plainly is enough, and shouting makes a
true claim sound false.

---

## Action Items

1. **Decide: urgency or none?** If you cannot make it genuinely real, choose none. That
   is a legitimate answer.
2. **If a launch price:** set the date, set the higher price, put both in `.env`, and put
   the date in your calendar so you actually honour it.
3. **If a cohort limit:** work out the real number you can support, and configure it. Do
   not pick a number for effect.
4. **Check your page** against the "don't" table. Remove anything that matches.
5. **Read your urgency copy aloud.** If it sounds breathless, rewrite it flatter.

---

**Next:** [[06-Stripe-Setup|3.6 — Stripe setup, end to end]]

**Related:** [[01-Mindset/06-Ethics-And-Claims|1.6 — Ethics and claims]] ·
[[01-Pricing|3.1 — Pricing]] · [[04-Writing-Copy|3.4 — Writing copy]]
