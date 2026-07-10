<!--
  Eisenbalm Dispatch — Researcher USER-message template
  ⚠️  DO NOT DELETE the {charity} / {results_block} / {corrections} tokens —
      the pipeline fills them with the winning-charity dict, formatted
      Tavily research results, and (MEM-03) this charity's prior editorial
      corrections log, if any. {corrections} may render as an empty string
      when the charity has no corrections on file.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
WINNING CHARITY:
{charity}

{corrections}

TAVILY RESEARCH RESULTS:
{results_block}

Return JSON ResearchOutputModel with all narrative fields filled and all source-URL fields either populated (pointing to charity's own domain) or null. Also populate `claims` with a `{text, sourceIndex}` entry for every number, date, name, or statistic worth checking — sourceIndex referencing the numbered [S#] result it came from, or null if unsourced. If PRIOR EDITORIAL CORRECTIONS are present above, account for them — do not repeat a fact a prior correction flagged as wrong.
<!-- PROMPT END -->
