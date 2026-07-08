# Editing The Eisenbalm Dispatch — A Quick Start for Andrew

**Your job:** each week the AI pipeline drops a complete draft issue into Sanity. You review it, fix anything that's off, and publish it. Publishing puts it live on the site.

## 1. Getting in
1. Accept the Sanity invitation in your email (use that same email to sign in).
2. Open the Studio — bookmark this:
   **https://www.sanity.io/@oQDel4DgH/studio/d738z65twme9fhe369spltme/eisenbalm-dispatch/structure**
3. You'll see the list of **Weekly Issues**. New ones arrive as **Drafts**.

## 2. The three statuses (top of each issue)
- **Draft** — the pipeline's first output. Not on the site.
- **In Review (Andrew)** — set this while you're working on it, so it's clear it's in your hands.
- **Published** — live on the site.

## 3. Reviewing an issue
Open the latest Draft and read it top to bottom. It has these sections — check each one:
- **Featured Charity, Headline, Origin story, Problem Statement (+ its PDF), Founder/Case Study, The Game, Bonus, Selection Deliberation, Podcast.**

What to actually look for:
- **Voice.** Jesse is *dry, precise, and seriously sincere* — never winking, never jokey, no emoji. If a line is trying to be cute or ironic, rewrite it flat and serious. This is the one thing only you can guard.
- **Facts about the charity** — names, places, numbers. Fix anything that reads wrong.
- **The Theme colors / fonts** (the color section) — these set the issue's look. Leave them unless something is unreadable.
- **The Game** — there's an embed; it'll render in preview. Just confirm it loads and behaves.
- Anything blank or obviously broken — fix or flag.

Edits save automatically as you type.

## 4. Publishing
When it's ready:
1. Set the **Status** dropdown to **Published**.
2. Click the **Publish** button at the bottom of the editor.

*(Both steps matter — the site only shows issues that are Published **and** marked Published in that dropdown.)* Within a minute or so it appears on the live site.

## 5. Please don't touch
You're an Administrator, so you *can* see everything — but stay out of **Project Settings → API / Tokens / Webhooks** and don't remove the **"studio-seed (Robot)"** member. Those are the plumbing that lets the pipeline write your drafts; changing them silently breaks next week's issue.

## 6. Stuck?
Anything that won't publish, looks broken, or you're unsure about — ping Ghislain. Nothing you do in an issue is permanent until you hit Publish.

## 7. Soak & retiring Studio publish (Phase 34)

The dispatch-control console is now the editing + publishing surface of
record for weekly issues — you review, edit, and publish from the console's
Review Desk, using the two sign-offs there ("Facts cleared" + "Sounds
human"). Studio remains available as a **read-only fallback** for
emergencies: if a direct Studio publish is attempted on a run that hasn't
been signed off in the console, the pipeline reverts it back to "In Review"
and it never goes live — the console gate cannot be bypassed by flipping
the Studio status dropdown.

**Soak-end criterion:** during this soak period, the console is the
publishing surface and Studio is the tested-but-unused fallback. Once 2–3
consecutive real weekly issues have shipped entirely via the console with
no Studio publish fallback needed, the soak ends: the
`SANITY_STUDIO_DISABLE_PUBLISH` env flag is set to `true` and Studio is
redeployed — this removes the **Publish** button from weekly issues in
Studio entirely (other document types are unaffected). There is no
automatic counter; this is a manual decision Andrew/Ghislain makes together
against the criterion above.

Studio remains open for **editing** as a read-only-publish fallback even
after the flag flips — only the publish action is removed. Full Studio
retirement (content moved elsewhere, Studio deleted) is a separate,
later milestone.
