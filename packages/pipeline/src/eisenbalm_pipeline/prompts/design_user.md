<!--
  Eisenbalm Dispatch — DesignAgent USER-message template (base, no-retry path)
  ⚠️  DO NOT DELETE the {charity_name} / {visual_direction} tokens — the pipeline
      fills them with the charity name + StyleBrief visual direction.
  On a validation-retry the pipeline APPENDS the prior errors after this base
  text (D-15 regenerate-once) — that suffix is built in code, not in this file.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
CHARITY: {charity_name}
VISUAL DIRECTION: {visual_direction}

Output JSON Theme: primaryColor, accentColor, backgroundColor, textColor, fontDisplay, fontBody.
<!-- PROMPT END -->
