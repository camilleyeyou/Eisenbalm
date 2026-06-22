<!--
  Eisenbalm Dispatch — Researcher USER-message template
  ⚠️  DO NOT DELETE the {charity} / {results_block} tokens — the pipeline fills
      them with the winning-charity dict + formatted Tavily research results.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
WINNING CHARITY:
{charity}

TAVILY RESEARCH RESULTS:
{results_block}

Return JSON ResearchOutputModel with all narrative fields filled and all source-URL fields either populated (pointing to charity's own domain) or null.
<!-- PROMPT END -->
