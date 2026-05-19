# The Eisenbalm Dispatch — Claude Code Build Brief

## What you are building

A weekly AI-generated editorial website that spotlights an obscure charity each week, sells lip balm, and donates 100% of proceeds to the featured charity. The editorial content is produced by a nine-agent AI pipeline. A human editor (Andrew) reviews and publishes via Sanity Studio.

**The site is a destination, not a newsletter.** It should feel like a magazine that happens to sell one product.

---

## Stack (locked — do not substitute)

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), hosted on Vercel |
| CMS | Sanity v3 |
| Pipeline backend | FastAPI, hosted on Railway |
| Pipeline orchestration | LangGraph |
| AI model routing | OpenRouter |
| Pipeline database | Supabase (Python SDK) |
| Reactive frontend data | Convex |
| Commerce | Stripe (custom, no Shopify) |
| PDF generation | WeasyPrint or Playwright (generate from HTML template) |

---

## Repository structure

```
eisenbalm/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── studio/                 # Sanity Studio
├── packages/
│   ├── pipeline/               # FastAPI + LangGraph agents
│   └── shared/                 # Shared types (TypeScript)
├── convex/
│   └── schema.ts               # Convex schema (see /convex/schema.ts)
└── schemas/                    # Sanity schemas (see /schemas/)
```

---

## Sanity schema files

These files exist and are complete. Drop them in `apps/studio/schemas/`:

- `schemas/charity.ts` — The charity document type
- `schemas/weeklyIssue.ts` — The main weekly content unit
- `schemas/agentProfile.ts` — Agent character profiles for the deliberation layer
- `schemas/index.ts` — Exports all schema types

Wire them into `apps/studio/sanity.config.ts`:

```typescript
import { schemaTypes } from './schemas'

export default defineConfig({
  // ...existing config
  schema: { types: schemaTypes },
})
```

---

## Convex schema

`convex/schema.ts` is complete. Tables:

- `pipelineRuns` — one per weekly run, tracks status
- `deliberationEvents` — all agent events during a run (real-time stream)
- `agentVotes` — queryable agent votes with reasoning
- `qaCorrections` — QA corrections with severity and acceptance
- `pitchLog` — Scout's charity candidates before deliberation

---

## The nine-agent pipeline

Agents run in this exact sequence. Phase 1 is charity selection. Phase 2 is content production.

### Phase 1 — Selection (sequential)

**Agent: Calibrator**
- ID: `calibrator`
- Model: Claude (via OpenRouter)
- Input: Current date, previous issue numbers, previous bonus types
- Output: Style brief object `{ voice, constraints, bonusType, visualDirection }`
- The style brief is injected into every subsequent agent's system prompt
- Also selects `bonusType` for this week: `bigBudget | jingle | specAd` (rotating, never repeat two weeks in a row)

**Agent: Scout**
- ID: `scout`
- Model: Claude (via OpenRouter)
- Input: Calibrator style brief
- Tool use: web search (Tavily or Brave) — searches Charity Navigator, GuideStar, and general web
- Output: Array of 3–5 candidate objects `{ name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked }`
- Criteria: registered nonprofit, ~$100K–$1M assets, doing important/odd/interesting work, low visibility, not already featured
- Writes each candidate to Convex `pitchLog` table as it finds them

**Agent: Advocate**
- ID: `advocate`
- Model: Claude (via OpenRouter)
- Input: Scout's candidate array + Calibrator style brief
- Cycles through each candidate and writes an argument FOR featuring them
- Output: Same candidate array with `advocateArgument` and `advocateScore (1–10)` added to each
- Writes each argument to Convex `deliberationEvents` as `advocate-argument` events

**Editor Gate 1 — Selection**
- ID: `editor`
- Model: Claude (via OpenRouter — highest quality model, this is voice-critical)
- Input: All candidate objects with Scout summaries + Advocate arguments
- Selects ONE winning charity
- Output: `{ winnerId, winnerName, editorDecision, runnerUpNotes, deliberationTranscript }`
- `deliberationTranscript` is the full structured text of Scout findings + Advocate arguments + Editor reasoning — this becomes the NotebookLM podcast source
- Writes `editor-decision` event to Convex `deliberationEvents`
- **LangGraph pauses here** if no winner can be selected — surface to Andrew

---

### Phase 2 — Content production (parallel after gate 1)

All section agents run in parallel. All receive: winning charity data + Calibrator style brief.

**Agent: Researcher**
- ID: `researcher`
- Tool use: web search
- Deep dives the winning charity: founding story details, founder background, real outcomes and case study subjects, verifiable facts
- Output: Structured research object used by all section writers

The following writers all receive the Researcher output:

**Agent: OriginStoryWriter**
- ID: `origin-story`
- Output: `{ headline, body }` — the founding moment, weird and specific
- Jesse voice throughout

**Agent: ProblemWriter**
- ID: `problem-statement`
- Output: `{ headline, body }` — plain, precise, no sentiment
- Also outputs `pdfContent`: a structured object the PDF generator uses to build the downloadable deck

**Agent: FounderBioWriter**
- ID: `founder-bio`
- Output: `{ headline, body }` — Jesse voice, Fortune 500 treatment of the founder

**Agent: CaseStudyWriter**
- ID: `case-study`
- Output: `{ subjectName, headline, body }` — one person, one outcome

**Agent: GameWriter**
- ID: `game`
- Model: Claude (via OpenRouter)
- Output: `{ headline, description, embedCode }` — self-contained HTML/JS
- The game must work inside a sandboxed `<iframe srcdoc="...">`. No external dependencies. No CDN links.
- The game must gamify the charity's specific mission — not a generic quiz

**Agent: BonusWriter**
- ID: `bonus`
- Output varies by `bonusType` from Calibrator:
  - `bigBudget`: `{ headline, body, storyboards: [] }` — "Save the Children" ad treatment
  - `jingle`: `{ headline, body, lyrics, sunoPrompt }` — jingle with lyrics and Suno style prompt. `sunoAudioUrl` left empty for Andrew to populate manually
  - `specAd`: `{ headline, body }` — full creative brief, mood board energy

**Agent: DesignAgent**
- ID: `design`
- Output: `theme` object: `{ primaryColor, accentColor, backgroundColor, textColor, fontDisplay, fontBody, visualDirection }`
- Color values must be valid hex strings
- Font values must be valid Google Fonts names
- Visual direction is a text description for Andrew (informational only)

---

### After parallel section agents complete:

**Agent: QA**
- ID: `qa`
- Model: Claude (via OpenRouter — voice-critical)
- Reviews all section content against: Jesse's voice, factual accuracy, tonal consistency, values alignment
- Writes corrections to Convex `qaCorrections` table
- Output: Corrected full content object

**Editor Final**
- ID: `editor` (same agent profile, second invocation)
- Reviews QA output, makes final sequencing decisions, writes any connective copy needed
- Writes `editor-final` event to Convex

**→ Pipeline writes full draft to Sanity**

At this point the pipeline creates or updates:
1. A `charity` document in Sanity for the winning charity (if it doesn't exist)
2. A `weeklyIssue` document in Sanity with `status: 'draft'` and all sections populated
3. All candidate charities as `charity` documents (for the archive)

**→ Pipeline updates Convex `pipelineRuns` status to `awaiting-review`**

**→ Andrew reviews in Sanity Studio**

Andrew opens the `weeklyIssue` draft. He can edit any field. When satisfied, he changes `status` to `published` and clicks publish.

**Sanity webhook → triggers Publisher**

**Agent: Publisher**
- ID: `publisher`
- Triggered by Sanity webhook on `status === 'published'`
- Generates the Problem Statement PDF (using WeasyPrint from `pdfContent`)
- Uploads PDF back to Sanity `problemPdf` field
- Triggers Vercel deploy hook
- Updates Convex `pipelineRuns` to `complete`
- Writes `publisher-deploy` event to Convex

---

## Next.js page structure

```
/                           → Latest issue (redirect or hero)
/issue/[slug]               → Individual issue page
/archive                    → All issues, searchable by charity name / focus area
/charities                  → Charity database (all featured charities)
/charities/[slug]           → Individual charity page
/shop                       → Lip balm product page + Stripe checkout
/about                      → Jesse's about page
```

### Issue page sections (in order)

1. **Charity header** — name, location, website link, asset range, focus area
2. **Origin Story**
3. **The Problem** — with PDF download button
4. **Founder Bio**
5. **Case Study**
6. **The Game** — rendered inside `<iframe srcdoc={embedCode} sandbox="allow-scripts">`
7. **Rotating Bonus** — renders differently based on `bonusType`
8. **Deliberation layer** — agent votes, pitch log, QA corrections (from Convex, live)
9. **Podcast** — audio player + transcript (collapsible)
10. **Shop callout** — persistent, unobtrusive

### Per-issue theme switching

Each issue page injects the `theme` object as CSS variables on the `<html>` element:

```typescript
// In the issue page layout
const style = `
  --color-primary: ${issue.theme.primaryColor};
  --color-accent: ${issue.theme.accentColor};
  --color-bg: ${issue.theme.backgroundColor};
  --color-text: ${issue.theme.textColor};
  --font-display: '${issue.theme.fontDisplay}', serif;
  --font-body: '${issue.theme.fontBody}', sans-serif;
`
```

The site grid and component structure stay constant. Typography and color change per issue.

---

## Convex real-time queries (deliberation layer)

The deliberation layer is a React component that subscribes to Convex.

```typescript
// Key queries needed:
// 1. Get pitch log for an issue's runId
const pitches = useQuery(api.pitchLog.byRunId, { runId })

// 2. Get agent votes for an issue
const votes = useQuery(api.agentVotes.byRunId, { runId })

// 3. Get QA corrections for an issue
const corrections = useQuery(api.qaCorrections.byRunId, { runId })

// 4. Get full deliberation event stream
const events = useQuery(api.deliberationEvents.byRunId, { runId })
```

The `runId` is stored on the Sanity `weeklyIssue.pipelineMetadata.runId` field and fetched via the Sanity query.

---

## Ecommerce

One product: Jesse A. Eisenbalm lip balm. Stripe custom integration.

- No Shopify, no Commerce.js
- Product page lives at `/shop`
- Stripe checkout via `stripe.redirectToCheckout()` or server-side payment intent
- Order confirmation page at `/shop/thank-you`
- No popups, no urgency mechanics, no countdown timers
- A small persistent shop callout appears at the bottom of every issue page — not a banner, not a modal. One sentence and a button.

---

## PDF generation

The Problem Statement PDF is generated by the Publisher agent using WeasyPrint.

- Input: `pdfContent` object from the ProblemWriter agent
- Template: HTML file with CSS, styled to match the current issue theme
- Output: PDF uploaded to Sanity as `weeklyIssue.problemPdf`
- The PDF is a "narrative framework sales deck" — structured argument for why this charity exists and deserves attention

---

## Environment variables required

```bash
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=            # write access for pipeline

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=

# OpenRouter
OPENROUTER_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Vercel
VERCEL_DEPLOY_HOOK_URL=      # triggered by Publisher agent

# Railway (pipeline)
RAILWAY_TOKEN=

# Search (for Scout and Researcher agents)
TAVILY_API_KEY=              # or BRAVE_API_KEY
```

---

## Build sequence

Build in this order. Each step should be independently testable before moving to the next.

1. **Sanity schema + Studio** — schemas are written. Wire them in, confirm Studio renders all fields correctly. Seed one `agentProfile` document per agent.
2. **Next.js shell** — site structure, routing, reads from Sanity, theme switching works. Use mock/seeded issue data.
3. **Convex setup** — schema deployed, basic read queries written.
4. **Pipeline skeleton** — FastAPI app, LangGraph graph wired, all nine agents exist and hand off. Outputs are stubs. Andrew gate works.
5. **Agent quality** — this is the longest phase. Calibrator, Scout, and Editor are the most important to get right first.
6. **PDF generation** — WeasyPrint template, Publisher uploads to Sanity.
7. **Game rendering** — iframe sandbox, GameWriter produces valid self-contained HTML.
8. **Stripe integration** — product page, checkout, webhook handler.
9. **Deliberation layer** — Convex subscriptions, live event display.
10. **Podcast section** — audio player, transcript display.

---

## Voice and tone notes for agent prompts

Jesse's voice is **dry, precise, and absurdly serious.** No winking. No irony signaling. The joke is that everything is played completely straight.

The brand does not pivot to AI — Jesse was born AI. This is not a gimmick.

Charities are treated with the same gravity as Fortune 500 companies. Founders are treated as visionaries regardless of the obscurity of their cause. The editorial question is always: "Why do you deserve to exist?" — and the answer is always delivered without sentiment.

The deliberation layer shows the agents arguing about charities the way editorial boards argue about cover stories. The podcast is those arguments, fed to NotebookLM, turned into audio.

---

## What Andrew controls

Everything goes through Andrew's review before it publishes. Andrew can edit any field in Sanity Studio. The only thing Andrew cannot accidentally do is publish without reviewing — `status` starts at `draft` and Andrew must manually change it to `published`.

Suno (audio generation for jingles) is a manual step for Andrew until the API integration is decided. The `sunoPrompt` field gives Andrew everything he needs to run Suno manually. The `sunoAudioUrl` field is where he pastes the result.
