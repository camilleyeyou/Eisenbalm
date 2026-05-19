---
phase: 07-game-rendering
plan: 03
type: execute
wave: 1
depends_on:
  - "07-01"
  - "07-02"
files_modified:
  - apps/web/components/issue/GameSlot.tsx
  - apps/web/components/issue/GameFallback.tsx
  - apps/web/app/issue/[slug]/page.tsx
autonomous: true
requirements:
  - GAM-01
  - GAM-05
  - GAM-06
must_haves:
  truths:
    - "When game.embedCode passes validation, GameSlot renders an <iframe sandbox=\"allow-scripts\" srcDoc={injectGameHead(game.embedCode)}> (no allow-same-origin anywhere)"
    - "When game.embedCode fails validation, GameSlot renders <GameFallback /> showing the literal copy 'Game unavailable.' instead of the iframe"
    - "When game is null, GameSlot renders the 'Game coming soon.' placeholder (no iframe)"
    - "On validation failure with runId !== null, GameSlot calls useMutation(api.qaCorrections.insert) exactly once per mount with {runId, sectionName:'game', severity:'error', accepted:false, agentId:'game-validator', axis:'hard-rule', reason} matching the validator output"
    - "On validation failure with runId === null, GameSlot still renders <GameFallback /> but skips the Convex write (no ConvexError)"
    - "apps/web/app/issue/[slug]/page.tsx passes issue.runId to <GameSlot ... runId={issue.runId ?? null} />"
  artifacts:
    - path: "apps/web/components/issue/GameSlot.tsx"
      provides: "Client Component that conditionally renders iframe / fallback / coming-soon based on validateEmbedCode result"
      contains: "'use client'"
      min_lines: 80
    - path: "apps/web/components/issue/GameFallback.tsx"
      provides: "Pure display component with the 'Game unavailable.' copy"
      exports: ["GameFallback"]
    - path: "apps/web/app/issue/[slug]/page.tsx"
      provides: "RSC that threads issue.runId into GameSlot's new runId prop"
      contains: "runId={issue.runId"
  key_links:
    - from: "apps/web/components/issue/GameSlot.tsx"
      to: "apps/web/lib/game-validator.ts"
      via: "Import { validateEmbedCode, injectGameHead } from '@/lib/game-validator'"
      pattern: "from '@/lib/game-validator'"
    - from: "apps/web/components/issue/GameSlot.tsx"
      to: "convex/qaCorrections.ts (insert mutation)"
      via: "useMutation(api.qaCorrections.insert) from convex/react with @convex/_generated/api alias"
      pattern: "api\\.qaCorrections\\.insert"
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "apps/web/components/issue/GameSlot.tsx"
      via: "Props: game={issue.game} runId={issue.runId ?? null}"
      pattern: "<GameSlot game=\\{issue\\.game\\} runId="
---

<objective>
Replace the Phase 2 hidden-iframe placeholder in `apps/web/components/issue/GameSlot.tsx` with the Phase 7 production render logic: (1) convert the component to a Client Component, (2) call `validateEmbedCode` on `game.embedCode`, (3) render the iframe with `injectGameHead`-wrapped srcdoc when validation passes, (4) render `<GameFallback />` ("Game unavailable.") when validation fails, (5) fire a one-shot `qaCorrections.insert` Convex mutation on failure (guarded by useRef + runId null check), and (6) wire `issue.runId` from `apps/web/app/issue/[slug]/page.tsx` through the new `runId` prop.

Purpose: Surface the iframe that was scaffolded but hidden in Phase 2. Plug in the validator (Plan 07-02) so unsafe LLM output never reaches the iframe. Notify Andrew via Convex `qaCorrections` whenever the validator catches a bad game so Phase 9's deliberation layer can surface `agentId='game-validator'` rows distinctively. The `Issue` type already includes `runId: string | null` (apps/web/lib/sanity/types.ts line 118) — no type change needed.

Output: `GameSlot.tsx` rewritten as a Client Component; new `GameFallback.tsx`; one-line prop addition in `page.tsx`. No changes to `Issue` type, GROQ projection, Convex schema, or Convex mutation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/07-game-rendering/07-RESEARCH.md
@.planning/phases/07-game-rendering/07-VALIDATION.md

@apps/web/components/issue/GameSlot.tsx
@apps/web/app/issue/[slug]/page.tsx
@apps/web/lib/sanity/types.ts
@apps/web/lib/game-validator.ts
@convex/qaCorrections.ts
@convex/schema.ts

<interfaces>
<!-- Inputs the executor needs (extracted, not paraphrased): -->

<!-- 1) IssueGame type (apps/web/lib/sanity/types.ts line 79-83) -->
export type IssueGame = {
  headline: string
  description: string | null
  embedCode: string
} | null

<!-- 2) Issue.runId (apps/web/lib/sanity/types.ts line 118) -->
runId: string | null  // already present on the Issue type — no schema/types change needed

<!-- 3) Validator API (apps/web/lib/game-validator.ts, after Plan 07-02 ships) -->
export type ValidationResult = { valid: true } | { valid: false; reason: string }
export function validateEmbedCode(embedCode: string): ValidationResult
export function injectGameHead(embedCode: string): string

<!-- 4) Convex mutation shape (convex/qaCorrections.ts insert) -->
api.qaCorrections.insert({
  runId: string,                            // REQUIRED — v.string() throws if undefined
  agentId?: string,                         // 'game-validator'
  sectionName: string,                      // 'game'
  reason: string,                           // validator's reason
  severity: 'info' | 'warning' | 'error',  // 'error'
  accepted: boolean,                        // false
  axis?: 'gravity'|'sentiment'|'irony-signaling'|'precision'|'cross-section-consistency'|'hard-rule',  // 'hard-rule'
  quotedSpan?: string,                      // omit — pattern match doesn't preserve position
  suggestedFix?: string,                    // omit — not applicable
  // legacy optional: fieldName, original, corrected — DO NOT PASS
})

<!-- 5) Convex provider mounted at root (apps/web/components/providers/ConvexClientProvider.tsx)
        wraps the app — any 'use client' descendant can call useMutation. -->

<!-- 6) Existing Phase 2 GameSlot section structure (LOCKED — do not change):
        - <section id="game" className="mx-auto w-full max-w-[860px] px-4 sm:px-6 lg:px-8 print:hidden">
        - top divider + "THE GAME" label row + AnchorCopyButton
        - h2 headline, p description
        - container: <div className="relative h-[280px] w-full overflow-hidden rounded border ... sm:h-[360px]">
        - mt-8 spacer at bottom
        Phase 7 reuses the existing wrapper; only the inner placeholder div + hidden iframe are replaced. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create GameFallback.tsx (validation-failed display component)</name>
  <read_first>
    - apps/web/components/issue/GameSlot.tsx (lines 67-92 — Phase 2 inner container styles, so the fallback uses identical typography classes for visual coherence)
    - .planning/phases/07-game-rendering/07-RESEARCH.md (Pattern 4 GameFallback Component — voice note: "Game unavailable." is the locked copy)
  </read_first>
  <files>apps/web/components/issue/GameFallback.tsx (new)</files>
  <action>
    Create `apps/web/components/issue/GameFallback.tsx` with this exact content:

    ```tsx
    /**
     * Phase 7 fallback for when the game validator rejects embedCode.
     *
     * Copy is locked to "Game unavailable." (period, no exclamation, no
     * apology). Jesse's voice: dry, precise. See CLAUDE.md voice section.
     *
     * Pure display component — no logic, no state, no Convex calls. The
     * Convex `qaCorrections.insert` write lives in GameSlot.tsx where the
     * mutation hook can be bound to the runId prop.
     *
     * Typography mirrors the Phase 2 "Interactive version of this section
     * is loading." placeholder so the visual rhythm is unchanged.
     */
    export function GameFallback() {
      return (
        <div className="flex h-full items-center justify-center px-8">
          <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
            Game unavailable.
          </p>
        </div>
      )
    }
    ```

    The copy MUST be `Game unavailable.` exactly (period at end, no exclamation mark, no "we're sorry", no "please try again"). This is a voice contract — CLAUDE.md mandates dry, precise tone with no warmth.

    The component is NOT marked `'use client'`. It has no hooks. It can be rendered from either a Server Component or a Client Component context. GameSlot (which IS a Client Component after this plan) imports and renders it.
  </action>
  <verify>
    <automated>grep -c "Game unavailable\." apps/web/components/issue/GameFallback.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/components/issue/GameFallback.tsx` exists
    - `grep "export function GameFallback" apps/web/components/issue/GameFallback.tsx` returns exactly 1 match
    - `grep -F "Game unavailable." apps/web/components/issue/GameFallback.tsx` returns exactly 1 match
    - `grep -c "Game unavailable!" apps/web/components/issue/GameFallback.tsx` returns 0 (NO exclamation)
    - `grep -c "sorry" apps/web/components/issue/GameFallback.tsx` returns 0 (NO apology)
    - `grep -c "please try" apps/web/components/issue/GameFallback.tsx` returns 0 (NO "please try again")
    - `grep -c "'use client'" apps/web/components/issue/GameFallback.tsx` returns 0 (NOT a Client Component — pure display)
    - File uses the same Tailwind classes as the Phase 2 placeholder (`font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60`)
  </acceptance_criteria>
  <done>GameFallback exists with locked Jesse-voice copy, mirrors Phase 2 placeholder typography, no hooks, no Convex calls.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rewrite GameSlot.tsx as a Client Component with validator + Convex wiring</name>
  <read_first>
    - apps/web/components/issue/GameSlot.tsx (the CURRENT Phase 2 file — preserve section wrapper, label row, headline, description, AnchorCopyButton, top divider, and bottom spacer)
    - apps/web/lib/game-validator.ts (validateEmbedCode + injectGameHead — must exist from Plan 07-02)
    - apps/web/components/issue/GameFallback.tsx (created in Task 1)
    - convex/qaCorrections.ts (insert mutation signature — confirms required args)
    - apps/web/components/providers/ConvexClientProvider.tsx (confirms ConvexProvider is mounted at root — useMutation works in any descendant)
    - apps/web/lib/sanity/types.ts (IssueGame and Issue.runId — runId is already `string | null` on Issue, no type change)
    - apps/web/tsconfig.json (confirms `@/*` and `@convex/*` path aliases exist)
  </read_first>
  <files>apps/web/components/issue/GameSlot.tsx (rewritten)</files>
  <action>
    Overwrite `apps/web/components/issue/GameSlot.tsx` with the content below. The section wrapper, divider, label row, AnchorCopyButton, headline, description, container `<div>`, and bottom spacer ALL stay byte-identical to Phase 2 — only the inner placeholder + hidden iframe are replaced with the conditional render.

    ```tsx
    /**
     * Game slot. UI-SPEC §4.
     * Container: editorial wide (860px). Anchor ID: #game.
     *
     * Phase 7: real iframe with sandbox validator + CSP injection.
     *
     * Security contract (LOCKED — GAM-01, GAM-03):
     *   sandbox="allow-scripts"  ALWAYS
     *   sandbox MUST NEVER contain allow-same-origin (would defeat the sandbox)
     *   __tests__/game-sandbox.test.ts is the source-scan tripwire (Plan 07-04)
     *
     * Rendering decision tree:
     *   1. game === null               → "Game coming soon." placeholder (no iframe)
     *   2. game.embedCode invalid      → <GameFallback /> ("Game unavailable.")
     *                                    + one-shot Convex qaCorrections.insert write
     *   3. game.embedCode valid        → <iframe srcDoc={injectGameHead(embedCode)} ...>
     *
     * The Convex write happens in a useEffect guarded by a useRef so it fires
     * at most once per component mount even under React Strict Mode double-
     * invocation in dev. If runId is null (e.g. an issue authored manually
     * in Sanity Studio without a pipeline run), the write is skipped —
     * runId is v.string() in the schema; passing undefined throws.
     */
    'use client'

    import { useEffect, useRef } from 'react'
    import { useMutation } from 'convex/react'

    import { api } from '@convex/_generated/api'
    import type { IssueGame } from '@/lib/sanity/types'
    import { AnchorCopyButton } from '@/components/AnchorCopyButton'
    import { GameFallback } from '@/components/issue/GameFallback'
    import { injectGameHead, validateEmbedCode } from '@/lib/game-validator'

    interface GameSlotProps {
      game: IssueGame
      runId: string | null
    }

    export function GameSlot({ game, runId }: GameSlotProps) {
      const insertQaCorrection = useMutation(api.qaCorrections.insert)
      const reportedRef = useRef(false)

      // Run the validator once per render. Pure function — no I/O.
      const validation = game?.embedCode
        ? validateEmbedCode(game.embedCode)
        : null

      // Build the srcdoc only when the validator passed.
      const srcdoc = game?.embedCode && validation?.valid
        ? injectGameHead(game.embedCode)
        : null

      // Fire-and-forget Convex write on validation failure. Guarded by:
      //   - reportedRef (one shot per component mount; survives re-renders)
      //   - !runId (Issues authored manually in Sanity have no runId — skip)
      //   - validation.valid (only fire on FAILURE)
      // Andrew sees the row in the Phase 9 deliberation layer where
      // agentId='game-validator' will be color-coded by severity='error'.
      useEffect(() => {
        if (!validation || validation.valid) return
        if (reportedRef.current) return
        if (!runId) return
        reportedRef.current = true
        insertQaCorrection({
          runId,
          sectionName: 'game',
          reason: `Game validator rejected embedCode: ${validation.reason}`,
          severity: 'error',
          accepted: false,
          agentId: 'game-validator',
          axis: 'hard-rule',
        }).catch((err) => {
          // Convex write failures must not break the page render. Log to
          // browser console so Andrew can investigate; the fallback UI is
          // already on-screen regardless.
          // eslint-disable-next-line no-console
          console.error('[GameSlot] qaCorrections.insert failed', err)
        })
      }, [validation, runId, insertQaCorrection])

      return (
        <section
          id="game"
          className="mx-auto w-full max-w-[860px] px-4 sm:px-6 lg:px-8 print:hidden"
        >
          {/* Top divider */}
          <div
            className="mb-8 h-px bg-[color:var(--color-text)]"
            style={{ opacity: 0.12 }}
            aria-hidden="true"
          />

          {/* Label row */}
          <div className="mb-4 flex items-center gap-2">
            <span className="font-ui text-[14px] uppercase leading-[1.5] tracking-[0.1em] text-[color:var(--color-text)] opacity-60">
              THE GAME
            </span>
            <AnchorCopyButton sectionId="game" />
          </div>

          {/* Optional headline from Sanity */}
          {game?.headline && (
            <h2 className="mb-4 font-display text-[28px] font-semibold leading-[1.15] text-[color:var(--color-primary)] sm:text-[36px]">
              {game.headline}
            </h2>
          )}

          {/* Optional description */}
          {game?.description && (
            <p className="mb-4 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]">
              {game.description}
            </p>
          )}

          {/*
           * Game frame area.
           * Container styles MUST NOT change — Phase 2 sized this to
           * 280px mobile / 360px desktop with overflow-hidden to clip
           * any internal game content that exceeds the box. GAM-06 mobile
           * substrate is provided by injectGameHead's CSS reset.
           */}
          <div className="relative h-[280px] w-full overflow-hidden rounded border border-[color:var(--color-border,#e5e7eb)] bg-[color:var(--color-surface,var(--color-bg))] sm:h-[360px]">
            {srcdoc ? (
              // SECURITY (GAM-01, GAM-03): allow-scripts ONLY.
              // NEVER add allow-same-origin to this attribute. Doing so
              // defeats the sandbox entirely (the page could rewrite its
              // own sandbox attribute). The Vitest source-scan test in
              // __tests__/game-sandbox.test.ts fails the build if the
              // literal string "allow-same-origin" appears in this file.
              <iframe
                sandbox="allow-scripts"
                srcDoc={srcdoc}
                title={game?.headline ?? 'Game'}
                className="absolute inset-0 h-full w-full border-none"
              />
            ) : game?.embedCode ? (
              // Validator rejected embedCode — show fallback. The Convex
              // write is fired by the useEffect above (one shot per mount).
              <GameFallback />
            ) : (
              // No game on this issue — empty-state placeholder.
              <div className="flex h-full items-center justify-center px-8">
                <p className="text-center font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
                  Game coming soon.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8" aria-hidden="true" />
        </section>
      )
    }
    ```

    Critical checks while writing this file:
    1. The literal string `allow-same-origin` MUST NOT appear anywhere in this file. Plan 07-04's source-scan test fails if it does. The only sandbox attribute value is `"allow-scripts"` (no other tokens).
    2. The first line is `'use client'` (or alternative `"use client"` with double quotes is also acceptable per Next.js). The component uses `useMutation` and `useEffect` — both require Client Component context.
    3. The component imports `api` from `@convex/_generated/api` (NOT from a relative path). The `@convex/*` alias is already defined in `apps/web/tsconfig.json` (paths: `"@convex/*": ["../../convex/*"]`).
    4. The `insertQaCorrection` call passes `runId` (string), `sectionName: 'game'`, `reason` (prefixed with "Game validator rejected embedCode: "), `severity: 'error'`, `accepted: false`, `agentId: 'game-validator'`, `axis: 'hard-rule'`. Do NOT pass `fieldName`, `original`, `corrected`, `quotedSpan`, or `suggestedFix`.
    5. The useEffect guard order is: validation null/valid early-return → reportedRef.current early-return → !runId early-return → set reportedRef.current → fire mutation. This sequencing matters: the ref must be set BEFORE the await/catch so a re-render during the in-flight mutation does not double-fire.
    6. The container `<div>` keeps EXACTLY the Phase 2 classes: `relative h-[280px] w-full overflow-hidden rounded border border-[color:var(--color-border,#e5e7eb)] bg-[color:var(--color-surface,var(--color-bg))] sm:h-[360px]`.

    After writing, run `pnpm --filter apps/web typecheck` to confirm TypeScript is happy with the convex/react `useMutation` typing and the `@convex/_generated/api` import.
  </action>
  <verify>
    <automated>pnpm --filter apps/web typecheck 2>&1 | tail -10 && grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `head -1 apps/web/components/issue/GameSlot.tsx` returns a line containing `'use client'` (single or double quotes acceptable)
    - `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns 0 (CRITICAL — GAM-01/GAM-03)
    - `grep -c "allow-scripts" apps/web/components/issue/GameSlot.tsx` returns at least 1
    - `grep "from 'convex/react'" apps/web/components/issue/GameSlot.tsx` returns 1 match (or double-quote variant — either way the import is from `convex/react`)
    - `grep "from '@convex/_generated/api'" apps/web/components/issue/GameSlot.tsx` returns 1 match
    - `grep "from '@/lib/game-validator'" apps/web/components/issue/GameSlot.tsx` returns 1 match
    - `grep "GameFallback" apps/web/components/issue/GameSlot.tsx` returns at least 2 matches (import + JSX render)
    - `grep "validateEmbedCode" apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "injectGameHead" apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "api.qaCorrections.insert" apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "useRef" apps/web/components/issue/GameSlot.tsx` returns at least 1 match (idempotency guard)
    - `grep "reportedRef" apps/web/components/issue/GameSlot.tsx` returns at least 2 matches (declare + set + check)
    - `grep "'game-validator'" apps/web/components/issue/GameSlot.tsx` returns at least 1 match (agentId)
    - `grep "'hard-rule'" apps/web/components/issue/GameSlot.tsx` returns at least 1 match (axis)
    - `grep "sectionName: 'game'" apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "severity: 'error'" apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "accepted: false" apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "Game coming soon\." apps/web/components/issue/GameSlot.tsx` returns at least 1 match (no-game empty state preserved)
    - `grep "Interactive version of this section is loading\." apps/web/components/issue/GameSlot.tsx` returns 0 (Phase 2 placeholder copy is gone)
    - `grep 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx` returns at least 1 match
    - `grep "max-w-\[860px\]" apps/web/components/issue/GameSlot.tsx` returns at least 1 match (editorial-wide container preserved)
    - `grep "h-\[280px\]" apps/web/components/issue/GameSlot.tsx` returns at least 1 match (Phase 2 mobile height preserved)
    - `grep "sm:h-\[360px\]" apps/web/components/issue/GameSlot.tsx` returns at least 1 match (Phase 2 desktop height preserved)
    - `grep 'id="game"' apps/web/components/issue/GameSlot.tsx` returns at least 1 match (anchor ID preserved for AnchorCopyButton)
    - `pnpm --filter apps/web typecheck` exits with code 0
  </acceptance_criteria>
  <done>GameSlot is a Client Component that validates embedCode, renders iframe/fallback/coming-soon conditionally, and fires a one-shot guarded Convex write on failure. No allow-same-origin anywhere in the file. TypeScript clean.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Thread issue.runId from page.tsx into GameSlot via new runId prop</name>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (line 225 — current call site: `<GameSlot game={issue.game} />`)
    - apps/web/lib/sanity/types.ts (lines 114-130 — confirms Issue.runId is `string | null` already)
    - apps/web/components/issue/GameSlot.tsx (Task 2 output — confirms the new prop signature `{game, runId}`)
  </read_first>
  <files>apps/web/app/issue/[slug]/page.tsx (one-line modification)</files>
  <action>
    In `apps/web/app/issue/[slug]/page.tsx`, locate the single line:

    ```tsx
          <GameSlot game={issue.game} />
    ```

    Replace it with:

    ```tsx
          <GameSlot game={issue.game} runId={issue.runId ?? null} />
    ```

    Notes:
    - `issue.runId` is already typed as `string | null` on the `Issue` type (apps/web/lib/sanity/types.ts line 118). No type change required.
    - The `?? null` coalesce is defensive: if a GROQ projection ever returns `undefined` for a missing field, we normalize to the `string | null` contract that GameSlot's prop expects. Currently the GROQ query projects `"runId": pipelineMetadata.runId` which yields `null` (not undefined) for issues missing pipelineMetadata, but the coalesce protects against future projection changes.
    - Do NOT change any other line in page.tsx. The RSC remains an RSC; it just passes a new prop to the (now Client) GameSlot. Next.js handles the RSC→client component boundary automatically.
    - Do NOT add `runId` to the GROQ query — it's already projected (docs/API_CONTRACTS.md §1.2 line 55: `"runId": pipelineMetadata.runId`).

    After the edit, run `pnpm --filter apps/web typecheck` to confirm the new prop type-checks against GameSlot's `{game, runId}` signature.
  </action>
  <verify>
    <automated>grep "GameSlot game=\{issue\.game\} runId=" apps/web/app/issue/[slug]/page.tsx && pnpm --filter apps/web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "runId={issue.runId" apps/web/app/issue/\[slug\]/page.tsx` returns exactly 1
    - `grep -c "<GameSlot game={issue.game} />" apps/web/app/issue/\[slug\]/page.tsx` returns 0 (old single-prop form is gone)
    - `grep -c "<GameSlot " apps/web/app/issue/\[slug\]/page.tsx` returns exactly 1 (single call site)
    - `pnpm --filter apps/web typecheck` exits with code 0
    - No other line in page.tsx changed (verify with `git diff apps/web/app/issue/\[slug\]/page.tsx` — should show exactly 1 line removed and 1 line added at the GameSlot call site)
  </acceptance_criteria>
  <done>page.tsx threads `issue.runId ?? null` into GameSlot's new prop. TypeScript clean. No other page.tsx changes.</done>
</task>

</tasks>

<verification>
- `pnpm --filter apps/web typecheck` exits 0
- `pnpm --filter apps/web test:unit` exits 0 (no regression in Plan 07-02 tests — game-validator unit suite still green)
- `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns 0
- `grep -c "sandbox=\"allow-scripts\"" apps/web/components/issue/GameSlot.tsx` returns 1
- The dev server can render an issue page (manual smoke deferred to Plan 07-05) and the `/issue/[slug]` page no longer shows "Interactive version of this section is loading." — it shows the iframe (valid game) or "Game unavailable." (invalid game) or "Game coming soon." (null game).
</verification>

<success_criteria>
- GAM-01: iframe uses exactly `sandbox="allow-scripts"`; allow-same-origin appears nowhere in the file
- GAM-05: validation failure renders `<GameFallback />` AND fires a Convex `qaCorrections.insert` with the correct shape, guarded by useRef so it fires once per mount
- GAM-06 (substrate): mobile-responsive container preserved from Phase 2; the GAM-06 head-injection substrate from Plan 07-02 is applied via `injectGameHead`
- The GameSlot Client Component coexists with the RSC page.tsx — Next.js auto-handles the boundary; no other page.tsx code changes
- Issue.runId requires no type edit — already `string | null` on the Issue type from Phase 2
</success_criteria>

<output>
After completion, create `.planning/phases/07-game-rendering/07-03-gameslot-wiring-SUMMARY.md` documenting:
- Confirmation that `allow-same-origin` count in GameSlot.tsx is 0
- Confirmation that `allow-scripts` count is 1
- Convex mutation arg shape passed by GameSlot (verbatim block)
- Typecheck exit status
- Whether useRef guard was placed BEFORE or AFTER set-state (must be BEFORE await/catch to avoid Strict Mode double-fire)
- Note for Plan 07-04: the file is now in its Phase 7 final shape; the source-scan test scans this exact file
</output>
</content>
</invoke>