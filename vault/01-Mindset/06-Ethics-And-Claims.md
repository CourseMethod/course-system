# 1.6 — Ethics, claims and what you may not say

**12 minutes · Module 1 · [[00-Module-Overview|Back to module]]**

> **Read this one properly.** It is the lesson people skip, and it is the only lesson in
> the vault where getting it wrong can cost you money you do not have, your payment
> processor, or a regulator's attention. Everything else here is advice. Parts of this
> are law.

---

## Why this sits in Module 1

Because the constraints shape what you build, and finding out at launch that your central
promise is not one you are allowed to make means rewriting everything.

It is also, less cynically, the thing that separates a business you can be proud of from
one you have to keep quiet about at parties.

---

## The single rule underneath all of it

**Do not say things that are not true, and do not imply things you cannot support.**

That is genuinely the whole of it. The rest of this lesson is that rule applied to the
four places people break it without meaning to.

---

## 1. Income and results claims

This is the big one, and the rule is stricter than most people assume.

**If you state or imply a financial result, you must be able to substantiate it** — with
evidence, for the claim as a typical customer would understand it. In the US that is the
FTC Act and the 2024 Rule on Deceptive Earnings Claims; the UK has the equivalent under
the CPRs and ASA codes; most jurisdictions have something similar.

What that means in practice:

| Don't | Why | Do instead |
|-------|-----|------------|
| "Make £5k/month" | You cannot support it for a typical buyer | Say nothing about income |
| "Students make £2k/month" | Requires substantiation that it is typical | "Here is what one customer reported, with permission" |
| "£1,188 in 30 days" (as *your* result) | Fine **only** if it is your real, documented result — and you say whose it is | Screenshot it, state the period, state it is yours |
| "Replace your salary" | Implied earnings claim | "Here is what the course covers" |
| "Results not typical" as a fix | Disclaimers do **not** cure an unrepresentative claim | Do not make the claim |

That last row surprises people. Small print does not rescue a misleading headline. If the
overall impression is "you will make money", the fine print underneath does not undo it.

**The safe position, and the one this system's sales page takes by default:** make no
income claim at all. Describe what the product *is*, not what the buyer will *earn*. It
converts better than you expect, because specificity about the product is more credible
than a number the reader already discounts.

---

## 2. Testimonials

Since 2024 the FTC's Rule on Consumer Reviews and Testimonials (16 CFR Part 465) carries
civil penalties **per violation**. The prohibited list includes things people do casually:

- Writing a testimonial yourself and attributing it to a customer or a made-up person
- Buying reviews
- Using a real quote out of context so it means something else
- Publishing a customer's words without permission to do so
- Suppressing negative reviews while showing positive ones
- Presenting an exceptional result as though it were ordinary

**And separately:** a testimonial quoting a result becomes *your* claim the moment you
publish it. "Sarah made £3,000 in her first month" on your page is an earnings claim you
must substantiate, not a quote you are merely repeating.

### The workflow that keeps you clean

1. Ask customers for feedback (the system does this automatically — see
   [[05-Bonus/04-Collecting-Testimonials]]).
2. If you want to publish it, ask **explicitly and separately** for permission to quote
   them publicly, with the name you would use.
3. If they quote numbers, **ask for a screenshot** before publishing. Not because you
   doubt them — because you are the one who has to stand behind it.
4. Only then mark it approved.

The admin dashboard in this system enforces steps 2 and 4 in software: a testimonial
cannot be published without consent recorded against it. That is deliberate friction.

**Do not put placeholder testimonials on your page "temporarily".** It is the exact thing
that is illegal, it is trivially spotted, and payment processors treat fake social proof
as a fraud indicator. Losing Stripe ends the business the same afternoon.

---

## 3. Urgency and scarcity

Both work. Both are legal. Both become deceptive practices the moment they are fake.

**A deadline is honest if the thing it promises actually happens.**
**A limit is honest if the thing it promises actually runs out.**

So:

- A countdown to a price rise is fine — if the price genuinely rises and stays risen.
- A countdown that resets when you refresh is a deceptive practice, and obvious.
- "Only 5 spots left" is fine — if there are five, and you stop at zero.
- "Only 5 spots left" on an infinitely-copyable file is a lie.
- Closing a cohort because you personally cannot support more people at once is real
  scarcity. Use that one.

The backend in this system enforces both for you: when the countdown hits zero the server
actually charges more, and when a cohort cap is reached checkout genuinely closes. That is
not decoration — it means every urgency claim on your page is one you can defend.

Full detail in [[03-Sell/05-Honest-Urgency]].

---

## 4. What you are and are not

- Do not call yourself certified, accredited or qualified unless you are.
- Do not imply endorsement by a brand, platform or institution that has not endorsed you.
- Do not use someone's logo to suggest affiliation.
- Do not present stock photos as your customers.
- Do not imply a track record you do not have ("years of experience helping clients" when
  there have been no clients).

---

## The areas where you need to be more careful than usual

Some subjects carry duties beyond ordinary honesty. If your course touches any of these,
get advice appropriate to your jurisdiction before you sell:

- **Medical, health, nutrition, mental health** — claims about treating conditions are
  heavily regulated
- **Financial advice, investing, trading** — often requires licensing
- **Legal advice** — likewise
- **Immigration advice** — regulated in many countries
- **Anything aimed at children**, which brings data-protection obligations

Teaching *how you personally did something* is generally safer than *advising others what
they should do*, but that distinction is thinner than people assume and is not a
substitute for advice.

---

## The commercial case, if the ethical one is not enough

Your reader has seen a hundred of these pages. Their default assumption is that you are
exaggerating. Every unsupportable claim you make confirms it; every verifiable specific
detail disconfirms it.

This is why [[03-Sell/04-Writing-Copy]] argues that honesty outperforms hype rather than
merely being nicer. "I don't have testimonials yet, here is what I do have" is a stronger
position than three invented five-star quotes, because the reader believes the first one.

---

## Action Items

1. **Write your claims list.** Every promise you intend to make, one per line.
2. **Next to each, write the evidence.** If a line has no evidence, delete the claim —
   not the evidence column.
3. **Decide your income-claim position now.** The recommended default: make none. Write
   it in `My Course.md` so you do not drift later.
4. **If your topic is in a regulated area**, note what you need to check before selling.
   Do it now, not after you have written 40 lessons.
5. **Bookmark** [[03-Sell/05-Honest-Urgency]] and [[05-Bonus/04-Collecting-Testimonials]]
   — you will need both at launch.

---

**Next:** [[07-Realistic-Expectations|1.7 — What realistic actually looks like]]

**Related:** [[03-Sell/04-Writing-Copy|3.4 — Writing copy]] ·
[[03-Sell/09-Refunds-And-Support|3.9 — Refunds and support]]
