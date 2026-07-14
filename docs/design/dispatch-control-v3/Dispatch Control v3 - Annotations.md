# Dispatch Control v3 — Screen Annotations & State Sheet

Companion to `Dispatch Control v3.dc.html`. This round covers the **Editorial Workspace** (Issues, My Tasks, five-stage Issue Workspace) plus the universal **Inspect how this was made** panel. Workbench screens (Run Details, Agent Instructions, Quality Tests, Editorial Memory) are specified at the bottom for phase 2.

**Live demo path baked into the prototype (Flow D + publish):**
My Tasks → "Resolve an unsupported statistic" → Fact Check claim detail → *Ask agent for better evidence* → *Confirm replacement* → Draft/Voice: select the founder phrase → *Ask agent to revise* → apply "a former county clerk" → Voice Pass → *Approve the Voice Pass* → Approval → *Publish issue* (exact preview → confirm). The header status, task counts, stage tabs, and publish lock all update live.

Use the Tweaks panel to switch **role** to *Collaborator* and see permission differences (publish, voice approval, apply-revision all lock with an explanation).

---

## Global header
- **User's question:** where does this issue stand, and does anything need me?
- Separates four state systems, never blended: Issue status (Draft / Needs review / Ready to publish / Published / Held), System activity (Idle / Running / Paused for you / Failed / Complete), My Tasks count, cost vs budget.
- "Human approval required" replaces "Auto-publish OFF" — a reassurance, not a switch. The automation setting itself lives in Administration behind typed confirmation (not in this prototype).
- All states carry label + icon, never color alone.

## Nav
Two visibly distinct groups: **Editorial** (Issues, My Tasks, Issue Workspace) and **System Workbench** (Run Details, Agent Instructions, Quality Tests, Editorial Memory). Role indicator bottom-left.

---

## Screen: Issues (home)
- **User's question:** start, resume, or unblock — what's the state of the operation?
- **Primary action:** Create issue → two equal paths ("Find a story with agents" / "Start from my brief"), both landing in the same Issue Workspace at Story & Brief. The editor never "triggers a pipeline."
- **Secondary:** open current issue, reopen held, start #08 early.
- **Required data:** current issue card (stage strip, status, open tasks, claim coverage, voice state, est. work, run cost), scheduled slot with Calibrator note, held issues **with reason + who + when**, recent published with verification record.
- **Empty state:** no in-progress issue → the Create panel is open by default and the current-issue card is replaced by "No issue in progress — discovery scheduled Monday 6:00."
- **Loading:** card skeletons keep the stage strip geometry.
- **Error:** if status can't load, the card shows "State unknown — refresh" (never a silently stale "ready").
- **Permissions:** Collaborator sees everything; Create/Reopen are hidden.
- **After action:** Create → Story & Brief; card click → workspace at last-visited stage.

## Screen: My Tasks
- **User's question:** what needs me right now, regardless of where it came from?
- Every task: plain-language title · issue/system affected · why human judgment is required · severity (Must fix / Review recommended / Information) · stage or Workbench area · age/urgency · agent recommendation when one exists · primary action · "Inspect context" (opens the inspector).
- **Primary action:** the task's own verb ("Review claim", "Open passage", "Open Voice Pass") — deep-links to the exact claim/passage/decision.
- **Empty state:** explicit "Nothing needs you" with a pointer to Approval — silence is a designed state.
- **Error:** a task that can no longer resolve (e.g. its run step was restarted) shows "superseded" with a link to the new step, never disappears silently.
- **Permissions:** Collaborator sees tasks read-only + can comment; primary actions disabled with explanation.
- **After action:** resolved tasks stay visible (struck through, "resolved just now") for the session, then archive to the decision log.

---

## Issue Workspace (shared frame)
Three-part layout: stage tabs + issue outline (persistent, compact) · editorial canvas · context panel (collapsible via "Hide panel"). Persistent controls: save state, Ask an agent, Decision log, Hold issue. Stage tabs carry live status marks (✓ / count / ⚠). Outline legend: ✓ clean · ⚠ review · ✕ must fix · ⟳ changed since review · — not generated.

### Stage 1 — Story & Brief
- **User's question:** what story, why now, which organization?
- Leads: premise, dated peg + source, reader energy, angle, category, brand-risk warning, confidence, **Require this lead** / **Remove — add reason** (reason mandatory, logged).
- Organization options grouped under the chosen lead: mechanism, fit, verification summary with dates, evidence links, agent case, **main concern always visible** (never truncated/tooltip-hidden), confidence, prior-coverage warning.
- **Paused-for-you state:** demo toggle top-right. Two options side by side — what each makes possible, evidence quality, risk, burden, **Choose this story + required rationale**. Header Activity flips to "⏸ Paused for you". Label is "Needs your decision", never `requiresHumanInput`.
- Brief: editable field table (premise, peg, central claim, reader effect, risks, voice intention) + "Ask an agent to strengthen a field".
- **Empty state:** before discovery — the two Create paths inline. **Loading:** lead cards stream in with "finding leads… (~40s)". **Error:** discovery failure surfaces plain-language problem + "Restart discovery" + link into Run Details.
- **After choose:** brief is generated, decision + rationale logged, Draft unlocks.

### Stage 2 — Draft
- **User's question:** structurally sound, useful, distinctive, ready for detailed checking?
- Reading surface uses the publication's typography. Checked claims = marigold underlines with source-on-hover **and** focusable; unchecked = rust tint, click → Fact Check. QA annotations do **not** flood the canvas — the context panel lists open items; findings appear on selection.
- Select a passage → toolbar: Edit text · Ask agent to revise · Compare with previous · Restore previous · Related facts & sources · Inspect how this was made.
- **Ask agent** never offers bare "Regenerate": direction chips (Make clearer / more specific / Tighten / Match brief / Reduce repetition / Try another / Custom). Comparison card before apply: original, proposed, what changed, **claims added/removed/altered**, then Apply / Edit before applying / Try another / Discard.
- Rule (wired live): a revision touching a factual claim returns that claim to unchecked; the fact-check "changed since check" counter increments.
- **Not generated** is a first-class visible state (Editor's note).
- **Error state:** a section that failed to draft shows the failure inline with "Redraft section" + Inspect.
- **Permissions:** Collaborator can select and comment; Apply revision is locked with a label.

### Stage 3 — Fact Check
- **User's question:** can every load-bearing claim be trusted and traced?
- Affirmative summary — claims checked X of Y, must fix, conflicts, checks not run, changed since check, last-verified timestamp. **Blank never means verified.**
- Filters: must fix, unchecked, changed, numbers & dates, people & titles, org claims, weak source.
- Claim detail (context panel — the same provenance component reused in Draft, Approval, inspector): exact claim, importance (Load-bearing / Supporting / Incidental), status, source + publisher, supporting passage, URL, retrieval date, agent, confidence.
- Actions: Confirm · Edit claim · Replace source · Ask agent for better evidence · Remove claim · Keep as written — add reason · Open source · Inspect.
- Severity tiers by editorial risk: unsupported central statistic = Must fix; unsourced atmospheric detail = Review recommended / Information.
- **After confirm:** counter, task list, Approval readiness, and header status all update (wired live).

### Stage 4 — Voice Pass
- **User's question:** does it sound deliberate, specific, human, ours?
- Default is a clean reading view; overlays are opt-in chips (generic AI phrasing, clichés, inflated characterization, repetitive syntax, machine-tells, house-voice violations, tone shift…).
- Finding actions: Apply suggestion · Edit text · Ask agent for alternatives · Keep as written — add reason · Add to voice guidance · Inspect the instruction that produced this.
- **Voice approved** is a human sign-off recording who + when — never inferred from warning counts. Factual clearance and voice approval are separate, both shown side by side. Any later material prose change returns it to Review needed (stated on the control).
- **Permissions:** approval is Editor-in-chief only; locked state explains itself.

### Stage 5 — Approval
- **User's question:** ready to represent the publication?
- Blockers-first: Must fix / Review recommended / est. review time up top with jump links; then the readiness board (fact check, voice, hook + peg, organization verification, open decisions); then **Agent editor's recommendation** — labeled as agent judgment, "editor" unqualified is reserved for the human.
- **Publish issue** disabled until Must fix = 0 ∧ Fact Check complete ∧ Voice approved current, with the unlock condition written next to it.
- Publish = exact preview (destination, title, time, consequences) + one concise confirmation. Routine weekly approval is deliberately not scary; typed confirmation is reserved for Do-not-use marking, enabling automation, destructive deletion.
- **After publish:** status → Published, activity → Complete, issue locks, corrections flow via Editorial Memory.

---

## Inspect how this was made (universal)
Reachable from: brief org card, draft passage toolbar, fact-check claim detail, voice finding, approval recommendation, My Tasks "Inspect context". Side panel, seven tabs:
1. **Summary** — what was asked, human-readable result, confidence, warnings, upstream/downstream.
2. **Inputs** — actual values supplied; **missing expected inputs called out** (see founder writer: `characterization_examples` missing → likely cause of the inflated phrase — this is the Flow C bridge).
3. **Instructions** — agent + editorial job, exact active version, shared rules, section guidance, **Improve this agent →** (deep-links Agent Instructions).
4. **Output** — full human-readable output + note when the issue text has since diverged.
5. **Sources** — retrieved sources, passages, dates, verification marks.
6. **Diagnostics** — model, timing, cost, tokens, latency, retries, validation.
7. **Technical** — raw JSON, copy/download. Never the default anywhere.
Footer actions: Ask agent to revise · Restart from this step · Improve this agent · Compare instruction versions · Related quality tests · Prior & downstream steps.

---

## State model (as implemented)
- **Issue status:** Draft · Needs review · Ready to publish · Published · Held — header + issue card.
- **System activity:** Idle · Running · Paused for you · Failed · Complete — header, separate chip.
- **Verification:** Checked · Partly checked · Check not run · Failed check · Changed since checking — fact summary + per claim.
- **Attention:** Must fix · Review recommended · Information — tasks, findings, filters.
All four use label + icon + color, never color alone.

## Decision & audit
Short reason required for: removing a lead, overriding an agent recommendation, keep-as-written, activating with regression, holding an issue, Do not use. Log records actor (human or named agent), action, time, reason, before/after, instruction version, issue + run. One **Decision log** component everywhere (Approval context panel shows it).

## System Workbench (built)

### Run Details
- **User's question:** what happened, why, and how do I recover?
- Steps are **action-named** ("Find story leads", "Verify research", "Draft sections"); the technical agent name is secondary ("— Signal Editor", "— seven writing agents"). Deterministic checks get the diamond marker + italic treatment and are called "deterministic check" in copy — never "gate."
- Header states plainly whether this is a **historical record** or a live run; "Monitor" is never used when nothing runs. Step states: Waiting · Running · Complete · Paused — done · Failed · Skipped.
- Selecting any step opens the **same inspector** used everywhere else.
- **Failed-run recovery** (demo toggle top-right): plain-language "what happened / completed successfully / what did not happen / recommended recovery," with **Restart from this step** (completed steps reused, not re-paid) and **Improve this agent**. Downstream skipped steps dim.
- Cost/duration vs recent runs is present but secondary to editorial impact.

### Agent Instructions
- **User's question:** the output was weak — how do I make the agent better, safely?
- Library grouped by human purpose: Agent instructions · Section guidance · Shared editorial rules; technical asset keys shown as secondary metadata. States: active version, draft, tested/not-yet-tested, "no starting version" warning.
- Editor shows: **why this draft exists** (linked to the Issue 07 founder output that motivated it — the Flow C bridge), variable pills with example values, live validation (**"This value is not available to the agent"** on `{peg_date}`), and a duplication warning when a shared rule is restated.
- Workflow labels: **Edit instructions → Test changes → Compare results → Make active → Restore version.** Never "commit"/"rollback."
- Test comparison auto-selects affected cases; shows target improvement plus **one minor regression (cost +12%)**. Make active stays locked until the regression is reviewed and a reason is typed — no inflexible "no regressions" deadlock, no silent override. Activation records author, time, reason, results; restoring never deletes history. (Wired live; Collaborator sees it locked.)

### Quality Tests
- **User's question:** will this change help, and is quality drifting?
- 8 **standard test cases**, each with situation, expected behavior, what it catches, last result + versions tested, Run test.
- **Preview next run** (renamed from "shadow run") explained in plain terms: current news + draft instructions, before the paid run. Scheduling is secondary and off by default, behind explicit confirmation.
- Append-only test history: selection integrity, traceability, voice violations, machine-tells, review time, cost.

### Editorial Memory
- **User's question:** what do we already know, and what must never happen again?
- Recent coverage (last 8, including the held slot) with the #8 repetition warning ("avoid US-SE · avoid weather").
- Organization history: **In progress / Published / Considered / Do not use** (never "blocklisted"), verification record with dates, corrections count, known risks.
- **Mark Do not use** = typed confirmation (org name) + required reason, Editor-in-chief only — wired live on The Creative Center. Guinea Pig Bridge shows a completed exclusion with its logged reason.
- Corrections history: append-only record with original claim, correction, source, issue affected, date + editor, and the "agents must apply in future mentions" flag.

### Workbench nomenclature (added this round)
| Old / technical | In the product |
|---|---|
| Gate / code gate | deterministic check |
| Node, re-run from node | step, Restart from this step |
| Monitor (idle) | Run Details — historical record |
| Prompt / asset | Instructions (asset key secondary) |
| Seeded / never seeded | has a starting version / no starting version |
| Commit / rollback | Make active / Restore version |
| Eval, run evals | Quality test, Test changes |
| Golden scenario | Standard test case |
| Shadow run | Preview next run |
| Blocklisted | Do not use |
| Coverage memory / registry record | Recent coverage / Organization history |

## Nomenclature (applied throughout)
Must fix (not "blocking") · Agent editor's recommendation · Organization options · Require this lead · Remove from consideration — add reason · Needs your decision / Paused for you · Apply suggestion · Edit text · Keep as written — add reason · Redraft section · Decision log · Step details / Inspect how this was made · Technical data · Restart from this step · Make active / Restore version · Standard test cases · Preview next run · Recent coverage · Organization history · Corrections history · Do not use · Human approval required · My Tasks.
