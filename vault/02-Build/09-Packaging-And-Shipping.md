# 2.9 — Packaging and shipping the vault

**10 minutes · Module 2 · [[00-Module-Overview|Back to module]]**

---

## The last mile

You have a written course. What stands between it and a customer is about two hours of
unglamorous work, most of which is checking that you are not about to ship something you
should not.

---

## Step 1 — The read-through

Read the whole thing, in order, in reading view, as a customer would.

Do it in one sitting if you can. You are not editing prose here — you are looking for
four specific things:

- **`TODO` markers** you left in drafting. Search the vault for `TODO`.
- **Broken links.** Obsidian shows unresolved `[[links]]` in a different colour. Fix
  every one; a dead link in a paid product looks careless.
- **Order problems.** Anywhere a lesson assumes something not yet taught.
- **Missing next-links.** Every lesson must link to the next one.

Two hours. It is the highest-value two hours in this module.

---

## Step 2 — Remove what should not ship

**Assume everything in the folder ships, because it does.**

Delete or move out:

- `My Course.md` — your private working notes
- `Course Two.md` — your plans
- `Their Words.md` and `Examples.md` — raw research
- Any draft or scratch file
- `.DS_Store`, `Thumbs.db`, `.obsidian/workspace.json` (contains your file paths)
- **Anything containing a password, API key or personal address**

That last one is the serious one. If you are shipping The Engine-style code alongside your
vault, a `.env` file in the bundle hands every customer your live Stripe secret key. The
`build-vault` script in this system checks for exactly this and refuses to build if it
finds one — but check by hand too.

A quick way to see what a customer will see: copy the folder somewhere else, delete what
should not ship, and open the copy fresh.

---

## Step 3 — The first-five-minutes test

This is the test that determines whether your course feels professional.

Unzip your own file into a new folder. Open it in a file browser — **not Obsidian.**
Look at what a customer sees.

- Is it obvious which file to open first?
- Do the folders appear in the right order? (Numbered prefixes — [[02-Vault-Structure]])
- Is there a `README.md` or `00-Command-Center.md` at the top?
- Would someone who has never used Obsidian know what to do?

Then add a plain `README.md` in the root for people who open the folder outside Obsidian:

```markdown
# [Course name]

Start with 00-Command-Center.md

## How to read this

Every file is plain Markdown text. You can open them in any text editor.

For the best experience, install Obsidian (free, obsidian.md), choose
"Open folder as vault", and select this folder. Links between lessons
become clickable and navigation is much easier.

## Questions

Reply to your purchase email. It reaches a real person.
```

Small file, disproportionate effect on the first impression.

---

## Step 4 — Three readers

Before you sell it, give it to three people. Not for praise:

- **One who knows the subject** — checking for errors
- **One who is your actual target reader** — checking for gaps and confusion
- **One who knows neither** — checking whether the structure makes sense at all

Ask each for one thing specifically: *"Where did you get stuck or bored?"* That question
produces far more useful answers than "what did you think?", which produces politeness.

Give them a deadline, or you will wait three weeks. One week is plenty.

You do not have to act on all of it. You should act on anything two of them say
independently.

---

## Step 5 — Build the ZIP

If you have the backend from The Engine:

```bash
cd backend
npm run build-vault
```

It builds the bundle, excludes secrets automatically, and verifies afterwards that
nothing sensitive leaked in.

By hand:

- **macOS:** right-click the folder → Compress
- **Windows:** right-click → Send to → Compressed (zipped) folder
- **Linux:** `zip -r course.zip vault/ -x '*.DS_Store' '*/.obsidian/workspace.json'`

**Name it properly.** `course.zip` is anonymous and gets lost in a downloads folder.
`product-photography-for-etsy-v1.zip` is findable in six months.

**Check the size.** Under 50 MB ideally. Text is tiny — if yours is large, you have images
that need compressing, and large downloads fail more often on poor connections.

---

## Step 6 — Test it as a customer

Unzip your own ZIP on a different machine if you can, or at least in a different folder.

- Does it unzip cleanly?
- Does Obsidian open it as a vault without complaint?
- Do the links work?
- Is anything missing?
- Is anything present that should not be?

Then, once your checkout is live ([[03-Sell/06-Stripe-Setup]]), **buy your own course**
with a real card. Refund yourself afterwards. This is the only way to find out what the
actual experience is, and people who skip it discover the problem from a customer.

---

## Versioning

Put a version in the ZIP filename and in the Command Center: `v1.0`, dated.

When you update — and you will — bump it, and email your existing customers. This is what
"lifetime updates" means in practice and it is one of the cheapest goodwill generators
available: an email that says "I've added three lessons, here's your new download" costs
you nothing and reminds people you exist.

---

## Action Items

1. **Do the full read-through.** Fix every `TODO` and broken link.
2. **Remove everything private.** Check for keys and personal details specifically.
3. **Write the root `README.md`** using the template above.
4. **Run the first-five-minutes test** on a fresh unzip, in a file browser.
5. **Send it to three readers** with a one-week deadline and the "where did you get
   stuck?" question.
6. **Build the ZIP**, name it properly, and test it on a clean folder.

---

**Module 2 complete.** You have a finished course.

**Next:** [[03-Sell/00-Module-Overview|Module 3 — Sell]]

**Related:** [[02-Vault-Structure|2.2 — Vault structure]] ·
[[03-Sell/07-Automatic-Delivery|3.7 — Automatic delivery]]
