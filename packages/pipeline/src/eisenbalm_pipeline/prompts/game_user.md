<!--
  Eisenbalm Dispatch — Game USER-message template
  ⚠️  DO NOT DELETE the {charity_name} / {mission_statement} tokens — the pipeline
      fills them with the winning charity's name + mission statement.
  Edit only the prose between PROMPT START and PROMPT END.
-->
<!-- PROMPT START -->
CHARITY: {charity_name}
MISSION: {mission_statement}

Step 1 — design before code. Choose ONE mechanic from the catalog. Decide, in one line each: the verb, the single input, what the player catches/taps/stops (real nouns from the mission), what counts as the win, and the stake. If the design takes more than one sentence to explain, choose a simpler mechanic.

Step 2 — build it to the contract: three screens, HUD on top, fits any frame from 320×420 upward without scrolling, touch and keyboard, instant restart.

Return JSON GameOutput with: headline, goal, howToPlay (2–3 steps), controls, description, embedCode (complete self-contained HTML document with one inline <style> and one inline <script> — no external dependencies of any kind).
<!-- PROMPT END -->
