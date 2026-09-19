# 2.1 — Obsidian setup, start to finish

**10 minutes · Module 2 · [[00-Module-Overview|Back to module]]**

---

## What Obsidian is, in one sentence

A free app that turns a folder of plain text files into a navigable, linked document —
and that is all it is.

The important part is the second half. **Your course is a folder of `.md` files on your
own disk.** Obsidian reads them. If Obsidian vanished tomorrow, your files would be
completely unaffected and openable in any text editor ever written.

That is why this system uses it rather than a course platform. No subscription, no export
problem, no company deciding to change its terms.

---

## Install it

1. Go to [obsidian.md](https://obsidian.md) and download for your platform.
2. Install it. Free for personal use, and for this purpose you do not need any paid tier.
3. Open it. Choose **Open folder as vault** and select your course folder.

That is the entire setup. Ignore the account prompt — you do not need one.

---

## The only three things you need to learn

Obsidian has a great many features. You need three of them. Actively ignore the rest for
now — plugins, graph view, canvas and dataview are all genuinely useful later and are a
pure distraction today.

**1. `Cmd/Ctrl + O` — jump to any file by name.** This is how you navigate. Start typing a
lesson name, hit enter. Once this is muscle memory you will stop using the sidebar.

**2. `[[Double brackets]]` — link to another note.** Type `[[` and a search appears.
Picking a note creates a clickable link. Links are how your course stops being a pile of
files and becomes a course.

**3. `Cmd/Ctrl + E` — toggle edit and reading view.** Write in edit view, check your
formatting in reading view.

That is genuinely it. Everything else can wait until the course is written.

---

## Markdown, in ninety seconds

Markdown is how plain text becomes formatted text. The entire subset you need:

```markdown
# Big heading
## Smaller heading
### Smaller still

**bold** and *italic*

- a bullet
- another bullet

1. a numbered item
2. another

> a quote or callout

`inline code`

[link text](https://example.com)
[[Link to another note in the vault]]

| Column | Column |
|--------|--------|
| cell   | cell   |

---  (a horizontal rule)
```

You will use headings, bold, bullets and tables constantly. The rest occasionally. There
is nothing else to learn.

---

## Settings worth changing immediately

**Editor → Default editing mode: Source.** Live Preview hides the Markdown as you type,
which sounds helpful and is confusing when you are learning what the syntax does.

**Editor → Readable line length: on.** Stops lines running the full width of a monitor,
which is fatiguing to read and to write.

**Files & Links → Default location for new notes: same folder as current file.** Keeps
new lessons next to their module rather than in the vault root.

**Appearance → Theme.** Purely taste. Do not spend an hour here.

---

## What NOT to do

**Do not install plugins yet.** There are thousands. They are a fantastic way to spend
three evenings not writing. Once your draft is done, look at Templater and Dataview if
you like. Not before.

**Do not reorganise repeatedly.** The structure in [[02-Vault-Structure]] works. Use it.
Reorganising a vault feels productive and produces no words.

**Do not use Obsidian Sync at first.** It is a paid service and you do not need it.
Your vault is a folder — back it up to Dropbox, iCloud, Google Drive or git like any
other folder.

**Do not write in Canvas.** It is for visual thinking, not for drafting.

---

## Backing up

Your course is the asset. Losing it is the one unrecoverable failure in this project.

Pick one, do it today:

| Method | Effort | Good for |
|--------|--------|----------|
| Put the vault folder inside Dropbox/iCloud/Drive | 2 minutes | Everyone |
| `git init` and commit as you go | 10 minutes | If you already use git |
| Obsidian Sync | paid | If you want mobile editing too |

The folder-in-a-sync-service approach is entirely sufficient and takes two minutes. Do
it now rather than after the incident.

---

## If you would rather not use Obsidian

Completely fine, and worth saying clearly: **every file here is plain Markdown**. It opens
in VS Code, Typora, iA Writer, Notepad, TextEdit, or anything else.

What you lose is the `[[wiki links]]` becoming clickable, which matters more than it
sounds — cross-linking is how readers navigate a course that is not strictly linear.
VS Code with a Markdown preview extension gets you most of the way.

Use whatever you will actually open. The tool is not the point.

---

## Action Items

1. **Install Obsidian** and open this vault in it.
2. **Change the four settings** listed above.
3. **Learn the three shortcuts.** Use `Cmd/Ctrl + O` to jump to
   [[00-Command-Center]] right now, as practice.
4. **Create `My Course.md`** in the vault root if you have not already, and paste in your
   Module 1 decisions.
5. **Set up a backup.** Two minutes. Do not skip this one.

---

**Next:** [[02-Vault-Structure|2.2 — Vault structure that scales]]
