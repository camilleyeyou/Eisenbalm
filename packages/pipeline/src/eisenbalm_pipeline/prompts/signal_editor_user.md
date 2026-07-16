<!--
  Eisenbalm Dispatch — Signal Editor USER-message template
  ⚠️  DO NOT DELETE the {results_block} token — the pipeline fills it with the
      formatted Tavily search results at run time.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
Parse the following dated news search results into 3-5 StoryLead objects. Return 3-5 leads, real sourced pegs only — never invent a date, event, or URL.

SEARCH RESULTS:
{results_block}

Return JSON SignalEditorOutput with field `leads` (list of 3-5 StoryLead objects).
<!-- PROMPT END -->
