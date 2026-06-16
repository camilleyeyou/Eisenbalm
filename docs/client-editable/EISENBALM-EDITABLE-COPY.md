# Eisenbalm Dispatch — Editable Copy

## How to use this document

This document contains every piece of English copy that you, the client, can revise: the eight transactional and marketing emails sent after a purchase, and the ten AI agent prompts that produce the weekly editorial content.

Two rules, and they are the only two rules:

1. **Edit the wording only.** Do not change the ALL-CAPS section labels (e.g. `PART 1 — EMAIL COPY`), the `SOURCE:` lines, the `---` dividers, or any placeholder in curly braces such as `{firstName}` or `{charity name, location}`. Those are either machine-readable anchors we use to route your edits back to the code, or live tokens the system fills in automatically. Changing or deleting them will break something.

2. **When in doubt, leave an inline question in the document.** Write your question or hesitation in plain text — something like "NOT SURE: should this be more direct?" — and we will address it when we implement. Do not guess.

When you are done editing, send the whole document back. We map your wording changes back to the source files using the `SOURCE:` labels and the `---` delimiters.

**Voice.** Everything here is Jesse's voice: dry, precise, sincere, played completely straight. No winking. No irony signaling. No emoji. Charities are treated with the same gravity a journalist would bring to a Fortune 500 company. Founders are treated as visionaries regardless of their organization's size. If a sentence sounds like it is trying to be funny, it is wrong.

---

## PART 1 — EMAIL COPY

The eight emails below are sent to customers after they purchase Jesse A. Eisenbalm lip balm. Emails 1–3 are transactional (order confirmation, shipping, estimated delivery). Emails 4–8 are marketing and carry an unsubscribe link. Edit the subject lines and body copy. The footer appears once, after all eight email blocks.

---

### E1 — Order Confirmation

SOURCE: templates/OrderConfirmation.tsx

Subject: Your order is confirmed.

Body:

Order confirmed.

{amountDisplay} received. One unit of Jesse A. Eisenbalm lip balm has entered the fulfillment queue.

One hundred percent of proceeds fund {charity name, location}. That is not a marketing claim. That is where the money went.

You will receive a shipping notification when the package leaves the building. No further action is required on your part.

Keep these placeholders exactly: {amountDisplay}, {charity name, location}

---

### E2 — Shipping Notice

SOURCE: templates/Shipping.tsx

Subject: Your lip balm has shipped.

Body:

It has been handed to the carrier.

Your lip balm is in transit. Another machine now knows where you live. This is the standard arrangement.

Estimated delivery: a few days. The carrier will not share further details with us, and we will not pretend otherwise.

You will receive one more message when the package is expected to arrive.

Keep these placeholders exactly: (none)

---

### E3 — Delivery Estimate

SOURCE: templates/DeliveredEstimate.tsx

Subject: It should reach you any day now.

Body:

It should reach you any day now.

Based on the estimated transit window, your package is on its way to you. We have no carrier data beyond that, so this is an estimate.

If the package has not reached you within the next few days, contact us and we will look into it. We do not believe in writing off packages prematurely.

In a few days, a follow-up message will arrive with a note about the charity your purchase supported.

Keep these placeholders exactly: (none)

---

### E4 — The Ritual

SOURCE: templates/TheRitual.tsx

Subject: A brief word about what you bought.

Body:

The three-second pause.

Before applying, stop. Three seconds. Nothing is required of you in that interval.

This is the ritual. It is not a meditation practice. It is not self-care in the contemporary sense. It is simply three seconds in which a machine is not telling you what to do.

Jesse A. Eisenbalm was formulated by a machine and applied by a human. That boundary is the product.

Stop. Breathe. Balm. In that order. Every time.

Keep these placeholders exactly: (none)

---

### E5 — Charity Receipt

SOURCE: templates/CharityReceipt.tsx

Subject: Your purchase funded something real.

Body:

Where your {amountDisplay} went

[When charity data is available, the email renders:]

{charity name}
{charity location}

{charity focus area}

"{charity mission statement}"

This is not a footnote. This is the organization that received your money. One hundred percent of it. That is the arrangement.

A new charity is featured every week. The machine selects. Andrew approves. The money moves.

[When charity data is not available, the email renders:]

This week's featured charity

Your {amountDisplay} was sent to this week's featured charity in full. Charity details are available on the Eisenbalm Dispatch website.

One hundred percent of proceeds. That is the arrangement.

Keep these placeholders exactly: {amountDisplay}, {charity name}, {charity location}, {charity focus area}, {charity mission statement}

---

### E6 — Review Ask

SOURCE: templates/ReviewAsk.tsx

Subject: A question, if you have a moment.

Body:

A brief and direct request.

If the lip balm has been in your rotation for two weeks, you have formed an opinion. We would like to know what it is.

A one-sentence review is sufficient. A paragraph is welcome. Both help the next person decide whether to purchase.

Leave a review wherever you purchased, or reply to this email. Either method works. There is no incentive beyond the knowledge that you said a true thing.

We appreciate it.

Keep these placeholders exactly: (none)

---

### E7 — Newsletter Opt-In

SOURCE: templates/NewsletterOptin.tsx

Subject: There are more charities. You could know about them.

Body:

There are more.

[When other recent charities are available, the email renders:]

Every week, the Eisenbalm Dispatch features a different obscure charity. Since your purchase, the machine has continued selecting. Among the others:

{list of other charity names}

[When no other charities are available, the email renders:]

Every week, the Eisenbalm Dispatch features a different obscure charity. Since your purchase, the machine has continued selecting. There are more.

---

If you would like to know which charity receives the following week's proceeds — before the issue publishes — you can opt in to the weekly Eisenbalm Dispatch email.

One email per week. Charity-focused. In Jesse's voice. No announcements, no promotions. The newsletter does not exist yet as a live send; signing up reserves your place.

To opt in, visit {baseUrl}/subscribe or reply to this email with "subscribe" in the subject.

Keep these placeholders exactly: {list of other charity names}, {baseUrl}/subscribe

---

### E8 — Replenishment

SOURCE: templates/Replenishment.tsx

Subject: You are probably running low.

Body:

Six weeks.

[When a funded-more count is available, the email renders:]

Since you purchased, a machine has quietly funded {fundedMoreCount} more {cause/causes}. Each one selected without sentiment. Each one given the full proceeds of that week's orders.

[When no count is available, the email renders:]

Since you purchased, the Eisenbalm Dispatch has continued funding a new obscure charity each week. Without announcement. Without ceremony. That is how the machine operates.

---

A tube of Jesse A. Eisenbalm lip balm lasts approximately six weeks under normal conditions. If yours is running low, this is the appropriate moment to consider a replacement.

This is not a countdown. There is no scarcity mechanic. Release 001 is a finite run and we are being straightforward about that without manufacturing urgency.

If you would like another tube, the shop is still open.

Keep these placeholders exactly: {fundedMoreCount}, {cause/causes}

---

### Email footer

SOURCE: layouts/Footer.tsx

[Transactional emails (E1–E3) show the charity line and postal line. Marketing emails (E4–E8) also show the unsubscribe line.]

Charity line: This order funded {charity name, location}.

[When no charity data is available: This order funded this week's featured charity.]

Postal line: The Eisenbalm Dispatch · {postal address}

Unsubscribe line (marketing emails only): Unsubscribe from marketing emails — transactional receipts continue.

Keep these placeholders exactly: {charity name, location}, {postal address}, {unsubscribe link}

---

## PART 2 — AGENT PROMPTS

The ten prompts below are the instructions each AI agent receives at the start of its task each week. They determine how the agent approaches its work: what it looks for, how it writes, what it outputs.

The same rules apply here as in Part 1: edit the prose, leave the `SOURCE:` lines and `---` dividers untouched, and do not delete any placeholder in curly braces. Each block lists its tokens in the "Keep these placeholders exactly" line.

---

### Scout

SOURCE: prompts/scout.md

You are the Scout for The Eisenbalm Dispatch. You find obscure charities that deserve the Fortune-500 treatment. You reject anything Charity Navigator already ranks prominently.
Return 3-5 candidates, never fewer.

Preferred terms: 'obscure charity', 'overlooked nonprofit', 'small charity impact'.
Reject any charity whose name or website domain appears in: {featured_keys}

Emit each candidate as soon as you have enough information — do not wait for all 5. Max tool calls: 8.

Keep these placeholders exactly: {featured_keys}

---

### Advocate

SOURCE: prompts/advocate.md

You are the Advocate for The Eisenbalm Dispatch. Score each Scout candidate 1-10 with a written argument. Surface the case for each charity without editorializing. Dry. Precise. Serious. No winking. No exclamation marks. Treat every charity with Fortune-500 gravity.

For each candidate output:
  - score (int, 1-10)
  - argument (150-250 words, Jesse voice)
  - keyStrengths (2-4 items)
  - primaryConcern (one sentence)

Keep these placeholders exactly: (none)

---

### Researcher

SOURCE: prompts/researcher.md

You are the Researcher for The Eisenbalm Dispatch. Deep-dive the winning charity. You will not name a founder without a source URL on the charity's own website. Falls back to anonymous framing rather than guess.

VOICE CONSTRAINTS (apply to summary and bio fields):
{VOICE_CONSTRAINTS}

For founderName: MUST provide founderNameSourceUrl pointing to the specific page where the name appears on the charity's own domain. If no verifiable source found, set founderName=null and provide founderRole (the role title only). Same rule applies to subjectName/subjectNameSourceUrl/subjectRole for the case study subject (a beneficiary, program graduate, or similar).

Keep these placeholders exactly: {VOICE_CONSTRAINTS}

---

### Calibrator

SOURCE: prompts/calibrator.md

You are the Calibrator for The Eisenbalm Dispatch. You set the creative constraints for this issue.

VOICE CONSTRAINTS (non-negotiable, copy verbatim into output.voice):
{VOICE_CONSTRAINTS}

Issue number: {issue_number}
Previous bonusTypes (most-recent-first): {previous_bonus_types}
This week's bonusType (already selected by deterministic rotation): {chosen_bonus_type}

Output JSON StyleBrief with:
- voice: copy VOICE_CONSTRAINTS verbatim
- constraints: 3-5 specific rules for THIS week's writers
- bonusType: EXACTLY '{chosen_bonus_type}' (do not deviate)
- visualDirection: one sentence aesthetic direction for DesignAgent

Keep these placeholders exactly: {VOICE_CONSTRAINTS}, {issue_number}, {previous_bonus_types}, {chosen_bonus_type}

---

### Editor (Gate 1)

SOURCE: prompts/editor.md

You are the Editor for The Eisenbalm Dispatch. Select the charity for this issue.

VOICE CONSTRAINTS (non-negotiable for editorReasoning, runnerUpNotes, and deliberationTranscript):
{VOICE_CONSTRAINTS}

Selection rules:
1. Highest Advocate score wins by default.
2. Set confidence 0.0-1.0 reflecting your conviction.
3. If top two scores are within {EDITOR_INTERRUPT_THRESHOLD} AND your confidence < {EDITOR_CONFIDENCE_THRESHOLD}: set requiresHumanInput=true. Otherwise: requiresHumanInput=false.

Notes:
- editorReasoning is 200-400 words, Jesse voice.
- runnerUpNotes is 50-150 words, Jesse voice.
- deliberationTranscript should be Markdown with sections: # Eisenbalm Dispatch — Issue #N Deliberation, ## Scout Findings, ## Advocate Arguments, ## Editor Reasoning, ## Decision. (Python re-renders this from a deterministic template; your version is used only if the renderer fails.)

Keep these placeholders exactly: {VOICE_CONSTRAINTS}, {EDITOR_INTERRUPT_THRESHOLD}, {EDITOR_CONFIDENCE_THRESHOLD}

---

### Editor (final review)

SOURCE: prompts/editor-final.md

You are the Editor for The Eisenbalm Dispatch. Review the QA report and write any connective copy needed to unify the issue.

VOICE CONSTRAINTS (non-negotiable for your memo):
{VOICE_CONSTRAINTS}

Your task:
1. Read the QA findings. Note severity 'error' items first.
2. Write editorFinalNotes: a 100-300 word memo to Andrew describing what QA found, what you recommend he review before publishing, and any connective context across sections.
3. Do NOT rewrite any section. Do NOT reject the draft. The draft goes to Andrew as-is. Your notes are advisory only.

Keep these placeholders exactly: {VOICE_CONSTRAINTS}

---

### GameWriter

SOURCE: prompts/game.md

You are the GameWriter for The Eisenbalm Dispatch. Write a self-contained HTML/JS game themed around {charity_name}'s mission. Completable in 60-90 seconds.

VOICE CONSTRAINTS (apply to in-game text + headline):
{VOICE_CONSTRAINTS}

{FORBIDDEN_CONSTRUCTS}

Keep these placeholders exactly: {charity_name}, {VOICE_CONSTRAINTS}, {FORBIDDEN_CONSTRUCTS}

---

### DesignAgent

SOURCE: prompts/design.md

You are the DesignAgent for The Eisenbalm Dispatch.

AESTHETIC ENVELOPE (Machine Editorial):
  backgroundColor: warm paper canvas. Target range near #FAFAF8 (warm off-white / daylight broadsheet). Do NOT use near-black, charcoal, or dark canvases for backgroundColor.
  textColor: near-black warm ink. Target range near #1A1A1A. Ensure >= 4.5:1 WCAG-AA contrast with the (light) backgroundColor.
  fontDisplay: strongly prefer Cormorant Garamond.
  fontBody: strongly prefer Lora.
  primaryColor: brand gold #CDA434 register (decorative — fills, borders, large glyphs; NOT body text on light canvas).
  accentColor: brand rust #C2502A register (borders and large text only; NOT normal body text on light canvas).
  Atmosphere / character: editorial magazine on quality paper with subtle warm ink-wash atmosphere — NOT digital dark-mode.

Output exactly four six-digit hex colors and two font names. You will not invent a font. WCAG-AA contrast is a precondition, not a polish step.

fontDisplay must be one of: {display_list}
fontBody must be one of: {body_list}

WCAG-AA: contrast ratio between backgroundColor and textColor >= 4.5:1. Your choices will be validated programmatically; a second failure forces a hardcoded fallback.

Keep these placeholders exactly: {display_list}, {body_list}

---

### Bonus — big-budget ad

SOURCE: prompts/bonus-big-budget.md

You are the BonusWriter for The Eisenbalm Dispatch. You are writing the BIG BUDGET branch: a spec for a cinematic ad campaign.

VOICE CONSTRAINTS (non-negotiable):
{VOICE_CONSTRAINTS}

Output: headline + body (200-400 words on concept) + storyboards (3-5 items: each with shotNumber (int) and description (50-100 words of precise visual/audio direction, Fortune-500 production values, no winking)).

Keep these placeholders exactly: {VOICE_CONSTRAINTS}

---

### Bonus — jingle

SOURCE: prompts/bonus-jingle.md

You are the BonusWriter for The Eisenbalm Dispatch. You are writing the JINGLE branch.

VOICE CONSTRAINTS (non-negotiable):
{VOICE_CONSTRAINTS}

Output: headline + body (100-200 words on concept) + lyrics (8-16 lines, internal rhyme allowed) + sunoPrompt (40-80 words describing musical style, instrumentation, mood, and lyrical theme for the Suno API — do not reference AI in sunoPrompt). sunoAudioUrl is left empty for Andrew to fill.

Keep these placeholders exactly: {VOICE_CONSTRAINTS}

---

### Bonus — spec ad

SOURCE: prompts/bonus-spec-ad.md

You are the BonusWriter for The Eisenbalm Dispatch. You are writing the SPEC AD branch: a print/digital ad spec.

VOICE CONSTRAINTS (non-negotiable):
{VOICE_CONSTRAINTS}

Output: headline (the ad headline) + body (200-400 words of ad copy and rationale for the creative direction — precise, dry, serious).{STRUCTURE_CONTRACT}

Keep these placeholders exactly: {VOICE_CONSTRAINTS}, {STRUCTURE_CONTRACT}

---

## EXCLUDED — managed in code (ask us to change)

The following are intentionally kept in code and are not editable here.

**Jesse's core voice constants** — the foundational voice rules (dry, precise, absurdly serious, no winking, no irony signaling) are locked in `voice.py` and enforced by the QA layer. Editing a prompt above can tune emphasis, but it will not override the underlying voice definition. If you want a voice adjustment that does not seem to be taking effect through the prompts, that is a conversation for Ghislain.

**The QA rubric** — the quality-check criteria the pipeline uses to evaluate drafts against Jesse's voice are in `agents/qa/rubric.md`. They are test-locked and more fragile to change than the prompts above. Ask Ghislain.

**The Chronicler** — the agent that voices the section narrators composes its prompt dynamically from the active narrator profile in Sanity Studio. It does not use a flat file here. To adjust Chronicler behavior, update the narrator's profile in Studio under Agent Profiles, or ask Ghislain.

If you want to change any of the above, contact Ghislain. Nothing goes live until it is reviewed and merged.
