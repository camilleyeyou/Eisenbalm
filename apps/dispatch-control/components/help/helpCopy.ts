/**
 * Quick 260722-fom (Task 1) — plain help copy data (no JSX side effects).
 *
 * Operator voice throughout: plain, dry, precise — matches existing UI copy
 * (DecisionRail / onboardingCopy.ts), NOT Jesse's magazine voice.
 *
 * Single source of truth for every HelpTip and always-visible inline helper
 * sentence, keyed by the surface that actually renders the control (see
 * PLAN.md's "CONFIRMED real render targets" — several keys below map to
 * surfaces that differ from their obvious page/file name, e.g. `storyBrief`
 * for the require/remove-lead controls and `signalDesk` for Gate-1
 * adjudication).
 *
 * Strings marked `// inline` render as an always-visible <p> helper (styled
 * like the NeedsYourDecisionCard precedent), never as a HelpTip popover.
 */

export const HELP_COPY = {
  issuesHome: {
    statusChip:
      'Where this issue sits in the weekly loop. "Ready to publish" means the agents have finished and the issue is not on hold.',
    claimCoverage:
      'How many factual claims the fact-checkers have checked. The agents remove or fix what the sources contradict. None of this blocks Publish.',
    scheduledSlot:
      'The next issue number, already reserved. "Start early" kicks off its pipeline run now instead of waiting for the Thursday schedule.',
  },
  workspace: {
    statusReadout:
      "The issue's overall state. \"State unknown — refresh\" means the live data dropped — reload to re-sync.",
    costBudget: 'Spend so far on this run versus the budget cap. Nearing the cap is a heads-up, not a hard stop.',
    stageTabs:
      'Each stage shows its own state — not started, in progress, needs you, or clean. Work them left to right.',
    // inline (Hold/Reopen area)
    hold: 'Put this issue on hold so it cannot be published. Nothing is lost. Anyone signed in can release the hold.',
  },
  story: {
    ranking:
      'The agents ranked candidates by advocate score. These are the top two — pick one, or steer to a different lead.',
  },
  storyBrief: {
    leadRequire: "Require this lead — force the pipeline to run it regardless of the agents' ranking.",
    // inline OR tip (executor's call)
    leadRemove:
      "Remove this lead from consideration, with a reason. The reason is written to the decision log and the pipeline won't pick it.",
  },
  factCheck: {
    claimMark: 'Read each claim and its verdict. Verifying or dismissing is optional and does not affect Publish.',
  },
  voice: {
    galley:
      'The agents fix machine-tells before you see the draft. Anything left jumps into the draft so you can edit it. Nothing here blocks Publish.',
    soundsHuman:
      'Optional. A record that you read it and it sounds human. It does not affect Publish.',
  },
  approval: {
    twoSignOff:
      'The agents write and check every story and fix what they find. The Editor-in-chief presses Publish. Anyone can put the issue on hold.',
    // inline
    publish: 'Publishing pushes the issue live to the public site. Collaborators can review and comment, not publish.',
  },
  runMonitor: {
    runState: "The pipeline run's live state — running, awaiting your review, complete, or failed.",
    recovery:
      'When a run fails, this rail shows where it broke and the two ways to recover: restart from the failed step, or adjudicate manually.',
  },
  promptLab: {
    activate: 'Make this saved version the one the pipeline uses on the next run. "Restore" activates an older version.',
    evalGate:
      "A version must pass evals before it can go active — run them here, or override with a reason if you're sure.",
  },
  signalDesk: {
    adjudicate:
      'The run is paused for a Gate-1 call. Pick a candidate and give a reason — submitting resumes the run with that charity.',
    advocateScore:
      "The advocate agent's score for how strong a story this candidate makes — higher is a stronger case, not a ranking you're bound to.",
  },
  settings: {
    notifications: 'Choose which run events notify you, and on which channel. Applies to every issue.',
  },
} as const
