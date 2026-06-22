<!--
  Eisenbalm Dispatch — Scout USER-message template
  ⚠️  DO NOT DELETE the {results_block} token — the pipeline fills it with the
      formatted Tavily search results at run time.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
Parse the following Tavily search results into 3-5 CharityCandidate objects. Reject anything that does not look like a small or overlooked charity.

TAVILY RESULTS:
{results_block}

Return JSON ScoutBatchOutput with field `candidates` (list of 3-5 CharityCandidate objects).
<!-- PROMPT END -->
