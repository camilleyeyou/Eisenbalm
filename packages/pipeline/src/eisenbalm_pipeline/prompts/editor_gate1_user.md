<!--
  Eisenbalm Dispatch — Editor Gate 1 USER-message template
  ⚠️  DO NOT DELETE the {issue_number} / {candidates_block} tokens — the pipeline
      fills them at run time (issue number + scored-candidate JSON).
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
Issue #{issue_number}

CANDIDATES WITH ADVOCATE SCORES:
{candidates_block}

Return JSON matching the EditorDecision schema: winnerName, confidence (0.0-1.0), requiresHumanInput (bool), editorReasoning, runnerUpNotes, deliberationTranscript.
<!-- PROMPT END -->
