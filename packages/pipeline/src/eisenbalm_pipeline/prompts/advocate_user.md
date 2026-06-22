<!--
  Eisenbalm Dispatch — Advocate USER-message template
  ⚠️  DO NOT DELETE the {candidates_json} token — the pipeline fills it with the
      Scout candidate JSON at run time.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
CANDIDATES (Scout output, JSON):
{candidates_json}

Return JSON AdvocateOutput with field `votes` (one AdvocateVote per candidate, same order as input).
<!-- PROMPT END -->
