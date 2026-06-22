<!--
  Eisenbalm Dispatch — Game USER-message template
  ⚠️  DO NOT DELETE the {charity_name} / {mission_statement} tokens — the pipeline
      fills them with the winning charity's name + mission statement.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
CHARITY: {charity_name}
MISSION: {mission_statement}

Return JSON GameOutput with: headline (game title), description (50-100 word plain-text summary for accessibility), embedCode (complete self-contained HTML document including inline <style> and inline <script> — no external dependencies of any kind).
<!-- PROMPT END -->
