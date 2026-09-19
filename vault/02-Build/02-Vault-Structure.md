# 2.2 — Vault structure that scales

**8 minutes · Module 2 · [[00-Module-Overview|Back to module]]**

---

## The structure

Use this. It is the structure of the vault you are reading, and it works for 15 lessons
or 60.

```
your-course-vault/
├── 00-Command-Center.md          ← the map; the first file anyone opens
├── Resources.md                  ← every tool and link in one place
├── My Course.md                  ← your working notes (remove before shipping)
│
├── 01-[Module-Name]/
│   ├── 00-Module-Overview.md
│   ├── 01-[Lesson-Name].md
│   ├── 02-[Lesson-Name].md
│   └── ...
│
├── 02-[Module-Name]/
│   └── ...
│
└── Templates/
    ├── 00-Templates-Index.md
    └── ...
```

---

## Why the numbers matter

`01-`, `02-` prefixes on both folders and files exist for one reason: **file systems sort
alphabetically, and your customer's file browser is not Obsidian.**

Without numbers, a customer who unzips your course and opens the folder in Finder or
Explorer sees:

```
Advanced-Techniques.md
Getting-Started.md
Introduction.md
Troubleshooting.md
```

Alphabetical, and therefore meaningless. With numbers they see the actual order. This is
a small detail that has a real effect on whether people can use what you sold them.

Use two digits. `10-` sorts before `2-` otherwise.

---

## Naming files

**Use hyphens, not spaces.** `03-Outlining.md`, not `03 Outlining.md`. Spaces in filenames
break links in some tools, produce `%20` in URLs, and cause genuine problems on some
systems.

**Keep names short and descriptive.** The filename is what appears in search, in the
sidebar, and in your links. `05-Writing-The-First-Draft.md` is right.
`05-How-To-Write-Your-Very-First-Draft-Quickly.md` is not.

**Number lessons within their module**, restarting at 01 in each. Lesson 3.2 lives at
`03-Sell/02-Tiers.md`. The module folder supplies the first digit.

---

## The three files that do disproportionate work

### `00-Command-Center.md`

The map. The first thing anyone opens, and the thing they return to when lost.

It should contain: what to read first, the order of modules, a realistic timeline, and a
"when you are stuck, go here" table. Look at [[00-Command-Center]] in this vault — copy
its structure directly.

**This single file does more for perceived quality than any other.** A customer who
unzips a folder of forty files and does not know where to start feels they bought a mess.
The same forty files with a good command center feel like a course.

### `00-Module-Overview.md` (one per module)

What this module is for, what the reader will have at the end, the lesson list with
reading times, and what to do before starting.

These are quick to write and they orient people. They also give you a place to put the
"do not skip this one" warnings.

### `Resources.md`

Every tool, link, template and reference mentioned anywhere in the course, collected. Do
not make people hunt through lessons to find a URL you mentioned once.

---

## Linking: the thing that makes it a course

A pile of files is not a course. Links are what make it one.

Four kinds of link, all of which you should use:

**Sequential.** At the bottom of every lesson: `**Next:** [[02-Vault-Structure|2.2 — ...]]`
Non-negotiable. A reader should never have to go back to the sidebar to continue.

**Upward.** At the top: `[[00-Module-Overview|Back to module]]`.

**Lateral.** In the text, where relevant: *"see [[01-Mindset/06-Ethics-And-Claims]] for
why"*. These are what turn a linear document into something navigable.

**Related, at the end.** Two or three links to lessons that connect.

Use the pipe syntax for readable labels: `[[03-Outlining|2.3 — Outlining]]` renders as
"2.3 — Outlining" while linking to the right file.

---

## What to remove before shipping

Your working vault will accumulate things the customer should not receive:

- `My Course.md` — your private notes
- `Course Two.md` — your future plans
- `Their Words.md` — research notes
- Draft folders, `.DS_Store`, anything half-written
- Any file with your Stripe keys or personal details in it

The packaging step in [[09-Packaging-And-Shipping]] covers this properly, including an
automated check. But keep it in mind as you work: **assume everything in the vault ships**,
and keep private notes in a clearly named file you will remember to remove.

---

## Templates folder

If your course benefits from things people fill in — scripts, checklists, email drafts,
calculators — put them in `Templates/` with an index file.

This is disproportionately valued by customers. A lesson explains; a template removes the
blank page. Many people will say the templates were the most useful part, and they are
usually the fastest part to produce.

---

## Action Items

1. **Create your folder structure** now, with numbered module folders and empty
   `00-Module-Overview.md` files in each.
2. **Create `00-Command-Center.md`** and paste in the structure from this vault's version
   as a starting point.
3. **Create `Resources.md`**, empty. Add to it as you write rather than at the end.
4. **Decide your private-notes filename** and commit to keeping everything private in it,
   so removal before shipping is one step.

---

**Next:** [[03-Outlining|2.3 — Outlining: modules and lessons]]

**Related:** [[09-Packaging-And-Shipping|2.9 — Packaging and shipping]]
