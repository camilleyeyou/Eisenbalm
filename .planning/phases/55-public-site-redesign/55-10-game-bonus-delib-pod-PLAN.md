---
phase: 55-public-site-redesign
plan: 10
type: execute
wave: 2
depends_on: [55-01, 55-02, 55-03]
files_modified:
  - apps/web/components/dispatch/DelibCards.tsx
  - apps/web/components/dispatch/AdSummary.tsx
  - apps/web/components/dispatch/bands.css
  - apps/web/components/issue/GameSlot.tsx
  - apps/web/components/issue/BonusSection.tsx
  - apps/web/components/issue/PodcastSlot.tsx
  - apps/web/__tests__/delib-cards.test.tsx
  - apps/web/__tests__/dispatch-bands.test.tsx
autonomous: true
requirements: [P55-SC3, P55-SC4, P55-SC1, P55-SC6, PUB-06, PUB-07]

must_haves:
  truths:
    - "Section 07 shows Picked / Runner-up / Also considered cards from Sanity data, plus an Editor's confidence meter only when a real 0-1 value exists; no transcript, chat bubbles or scoreboard"
    - "The deliberation section makes zero Convex subscriptions and names no AI model or provider"
    - "The game still renders only inside <iframe sandbox=\"allow-scripts\"> behind the click-to-load gate, with validator, injectGameHead and the qaCorrections report unchanged"
    - "Section 05 (black), 06 (red) and 08 (green) bands match the fixed colour map; the spec-ad bonus shows the authored ad summary card when present"
    - "Existing podcast and bonus image contracts (audio controls gated on audioUrl, 'Audio coming soon.', next/image with fill + sizes) still pass"
  artifacts:
    - path: "apps/web/components/dispatch/DelibCards.tsx"
      provides: "#delib summary cards + confidence meter"
      exports: ["DelibCards"]
    - path: "apps/web/components/issue/GameSlot.tsx"
      provides: "Restyled #game band, same security path"
      contains: "sandbox=\"allow-scripts\""
    - path: "apps/web/components/issue/BonusSection.tsx"
      provides: "Restyled #bonus red band + AdSummary"
    - path: "apps/web/components/issue/PodcastSlot.tsx"
      provides: "Restyled compact #pod green band"
    - path: "apps/web/components/dispatch/AdSummary.tsx"
      exports: ["AdSummary"]
  key_links:
    - from: "apps/web/components/issue/GameSlot.tsx"
      to: "apps/web/lib/game-validator.ts"
      via: "validateEmbedCode + injectGameHead (unchanged)"
      pattern: "validateEmbedCode\\(game\\.embedCode\\)"
    - from: "apps/web/components/dispatch/DelibCards.tsx"
      to: "derive.ts DelibCard[] + editorConfidence"
      via: "props from IssueLayout (Sanity-sourced)"
      pattern: "role=\"meter\""
---

<objective>
Build section 07 as summary cards (locked decision 4) and restyle sections 05 (game), 06 (bonus) and 08 (podcast) into their Dispatch colour bands while keeping their security and behaviour contracts byte-for-byte where it matters.

Purpose: SC-3 (cards from live data, transcript gone from the new tree), SC-4 (game sandbox contract unchanged), SC-1 (bands 05–08).
Output: DelibCards, AdSummary, restyled GameSlot/BonusSection/PodcastSlot (paths unchanged so existing tripwire tests keep guarding them), bands.css, 2 tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@apps/web/components/issue/GameSlot.tsx
@apps/web/components/issue/BonusSection.tsx
@apps/web/components/issue/PodcastSlot.tsx
@apps/web/components/issue/DeliberationSlot.tsx
@apps/web/__tests__/game-sandbox.test.ts
@apps/web/__tests__/podcast-slot.test.ts
@apps/web/__tests__/bonus-section-image.test.ts

<interfaces>
```typescript
// derive.ts: type DelibCard = { kind: 'picked' | 'runner-up' | 'also'; name: string; location: string | null; blurb: string | null; score: number | null }
//            type FrontPageRow = { label: string; value: string }
// copy.ts: DELIB_INTRO, DELIB_CARD_LABELS, CONFIDENCE_LABEL, sectionMeta, bonusLabel
// NumberedSection({ id, number, label, title?, compact?, children })
// Existing props (KEEP): GameSlot({ game, runId }), PodcastSlot({ podcast }), BonusSection({ bonus, bonusType }) — BonusSection gains optional adSummary
```
Created:
```typescript
export function DelibCards(p: { cards: DelibCard[]; confidence: number | null }): JSX.Element
export function AdSummary(p: { summary: { title: string | null; rows: FrontPageRow[] } }): JSX.Element
// BonusSection({ bonus, bonusType, adSummary?: { title: string | null; rows: FrontPageRow[] } | null })
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: DelibCards (summary cards + confidence meter)</name>
  <files>apps/web/components/dispatch/DelibCards.tsx, apps/web/components/dispatch/bands.css, apps/web/__tests__/delib-cards.test.tsx</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (copy its DEL-05 empty-state sentence VERBATIM for issues with no deliberation record; note the `confidence ?? 80` default that must NOT be carried over)
    - apps/web/__tests__/deliberation-no-model-names.test.ts and deliberation-subscriptions.test.ts (contracts this test now carries for the new component)
    - apps/web/lib/dispatch/derive.ts deliberationCards / editorConfidence
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Deliberation summary cards (section 07)"
  </read_first>
  <behavior>
    - With deliberationCards(fullIssue) and confidence 0.8: `section#delib.d-sec--delib`, disc '07', DELIB_INTRO text; 4 `article` cards; first has visible label 'Picked', an h3 with the charity name, class `d-delib-card--picked`; second 'Runner-up'; others 'Also considered'
    - Meter: element role="meter" with aria-valuenow="80", aria-valuemin="0", aria-valuemax="100", accessible name "Editor's confidence", visible text '80%'
    - confidence null -> no role="meter" and no "Editor's confidence" text anywhere
    - cards [] -> the DEL-05 empty-state sentence (verbatim from DeliberationSlot) and no articles
    - Source-scan (comment-stripped): no `useQuery`, no `convex/react`, no `@convex/_generated`, no `conversation`, no `DelibChat`, no `modelVersions`, no `?? 80`; lowercase code contains none of 'claude', 'gpt', 'sonnet', 'haiku', 'openrouter'; no `role="log"`
  </behavior>
  <action>
    1. DelibCards.tsx (server component; `import './bands.css'`): `const m = sectionMeta('delib')`; `<NumberedSection id="delib" number={m.number} label={m.label}><p className="d-body d-delib-intro">{DELIB_INTRO}</p>{cards.length === 0 ? <p className="d-body">{/* DEL-05 sentence copied verbatim */}</p> : <ul className="d-delib-cards">{cards.map((c, i) => <li key={`${c.kind}-${i}`}><article className={`d-delib-card d-delib-card--${c.kind}`}><p className="d-label">{DELIB_CARD_LABELS[c.kind]}</p><h3 className="d-delib-title">{c.name}</h3>{c.location && <p className="d-label d-delib-loc">{c.location}</p>}{c.blurb && <p className="d-body d-delib-blurb">{c.blurb}</p>}</article></li>)}</ul>}{confidence !== null && (() => { const pct = Math.round(confidence * 100); return (<div className="d-confidence"><p id="delib-confidence-label" className="d-label">{CONFIDENCE_LABEL}</p><div className="d-confidence-row"><div className="d-confidence-track" role="meter" aria-labelledby="delib-confidence-label" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${pct}%`}><span className="d-confidence-fill" style={{ width: `${pct}%` }} /></div><p className="d-heading d-confidence-value" aria-hidden="true">{pct}%</p></div></div>) })()}</NumberedSection>`. No 'use client', no hooks.
    2. bands.css (vars only): `.d-delib-intro{max-width:720px;margin:0 0 24px} .d-delib-cards{display:flex;flex-wrap:wrap;gap:24px;list-style:none;margin:0;padding:0} .d-delib-cards > li{flex:1 1 min(100%, 300px);display:flex} .d-delib-card{flex:1;border:2px solid var(--d-ink);border-radius:20px;padding:24px;background:var(--d-paper);color:var(--d-ink)} .d-delib-card p{margin:0} .d-delib-card--picked{background:var(--d-green)} .d-delib-card--runner-up .d-label, .d-delib-card--runner-up .d-delib-blurb, .d-delib-card--also .d-label, .d-delib-card--also .d-delib-blurb{color:var(--d-muted)} .d-delib-title{font-size:18px;font-weight:800;line-height:1.35;margin:8px 0;overflow-wrap:anywhere} .d-delib-blurb{line-height:1.45;margin-top:8px} .d-confidence{margin-top:48px} .d-confidence-row{display:flex;align-items:center;gap:24px} .d-confidence-track{flex:1 1 auto;height:24px;background:var(--d-track)} .d-confidence-fill{display:block;height:100%;background:var(--d-blue)} .d-confidence-value{margin:0;flex:0 0 auto}`.
    3. delib-cards.test.tsx (jsdom render + node-style readFileSync source-scan in the same file, using the comment-stripping `codeOnly` helper copied from deliberation-no-model-names.test.ts).
  </action>
  <verify>
    <automated>pnpm --filter web test -- delib-cards dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -c "useQuery\|convex/react" apps/web/components/dispatch/DelibCards.tsx` returns 0
    - `grep -c "?? 80" apps/web/components/dispatch/DelibCards.tsx` returns 0
    - `grep -n 'role="meter"' apps/web/components/dispatch/DelibCards.tsx` matches
    - `grep -c "<h3" apps/web/components/dispatch/DelibCards.tsx` returns 1
  </acceptance_criteria>
  <done>Summary cards + real-or-absent confidence; DEL-04 and zero-subscription contracts carried to the new component.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle GameSlot (05) and PodcastSlot (08) — behaviour and security unchanged</name>
  <files>apps/web/components/issue/GameSlot.tsx, apps/web/components/issue/PodcastSlot.tsx, apps/web/components/dispatch/bands.css, apps/web/__tests__/dispatch-bands.test.tsx</files>
  <read_first>
    - apps/web/components/issue/GameSlot.tsx (whole file — keep imports, validator, injectGameHead, useMutation(api.qaCorrections.insert) effect, `started` gate, aria-label `Play ${game.headline}` VERBATIM)
    - apps/web/__tests__/game-sandbox.test.ts, game-validator.test.ts, issue-page-dispatch.test.ts "Plan 02: GameSlot play button has aria-label containing 'Play'", issue-page-typography.test.ts "GameSlot.tsx is untouched" (all must stay green)
    - apps/web/components/issue/PodcastSlot.tsx (whole file — keep audio element, controls, audioUrl gating, play/pause logic, existing h2 text and 'Audio coming soon.' copy verbatim)
    - apps/web/__tests__/podcast-slot.test.ts
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" 05 Game and 08 Pod; colour map rows 05/08
  </read_first>
  <action>
    1. GameSlot.tsx: keep the file path, 'use client', every import, the validation/srcdoc/qaCorrections logic and the iframe element exactly (`sandbox="allow-scripts"` only; never add any other token; do not write the forbidden same-origin token even in comments). Replace ONLY the returned markup/styles: wrap in `<NumberedSection id="game" number={sectionMeta('game').number} label={sectionMeta('game').label} title={game?.headline ?? null}>`; inside `<div className="d-game-grid"><div className="d-game-copy">{game?.description && <p className="d-body d-game-desc">{game.description}</p>}{srcdoc && !started && <button type="button" className="d-pill d-game-play" aria-label={`Play ${game?.headline ?? 'the game'}`} onClick={() => setStarted(true)}>▶ Play {game?.headline}</button>}</div><div className="d-game-frame">{srcdoc ? (started ? <iframe sandbox="allow-scripts" …existing attributes… /> : <div className="d-game-idle" aria-hidden="true" />) : <GameFallback />}</div></div>`. Keep the iframe's existing title/srcDoc/other attributes. Remove the Phase 19 inline styles and the `.fw/.game` classes. Add `import './../dispatch/bands.css'` (path `@/components/dispatch/bands.css`) and `import { NumberedSection } from '@/components/dispatch/NumberedSection'`, `import { sectionMeta } from '@/lib/dispatch/copy'`. Keep a header comment stating the GAM-01/GAM-03 contract.
       If the existing aria-label string is exactly `Play ${game.headline}`, preserve that expression form so existing source-scans still match.
    2. PodcastSlot.tsx: keep logic; wrap markup in `<NumberedSection id="pod" number="08" label={sectionMeta('pod').label} title={<existing h2 text>} compact>`; add decorative `<div className="d-wave" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <span key={i} className="d-wave-bar" />)}</div>`; keep the `<audio controls>` gated on audioUrl and the existing no-audio copy verbatim. Remove `.sec-label` Phase 19 classes/inline styles. Import bands.css.
    3. Append to bands.css: `.d-game-grid{display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start} .d-game-copy{flex:1 1 min(100%, 360px);min-width:0} .d-game-desc{color:var(--d-dark-lead);margin:0 0 24px} .d-game-play{min-height:52px;background:var(--d-green);color:var(--d-ink);border-color:var(--d-green)} .d-game-play:hover{background:var(--d-paper);color:var(--d-ink)} .d-game-frame{flex:1 1 min(100%, 560px);min-height:420px;border:2px solid var(--d-green);border-radius:20px;background:var(--d-panel);overflow:hidden;display:flex;align-items:stretch;justify-content:center} .d-game-frame iframe{width:100%;min-height:420px;border:0;background:var(--d-paper)} .d-game-idle{flex:1} .d-wave{display:flex;align-items:center;gap:4px;height:48px;margin:16px 0} .d-wave-bar{width:6px;height:60%;background:var(--d-ink);border-radius:3px} .d-wave-bar:nth-child(3n){height:90%} .d-wave-bar:nth-child(4n+1){height:35%}`.
    4. dispatch-bands.test.tsx (jsdom): mock `convex/react` (`useMutation: () => vi.fn().mockResolvedValue(null)`), `@convex/_generated/api`. Assert: GameSlot with fullIssue.game renders `section#game.d-sec--game`, a button with aria-label 'Play Wheel Fix'; after click an iframe exists whose `sandbox` attribute value is exactly 'allow-scripts'; GameSlot with embedCode containing a `<script src="https://evil.example">` (validator rejects) renders GameFallback and no iframe; PodcastSlot with audioUrl null renders `section#pod` and 'Audio coming soon.'; with audioUrl renders `audio[controls]`.
  </action>
  <verify>
    <automated>pnpm --filter web test -- dispatch-bands game-sandbox game-validator podcast-slot issue-page-dispatch issue-page-typography && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -c 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx` returns 1
    - `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns 0
    - `grep -n "validateEmbedCode(game.embedCode)" apps/web/components/issue/GameSlot.tsx` and `grep -n "injectGameHead" apps/web/components/issue/GameSlot.tsx` and `grep -n "api.qaCorrections.insert" apps/web/components/issue/GameSlot.tsx` all match
    - `git diff --quiet -- apps/web/lib/game-validator.ts apps/web/lib/theme.ts` exits 0
    - `grep -n "Audio coming soon." apps/web/components/issue/PodcastSlot.tsx` matches
  </acceptance_criteria>
  <done>Game and podcast bands restyled; sandbox, validator and audio contracts provably unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Restyle BonusSection (06) + AdSummary</name>
  <files>apps/web/components/issue/BonusSection.tsx, apps/web/components/dispatch/AdSummary.tsx, apps/web/components/dispatch/bands.css, apps/web/__tests__/dispatch-bands.test.tsx</files>
  <read_first>
    - apps/web/components/issue/BonusSection.tsx (whole file: BigBudget/Jingle/SpecAd sub-renderers, next/image storyboard with fill + sizes inside a relative aspect-video wrapper, ScrollReveal usage)
    - apps/web/__tests__/bonus-section-image.test.ts (next/image import, `<Image`, `fill`, no raw img, no eslint-disable, `relative aspect-video`, `sizes` — must stay green)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" 06 Bonus and colour map row 06 (red field, ink text 4.98:1; ad summary card white with 3px ink border)
  </read_first>
  <action>
    1. AdSummary.tsx (server): `<div className="d-adsummary">{summary.title && <h3 className="d-adsummary-title">{summary.title}</h3>}{summary.rows.length > 0 && <dl className="d-adsummary-rows">{summary.rows.map((r, i) => <div key={i} className="d-adsummary-row"><dt className="d-label">{r.label}</dt><dd>{r.value}</dd></div>)}</dl>}</div>`.
    2. BonusSection.tsx: add optional prop `adSummary?: { title: string | null; rows: FrontPageRow[] } | null`. Outer markup becomes `<NumberedSection id="bonus" number="06" label={bonusLabel(bonusType)} title={bonus?.headline ?? null}>`…`</NumberedSection>`; inner sub-renderers keep their content (lyrics, Suno audio, storyboards, body via PortableTextRenderer inside `.d-prose`) and the next/image storyboard code exactly as tested (`<Image … fill sizes=…>` inside a `relative aspect-video` wrapper); remove every ScrollReveal usage (opacity-gating anti-pattern) and Phase 19 inline colour styles / `.sec-label` classes. For specAd only, render `{adSummary && <AdSummary summary={adSummary} />}` after the ad body. Keep the existing 'ADVERTISEMENT — SPEC' marker text only if it is plain text (no exclamation). Import bands.css.
    3. Append to bands.css: `.d-adsummary{margin-top:48px;background:var(--d-paper);color:var(--d-ink);border:3px solid var(--d-ink);border-radius:20px;padding:24px;max-width:720px} .d-adsummary-title{font-size:18px;font-weight:800;margin:0 0 16px} .d-adsummary-rows{display:grid;grid-template-columns:repeat(auto-fit, minmax(min(100%, 200px), 1fr));gap:16px 24px;margin:0} .d-adsummary-row dd{margin:0;font-size:18px;font-weight:800} .d-sec--bonus .d-prose{column-rule-color:var(--d-ink)}`.
    4. Extend dispatch-bands.test.tsx: BonusSection(specAd, adSummary from fullIssue.frontPage) renders `section#bonus.d-sec--bonus`, eyebrow 'The ad we made them', a `dl` with 3 rows; jingle bonusType renders eyebrow 'The jingle we made them' and no `.d-adsummary`; adSummary null -> no `.d-adsummary`. Mock next/image as in Plan 06.
  </action>
  <verify>
    <automated>pnpm --filter web test -- dispatch-bands bonus-section-image dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -c "ScrollReveal" apps/web/components/issue/BonusSection.tsx` returns 0
    - `grep -n "<NumberedSection" apps/web/components/issue/BonusSection.tsx` matches
    - `grep -n "adSummary" apps/web/components/issue/BonusSection.tsx` matches
    - `grep -cE "#[0-9a-fA-F]{6}" apps/web/components/dispatch/bands.css` returns 0
  </acceptance_criteria>
  <done>Bonus band restyled with authored ad summary; storyboard image contract green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green (old DeliberationSlot tests still pass: their target files are untouched until Plan 12)
- `pnpm --filter web typecheck` clean
- Note: GameSlot/BonusSection/PodcastSlot are still mounted by the old IssueLayout until Plan 11 swaps it; their new classes only take effect inside `.dispatch`. Execute Waves 2–3 back-to-back and do not deploy between them.
</verification>

<success_criteria>
Sections 05–08 match the colour map; deliberation is summary cards with honest confidence; game sandbox contract unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-10-SUMMARY.md`
</output>
