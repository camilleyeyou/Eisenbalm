/**
 * Phase 56-09 — plain two-paragraph explanation per step, shown under
 * "In plain words" on the Behind-Run page. No jargon (EDITOR_BANNED_PATTERN).
 */
export interface StepExplanation {
  what: string
  next: string
}

const RETRY = 'This kind of problem usually clears up on a fresh start. Starting a new issue begins again from the beginning.'

export const STEP_EXPLANATIONS: Record<string, StepExplanation> = {
  leads: {
    what: 'The first step looks for recent stories that could shape this week’s issue. It could not finish, so the issue stopped before anything reached readers.',
    next: RETRY,
  },
  charities: {
    what: 'This step searches for small charities worth writing about and argues the case for each one. It could not finish, so the issue stopped before anything reached readers.',
    next: RETRY,
  },
  'verify-charities': {
    what: 'This step checks that each charity on the shortlist is a real, registered organisation. It could not confirm enough of them, so the issue stopped rather than write about a charity that might not exist.',
    next: 'This usually clears up on a fresh start, when a new shortlist is drawn up.',
  },
  choose: {
    what: 'This step picks the one charity the issue is about. It could not make a choice, so the issue stopped before anything was written.',
    next: RETRY,
  },
  research: {
    what: 'The research step gathers facts about the chosen charity from its website and other public sources. It could not finish, so the issue stopped before anything was written.',
    next: 'This usually happens when the charity’s own website is down or very thin. Starting a new issue picks a charity again and almost always goes through.',
  },
  'verify-research': {
    what: 'The research step gathered facts about the chosen charity. The checking step then tried to confirm each important fact against its source, but the charity’s website did not answer in time. Rather than publish facts it could not confirm, the issue stopped.',
    next: 'This kind of problem usually clears up on a fresh start. If the same charity is chosen again and the problem repeats, it will be set aside and another charity picked.',
  },
  write: {
    what: 'The writers were working on the nine parts of the issue when one of them could not finish. The issue stopped rather than go out with a part missing.',
    next: RETRY,
  },
  check: {
    what: 'After the writing, every part is read for facts, tone and mistakes. This check could not finish, so the issue stopped rather than go out unchecked.',
    next: RETRY,
  },
  final: {
    what: 'The final read-through looks at the whole issue once more before it comes to you. It could not finish, so the issue stopped.',
    next: RETRY,
  },
  publish: {
    what: 'The last step puts the issue on the website. It did not go through, so nothing reached readers.',
    next: 'Starting a new issue begins again from the beginning. If it keeps happening, tell Andrew.',
  },
}

export const GENERIC_EXPLANATION: StepExplanation = {
  what: 'One of the steps could not finish, so the issue stopped before anything reached readers.',
  next: 'Starting a new issue begins again from the start and usually goes through.',
}
