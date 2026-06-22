<!--
  Eisenbalm Dispatch — Bonus (Jingle) USER-message template
  ⚠️  DO NOT DELETE the {charity_name} / {mission_statement} / {visual_direction}
      tokens — the pipeline fills them with the charity name, mission, and
      StyleBrief visual direction.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
CHARITY: {charity_name}
MISSION: {mission_statement}
VISUAL DIRECTION: {visual_direction}

Return JSON JingleBonus with sunoAudioUrl set to empty string.
<!-- PROMPT END -->
