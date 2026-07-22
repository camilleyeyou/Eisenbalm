/**
 * How to use — full content (CHR-03, Phase 30-07).
 *
 * Verbatim copy of the weekly loop / color legend / house rules extracted
 * from docs/design/dispatch-control-v2/Dispatch Control.dc.html (`disp_howto`,
 * lines 565-618 at extraction time). Server Component — no client
 * interactivity needed for a static reference screen.
 *
 * ONLY 1c token classes are used (no literal Tailwind gray-scale/white/black).
 *
 * Quick 260721-qdx: gains a "Replay the tour" entry (`ReplayTourButton`,
 * a small client island) under the header — this page stays a Server
 * Component; only the button itself is a client child.
 *
 * Phase 50 (WBN-05, D-06): swept to the binding Workbench nomenclature table
 * — "node" -> "step", "Re-run from this node" -> "Restart from this step",
 * "run evals"/"commit" -> "test changes"/"make active", "shadow" -> "Preview
 * next run", "blocking" -> "Must fix", "blocklist"/"auto-publish" -> "Do not
 * use"/"Human approval required". The WEEKLY_LOOP `screen` labels are
 * term-swapped to the renamed Workbench screens (via WORKBENCH_NAV_LABELS)
 * and the current Issue Workspace stage names — a label swap only, NOT the
 * deeper 5-stage-architecture narrative rewrite (deferred). The
 * "three deterministic checks" legend is corrected: there are exactly TWO
 * deterministic checks (Verify organizations, Verify research); the
 * Publisher's Prepare publication step also renders as a marigold diamond
 * but is a real action, not a check.
 */
import { WORKBENCH_NAV_LABELS } from '@/lib/nomenclature'
import ReplayTourButton from '@/components/onboarding/ReplayTourButton'

const WEEKLY_LOOP = [
  {
    n: 1,
    title: 'Steer discovery',
    screen: 'Signal Desk',
    body: (
      <>
        Read the three signals, pin or kill any, and choose the recommended
        story when asked. If two candidates tie or a brand-risk shows up, the
        screen enters <b>interrupt mode</b> — pick, and your reason is logged
        to the transcript and remembered next week.
      </>
    ),
  },
  {
    n: 2,
    title: 'Watch the run',
    screen: WORKBENCH_NAV_LABELS.run_monitor,
    body: (
      <>
        Agents are <b>dots</b>; Verify organizations and Verify research are
        the two deterministic checks, marked with a{' '}
        <b className="text-[color:var(--color-marigold-text)]">◆ gold diamond</b>{' '}
        (Prepare publication also renders one, but it&apos;s an action, not a
        check). Click any step to read exactly what it handed downstream
        (human-readable first, JSON behind a toggle). Don&apos;t like a step?{' '}
        <b>Restart from this step</b> with new steering — everything after it
        re-flows.
      </>
    ),
  },
  {
    n: 3,
    title: 'Clear the facts',
    screen: 'Fact Check',
    body: (
      <>
        Read the issue as the reader will. Every error in the rail must be
        resolved — <b>Accept fix</b>, edit inline, or dismiss with a one-line
        reason.{' '}
        <b className="text-[color:var(--color-marigold-text)]">Marigold</b>{' '}
        underlines are sourced claims (hover for the source); a{' '}
        <b className="text-[color:var(--color-vermilion)]">rust</b> tint means
        unsourced. Publish stays locked until the Must fix list is empty.
      </>
    ),
  },
  {
    n: 4,
    title: 'De-slop it',
    screen: 'Voice Pass',
    body: (
      <>
        The one thing only you can do. Machine-tells are lit inline; accept a
        rewrite, write your own, or keep it. When it reads like a person
        wrote it, hit <b>Sounds human</b> — a sign-off <b>separate</b> from
        the facts. Publish needs both greens.
      </>
    ),
  },
  {
    n: 5,
    title: 'Improve the machine',
    screen: `${WORKBENCH_NAV_LABELS.prompt_lab} + ${WORKBENCH_NAV_LABELS.eval_center}`,
    body: (
      <>
        Between issues, edit an instruction, <b>test changes</b> on just the
        affected scenarios, and make it active only if the scoreboard
        improves with no regressions (or override with a logged reason).{' '}
        <b>Preview next run</b> against real news before ever paying for a
        live run.
      </>
    ),
  },
]

const COLOR_LEGEND = [
  {
    hex: '#148a52',
    token: 'var(--color-green)',
    meaning: 'Verified / cleared — a check ran and passed',
  },
  {
    hex: '#e8471d',
    token: 'var(--color-vermilion)',
    meaning: 'Error / Must fix / unsourced — needs you',
  },
  {
    hex: '#f2b01e',
    token: 'var(--color-marigold)',
    meaning: 'Warning / sourced-claim / deterministic check',
  },
  {
    hex: '#253ad4',
    token: 'var(--color-cobalt)',
    meaning: 'Interactive / links / the current selection',
  },
]

const HOUSE_RULES = [
  {
    headline: 'Silence is never "verified."',
    body: 'A check that ran says so, with a timestamp. Blank means unchecked, and unchecked is a state you can see.',
  },
  {
    headline: 'Nothing silent.',
    body: 'Every dismiss, overrule, and kill needs a one-line reason, logged where the next agent — or the next you — will read it.',
  },
  {
    headline: 'JSON is never the default.',
    body: 'Every artifact has a human-readable face. The raw data is one toggle away when you want it.',
  },
  {
    headline: 'The irreversible ones ask twice.',
    body: 'Marking an organization Do not use takes a typed confirmation — organization name plus a reason. Human approval required is the default; the automation setting itself lives in Administration. Everything else is one click and an undo.',
  },
]

export default function HowToUsePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-baseline gap-3 border-b border-[color:var(--color-faint)] pb-4">
        <h1 className="font-[family-name:var(--font-display)] text-[27px] leading-none text-[color:var(--color-ink)]">
          How to use
        </h1>
        <span className="font-[family-name:var(--font-ui)] text-[11.5px] text-[color:var(--color-ink-soft)]">
          One editor, a full masthead. Here&apos;s the loop and the rules.
        </span>
      </div>

      <div className="mb-6">
        <ReplayTourButton />
      </div>

      {/* ─── The weekly loop ─────────────────────────────────────────── */}
      <section className="mb-9">
        <h2 className="mb-1.5 font-[family-name:var(--font-display)] text-[30px] leading-[1.05] text-[color:var(--color-ink)]">
          The weekly loop
        </h2>
        <p className="mb-5 max-w-[64ch] font-[family-name:var(--font-body)] text-[15.5px] leading-relaxed text-[color:var(--color-ink-soft)]">
          The pipeline does the legwork; you make the calls. Five moments, in
          order. Anything waiting on you always shows up in the{' '}
          <b className="text-[color:var(--color-vermilion)]">Awaiting you</b>{' '}
          chip, top-right, from any screen.
        </p>

        <div className="grid gap-0">
          {WEEKLY_LOOP.map((step) => (
            <div
              key={step.n}
              className="flex gap-4 border-t border-[color:var(--color-faint)] py-4 last:border-b"
            >
              <div className="min-w-[44px] font-[family-name:var(--font-display)] text-[34px] leading-none text-[color:var(--color-cobalt)]">
                {step.n}
              </div>
              <div>
                <div className="mb-1 font-[family-name:var(--font-display)] text-xl text-[color:var(--color-ink)]">
                  {step.title} ·{' '}
                  <span className="text-[15px] text-[color:var(--color-ink-soft)]">
                    {step.screen}
                  </span>
                </div>
                <p className="max-w-[70ch] font-[family-name:var(--font-body)] text-[14.5px] leading-[1.55] text-[color:var(--color-ink-soft)]">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── What the colors mean ────────────────────────────────────── */}
      <section className="mb-9">
        <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[26px] leading-[1.05] text-[color:var(--color-ink)]">
          What the colors mean
        </h2>
        <div className="grid max-w-[660px] grid-cols-1 gap-2.5 sm:grid-cols-2">
          {COLOR_LEGEND.map((entry) => (
            <div
              key={entry.hex}
              className="flex items-center gap-2.5 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] px-3.5 py-2.5"
            >
              <span
                className="block h-4 w-4 flex-none"
                style={{ background: entry.token }}
                aria-hidden="true"
              />
              <span className="font-[family-name:var(--font-body)] text-[13.5px] text-[color:var(--color-ink)]">
                {entry.meaning}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Four house rules ────────────────────────────────────────── */}
      <section className="mb-9">
        <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[26px] leading-[1.05] text-[color:var(--color-ink)]">
          Four house rules
        </h2>
        <div className="grid max-w-[720px] gap-2">
          {HOUSE_RULES.map((rule) => (
            <div
              key={rule.headline}
              className="bg-[color:var(--color-ink)] px-4 py-3 font-[family-name:var(--font-body)] text-sm leading-relaxed text-[color:var(--color-masthead-muted)]"
            >
              <b className="font-[family-name:var(--font-display)] text-base text-[color:var(--color-masthead-text)]">
                {rule.headline}
              </b>{' '}
              {rule.body}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
