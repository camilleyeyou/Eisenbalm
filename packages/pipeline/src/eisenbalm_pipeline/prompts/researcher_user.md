<!--
  Eisenbalm Dispatch — Researcher USER-message template
  ⚠️  DO NOT DELETE the {charity} / {results_block} / {corrections} /
      {source_material} tokens — the pipeline fills them with the
      winning-charity dict, formatted Tavily research results, (MEM-03)
      this charity's prior editorial corrections log if any, and (Phase 48
      D-10) operator-supplied source material from a "Start from my brief"
      entry, if any. {corrections} and {source_material} may both render as
      an empty string when absent (a discovery run always has no source
      material; most charities have no corrections on file).
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
WINNING CHARITY:
{charity}

{corrections}

{source_material}

TAVILY RESEARCH RESULTS:
{results_block}

Return JSON ResearchOutputModel with all narrative fields filled and all source-URL fields either populated (pointing to charity's own domain) or null. Also populate `claims` with a `{text, sourceIndex}` entry for every number, date, name, or statistic worth checking — sourceIndex referencing the numbered [S#] result it came from, or null if unsourced. If PRIOR EDITORIAL CORRECTIONS are present above, account for them — do not repeat a fact a prior correction flagged as wrong.
<!-- PROMPT END -->
