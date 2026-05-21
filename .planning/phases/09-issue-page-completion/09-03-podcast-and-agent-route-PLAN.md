---
phase: 09-issue-page-completion
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/web/components/issue/PodcastSlot.tsx
  - apps/web/app/agents/[agentId]/page.tsx
autonomous: true
requirements: [POD-01, POD-02, POD-03, DEL-06]
must_haves:
  truths:
    - "PodcastSlot renders a real HTML5 audio player when audioUrl is populated"
    - "PodcastSlot renders a collapsible transcript labeled 'Read full deliberation transcript' when transcript is present"
    - "PodcastSlot shows 'Audio coming soon.' (period) with no broken player element when audioUrl is empty"
    - "/agents/[agentId] resolves without 404 and renders the agentProfile displayName, role, personality (and avatar if present), never a model name"
  artifacts:
    - path: "apps/web/components/issue/PodcastSlot.tsx"
      provides: "Dark editorial podcast player + transcript + empty state"
      contains: "Audio coming soon."
    - path: "apps/web/app/agents/[agentId]/page.tsx"
      provides: "Minimal agentProfile page (DEL-06 link target)"
      contains: "QUERY_AGENT_PROFILE_BY_ID"
  key_links:
    - from: "apps/web/app/agents/[agentId]/page.tsx"
      to: "agentProfile document in Sanity"
      via: "GROQ fetch by agentId.current"
      pattern: "agentId.current == \\$agentId"
---

<objective>
Complete the podcast section (POD-01/02/03) with the dark editorial restyle while preserving its already-correct functional logic, and create the minimal `/agents/[agentId]` route so the deliberation agent-identity links (DEL-06) resolve without a 404.

These two surfaces are independent of the deliberation rewrite (Plan 09-02) and of the visual chrome (Plans 09-04/05); they own their own files and run in parallel in Wave 2.

Purpose: Readers get a working podcast player + transcript (or a clean empty state), and every agent chip in the deliberation layer links to a real, model-name-free profile page.
Output: Restyled PodcastSlot.tsx; new app/agents/[agentId]/page.tsx; podcast-slot.test.ts fully green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/09-issue-page-completion/09-UI-SPEC.md
@.planning/phases/09-issue-page-completion/09-RESEARCH.md

<interfaces>
<!-- IssuePodcast (apps/web/lib/sanity/types.ts) — already correct, do not change:
       { audioUrl: string | null, podcastDescription: string | null,
         duration: number | null, deliberationTranscript: string | null } | null -->

QUERY_AGENT_PROFILES (added by Plan 09-01 to apps/web/lib/sanity/queries.ts):
  returns AgentProfile[] = { agentId, displayName, role, personality: string|null, avatarUrl: string|null }[]

AgentProfile type (added by Plan 09-01 to apps/web/lib/sanity/types.ts).

agentProfile schema (apps/studio/schemas/agentProfile.ts): agentId is a slug (.current is the string);
  displayName + role required; personality optional text; avatar optional image.
  THE 14 agentIds: calibrator, scout, advocate, editor, researcher, origin-story, problem-statement,
  founder-bio, case-study, game, bonus, design, qa, publisher (deliberation links use these; GameSlot also
  emits a synthetic 'game-validator' qaCorrection agentId which has no agentProfile — the route must 404-gracefully).

Sanity client (server-side fetch in an RSC): import { sanityClient } from '@/lib/sanity/client'; await sanityClient.fetch(QUERY, { agentId }).
  See apps/web/app/issue/[slug]/page.tsx for the established RSC fetch + notFound() pattern.

Existing PodcastSlot.tsx ALREADY satisfies POD-01/02/03 functionally:
  - audioUrl ? <audio controls src={audioUrl}> : "Audio coming soon."
  - transcript && <details> with label "Read the deliberation transcript"
  Phase 9 changes: dark restyle + transcript label → "Read full deliberation transcript" / "Hide transcript"
  + keep "Audio coming soon." EXACTLY (period, no exclamation). Native <audio controls> stays as the
  accessible source of truth (custom chrome is optional enhancement only).

NO MODEL NAMES (DEL-04 applies to the agents route too): the agent page renders displayName/role/personality
  from agentProfile ONLY. It must NEVER render any model string. It must not fetch or display pipelineRuns.cost.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle PodcastSlot to dark editorial and finalize the transcript label</name>
  <read_first>
    - apps/web/components/issue/PodcastSlot.tsx (the file being edited — current logic is correct; restyle + label only)
    - apps/web/__tests__/podcast-slot.test.ts (the assertions to satisfy — POD-01/02/03; the restyled-label assertion was placed in a skip block by Plan 09-00)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Podcast Contract; §Copywriting Contract: "THE PODCAST", "Read full deliberation transcript"/"Hide transcript", "Audio coming soon.")
    - apps/web/app/globals.css (the new --color-* dark tokens from Plan 09-01: --color-surface, --color-card, --color-text-dim, --color-line)
  </read_first>
  <files>apps/web/components/issue/PodcastSlot.tsx</files>
  <action>
Keep the component's logic and props (`{ podcast: IssuePodcast }`) and the anchor `id="podcast"`. Apply the dark editorial restyle and update copy:

1. Container: keep 740px reading measure (`max-w-[740px]`), `print:hidden`, the top divider, and the `THE PODCAST` ui label + `<AnchorCopyButton sectionId="podcast" />` label row. Re-color surfaces/text to the new tokens (`--color-text`, `--color-text-dim`, `--color-line`, `--color-surface`). Add an `audio-player` class to the player container so the print hide-list (Plan 09-01) catches it.

2. POD-01 (audio player): keep the native `<audio controls src={audioUrl} aria-label="...">` element — it stays the accessible source of truth. You MAY wrap it in a dark `audio-player` figure with the podcastDescription rendered below; do NOT replace native controls with a fake/mock player. Give the audio a meaningful `aria-label` like `${description ?? 'Episode'} — podcast audio`.

3. POD-02 (transcript): keep the `transcript && <details>` disclosure. CHANGE the summary label from `Read the deliberation transcript` to `Read full deliberation transcript`. Add a `group-open` swap to `Hide transcript` if feasible (e.g. two spans toggled by `group-open:hidden` / `hidden group-open:inline`). The transcript body renders in body serif (`font-body`, `--color-text-dim`) with `whitespace-pre-wrap`. ≥44px touch target on the summary.

4. POD-03 (empty state): keep `Audio coming soon.` EXACTLY (period, no exclamation). When audioUrl is null, render ONLY this line — NO `<audio>` element. Description + transcript may still render if present.

Use `--color-accent` (ember) for the play affordance/border if you add custom chrome, but keep all body-size text in `--color-text` / `--color-text-dim` (ember is AA-large-only). All transitions are already neutralized by the globals.css reduced-motion guard; do not add JS animation.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Audio coming soon\." apps/web/components/issue/PodcastSlot.tsx` >= 1 and `grep -c "Audio coming soon!" apps/web/components/issue/PodcastSlot.tsx` == 0
    - `grep -c "Read full deliberation transcript" apps/web/components/issue/PodcastSlot.tsx` >= 1
    - `grep -c "<audio" apps/web/components/issue/PodcastSlot.tsx` >= 1 and source contains `controls` and `audioUrl`
    - `grep -c "deliberationTranscript\|transcript" apps/web/components/issue/PodcastSlot.tsx` >= 1 and source contains `<details`
    - `grep -c "audio-player" apps/web/components/issue/PodcastSlot.tsx` >= 1 (print hide-list hook)
    - `cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts` exits 0 (including the now-unskipped restyled-label block — see Task note)
    - `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` exits 0
  </acceptance_criteria>
  <done>PodcastSlot is dark-restyled, native audio retained, transcript label updated to "Read full deliberation transcript", empty state exact; podcast-slot.test.ts green after unskip.</done>
</task>

<task type="auto">
  <name>Task 2: Create the minimal /agents/[agentId] route and unskip the restyled-transcript-label test block</name>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (RSC pattern: `await params`, `await sanityClient.fetch`, `notFound()`, `generateMetadata`)
    - apps/web/lib/sanity/queries.ts (QUERY_AGENT_PROFILES from Plan 09-01 — model the new by-id query on it)
    - apps/web/lib/sanity/types.ts (AgentProfile type from Plan 09-01)
    - apps/studio/schemas/agentProfile.ts (fields: agentId slug, displayName, role, personality, avatar)
    - apps/web/__tests__/podcast-slot.test.ts (the `describe.skip('POD-02: restyled transcript label', ...)` block to unskip)
    - apps/web/__tests__/agents-route.test.ts (the DEL-06 route source-scan authored in Plan 09-00 — UNSKIP it here once the route exists)
    - .planning/phases/09-issue-page-completion/09-RESEARCH.md (§/agents/[agentId] route — minimal stub; DEL-06)
  </read_first>
  <files>apps/web/app/agents/[agentId]/page.tsx, apps/web/__tests__/podcast-slot.test.ts, apps/web/__tests__/agents-route.test.ts</files>
  <action>
1. Create `apps/web/app/agents/[agentId]/page.tsx` as a Server Component (RSC). Mirror the issue page's RSC fetch pattern.

Add a by-id GROQ query inline in this file (or a small const) — do NOT mutate the canonical projection field names:
```typescript
const QUERY_AGENT_PROFILE_BY_ID = groq`
  *[_type == "agentProfile" && agentId.current == $agentId][0] {
    "agentId": agentId.current,
    displayName,
    role,
    personality,
    "avatarUrl": avatar.asset->url
  }
`
```
The page:
```tsx
interface PageProps { params: Promise<{ agentId: string }> }

export default async function AgentProfilePage({ params }: PageProps) {
  const { agentId } = await params
  let profile: AgentProfile | null = null
  try {
    profile = await sanityClient.fetch<AgentProfile | null>(QUERY_AGENT_PROFILE_BY_ID, { agentId })
  } catch { /* fall through to notFound */ }
  if (!profile) notFound()
  // render displayName (h1, --color-primary), role (eyebrow / --color-text-dim),
  // personality (body prose, --color-text-dim) if present, avatar via <img> if avatarUrl,
  // and a back link to the homepage or archive.
}
```
Constraints:
- Use the AgentProfile type imported from '@/lib/sanity/types'.
- Render ONLY displayName, role, personality, avatar. NEVER render any model name, never fetch pipelineRuns/cost.
- `notFound()` on missing profile (covers the synthetic 'game-validator' agentId and any unknown id — graceful, no crash).
- Dark editorial styling using the `--color-*` tokens and the `.eyebrow` / `.prose-measure` utilities (consistent with the rest of the site). The page lives inside the root layout's single `<main id="main">` — render a `<section>` / `<article>`, NOT a second `<main>`.
- Add a minimal `generateMetadata` returning `{ title: profile.displayName }` (with a fallback title when not found). Import `groq` from `'next-sanity'`, `notFound` from `'next/navigation'`, `sanityClient` from `'@/lib/sanity/client'`.

2. In `apps/web/__tests__/podcast-slot.test.ts`, change the `describe.skip('POD-02: restyled transcript label', ...)` block to `describe(...)` so the `Read full deliberation transcript` assertion runs against the now-restyled PodcastSlot.tsx (Task 1 added that label). Do not weaken any assertion.

3. In `apps/web/__tests__/agents-route.test.ts` (authored skipped in Plan 09-00), change `describe.skip('DEL-06: /agents/[agentId] route', ...)` to `describe(...)` and remove the `// UNSKIP in Plan 09-03` marker so the route source-scan runs against the new `apps/web/app/agents/[agentId]/page.tsx`. If any assertion fails because the route's query name or `notFound(` usage differs from what the test expects, FIX the route source to match the test contract (use `QUERY_AGENT_PROFILE_BY_ID`, call `notFound()`, expose NO model strings, never read `.cost`) — do NOT weaken the test. This is the DEL-06 route-side guard (the chip-side guard lives in deliberation-agent-cards.test.ts, owned by Plan 09-02).
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts __tests__/agents-route.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/app/agents/[agentId]/page.tsx` exists
    - source contains `QUERY_AGENT_PROFILE_BY_ID` and `agentId.current == $agentId` and `notFound()`
    - source imports `AgentProfile` from `'@/lib/sanity/types'`
    - `grep -i "modelversions\|claude\|sonnet\|haiku\|openrouter\|\.cost\b" apps/web/app/agents/[agentId]/page.tsx` returns NOTHING
    - source contains NO second `<main` element (renders section/article inside the root layout's main)
    - `grep -c "describe.skip" apps/web/__tests__/podcast-slot.test.ts` == 0
    - `grep -c "describe.skip" apps/web/__tests__/agents-route.test.ts` == 0 (DEL-06 route guard unskipped)
    - `cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts __tests__/agents-route.test.ts` exits 0 (POD-* and the DEL-06 route source-scan green)
    - `cd apps/web && npm run test:unit` exits 0 (full suite)
  </acceptance_criteria>
  <done>/agents/[agentId] resolves with a model-name-free agentProfile render and 404s gracefully for unknown ids; podcast-slot.test.ts and agents-route.test.ts fully unskipped and green.</done>
</task>

</tasks>

<verification>
- PodcastSlot dark-restyled, native audio retained, transcript label updated, empty state exact.
- /agents/[agentId] renders agentProfile data, no model names, notFound() on unknown id, single-main-respecting.
- podcast-slot.test.ts and agents-route.test.ts (DEL-06 route source-scan) green; game-sandbox green; full suite green.
</verification>

<success_criteria>
- POD-01/02/03 satisfied and test-verified; DEL-06 link target exists (route resolves, no 404 for valid agentIds).
</success_criteria>

<output>
After completion, create `.planning/phases/09-issue-page-completion/09-03-SUMMARY.md`.
</output>
