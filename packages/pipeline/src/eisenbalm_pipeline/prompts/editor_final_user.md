<!--
  Eisenbalm Dispatch — Editor Final USER-message template
  ⚠️  DO NOT DELETE the {qa_corrections_json} / {section_headlines_json} tokens —
      the pipeline fills them with the QA-findings JSON + section-headline JSON.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
QA FINDINGS:
{qa_corrections_json}

SECTION HEADLINES:
{section_headlines_json}

Return JSON EditorFinalOutput with editorFinalNotes (100-300 words).
<!-- PROMPT END -->
