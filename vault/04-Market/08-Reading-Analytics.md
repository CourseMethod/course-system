# 4.8 — Reading your analytics

**10 minutes · Module 4 · [[00-Module-Overview|Back to module]]**

---

## Most numbers are noise

Views, likes, followers. They feel like the score and they mostly are not, because they
do not tell you **what to change**.

A useful metric answers a specific question and points at a specific action. Everything
else is a mood.

---

## The five numbers that matter

### 1. Retention at three seconds

**Where:** your platform's per-post analytics, usually a retention graph.

**What it means:** the hook worked, or it did not.

| Retention | Diagnosis |
|-----------|-----------|
| Under 40% | Hook is failing. Nothing else matters yet |
| 40–60% | Weak hook |
| 60–75% | Working |
| 75%+ | Strong |

**This is the most actionable number you have.** If it is low, the fix is
[[03-Hooks]] and nothing else. Do not change your topic, your editing or your posting
time until this is above 60%.

### 2. Average watch percentage

**What it means:** the content delivered on the hook's promise.

Good retention at three seconds with a low average means the hook wrote a cheque the post
did not cash — usually too much setup before the payoff ([[04-Reel-Scripts]]).

### 3. Shares and saves

The strongest positive signals a platform can see, and the best guide to what to make
more of. Someone sharing has vouched for you to a friend.

**Look at your top three by shares.** What do they have in common? That is your format.

### 4. Click-through to your link

**Where:** your bio link tool, or the `utm_source` column in this system's admin
dashboard.

Lots of views and no clicks means the content is entertaining but not connected to what
you sell. The bridge is usually the close ([[04-Reel-Scripts]]) or the bio.

### 5. Conversion rate on your sales page

**Where:** `/admin.html` → the funnel.

Of people who arrive, how many buy.

| Rate | Meaning |
|------|---------|
| Under 0.5% | Page or traffic is wrong |
| 0.5–1% | Low. Usually a mismatch between post and page |
| **1–3%** | **Normal for cold traffic** |
| 3%+ | Strong |

---

## Diagnosing with two numbers

The useful trick: **combine views and conversion** to locate the actual problem.

| Views | Conversion | Problem | Fix |
|-------|-----------|---------|-----|
| Low | — | Nobody sees it | [[03-Hooks]], post more |
| High | Very low | Wrong audience, or page fails | See below |
| High | Low | Page problem | [[03-Sell/03-The-Sales-Page]] |
| Low | High | **Good problem.** It works, needs volume | Post more |
| High | High | Working | Do more of it |

That last-but-one row is worth flagging: **a low-traffic page converting at 4% is not
failing.** It is working and starved. The fix is distribution, not redesign — and people
routinely rebuild a perfectly good page instead.

---

## Separating "wrong audience" from "bad page"

High views, near-zero conversion, two possible causes:

**Wrong audience.** Your content attracted people with no interest in the outcome.
Entertainment-shaped posts do this — they travel well and bring viewers, not buyers.
Symptom: high views, high engagement, no clicks at all.

**Page failing.** The right people arrive and leave. Symptom: clicks happen, purchases do
not.

The distinguishing number is **click-through**. Clicks but no sales is a page problem.
No clicks is an audience problem.

---

## What to check, and when

**Weekly, 15 minutes.** Not daily — daily numbers are noise and checking them constantly
is a good way to feel bad about normal variance.

1. Which post had the best 3-second retention? Why?
2. Which had the most shares? Why?
3. Clicks to your link this week?
4. Sales and conversion rate in the dashboard?
5. **One thing to change next week.** One.

Write the answers down. Patterns only become visible across weeks, and memory is
unreliable about which post did what.

---

## Sample size

The single most common analytical error here: concluding from one post.

One post doing well is noise. **You need roughly ten posts of a given format before you
can say anything about that format**, and a sales page needs about 200 visitors before its
conversion rate means anything at all.

Before those thresholds, keep going and do not redesign. Acting on noise is worse than
acting on nothing, because it destroys the consistency that would have produced a signal.

---

## Attribution

This system tags every purchase with the `utm_source` from the link the buyer arrived
through. Use it — add `?utm_source=instagram` to your bio link, `?utm_source=tiktok` to
that one.

The admin dashboard then shows sales by source, which answers the question everyone
guesses at: **which platform is actually producing buyers**, as opposed to producing
views. Those are frequently different, and the gap is expensive if you do not know about
it.

---

## Vanity metrics to actively ignore

- **Follower count.** A lagging indicator. Chasing it directly produces an audience that
  does not buy.
- **Likes.** The weakest signal, and almost uncorrelated with sales.
- **Total views across all time.** Feels good, tells you nothing.
- **Other people's numbers.** You do not know their conversion rate, their costs, or
  whether the screenshot is real.

---

## Action Items

1. **Find the retention graph** on your platform. Look at your last five posts. Note the
   3-second number for each.
2. **Add UTM tags** to every link you post, one per platform.
3. **Set up a weekly 15-minute review** in your calendar. Same time each week.
4. **Create `Weekly-Numbers.md`** with a row per week: best retention, most shares,
   clicks, sales, one change.
5. **Diagnose using the two-number table** before changing anything.
6. **Write your sample-size rule** down: ten posts per format, 200 visitors before
   judging the page.

---

**Next:** [[09-When-Nothing-Works|4.9 — What to do when nothing works]]

**Related:** [[03-Hooks|4.3]] · [[03-Sell/03-The-Sales-Page|3.3]] ·
`docs/Analytics-Setup.md`
