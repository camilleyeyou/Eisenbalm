---
phase: 49-roles-permissions
plan: 02
type: execute
wave: 2
depends_on: ["49-01"]
files_modified:
  - .planning/phases/49-roles-permissions/49-VERIFICATION.md
autonomous: false
requirements: [ROL-01]
user_setup:
  - service: clerk
    why: "Role must live in Clerk publicMetadata and be exposed as a JWT 'role' claim on BOTH token surfaces so both backends read it without a DB round-trip (ROL-01)."
    dashboard_config:
      - task: "Add role claim to the default session token"
        location: "Clerk Dashboard → Configure → Sessions → Customize session token → Claims → add \"role\": \"{{user.public_metadata.role}}\""
      - task: "Add the SAME role claim to the named 'convex' JWT template"
        location: "Clerk Dashboard → JWT Templates → convex → Claims → add \"role\": \"{{user.public_metadata.role}}\""
      - task: "Assign publicMetadata.role on the test users"
        location: "Clerk Dashboard → Users → (test editor) publicMetadata {\"role\":\"Editor-in-chief\"}; (test collaborator) {\"role\":\"Collaborator\"}"

must_haves:
  truths:
    - "Clerk publicMetadata.role is exposed as a custom claim named 'role' on BOTH the default session token AND the named 'convex' JWT template."
    - "In a deployed/preview env, ctx.auth.getUserIdentity() returns role, and the FastAPI claims dict carries claims['role'] — verified empirically once before enforcement ships."
  artifacts:
    - path: ".planning/phases/49-roles-permissions/49-VERIFICATION.md"
      provides: "Recorded evidence that the role claim propagates end-to-end on both surfaces"
      contains: "Empirical claim-propagation gate"
  key_links:
    - from: "Clerk publicMetadata.role"
      to: "ctx.auth.getUserIdentity().role AND FastAPI claims['role']"
      via: "custom claim on both session token + convex JWT template"
      pattern: "role"
---

<objective>
Configure Clerk so a signed-in user's role reaches BOTH backends as a JWT claim, then empirically verify — ONCE, in a real (deployed/preview) env — that `ctx.auth.getUserIdentity().role` and the FastAPI `claims["role"]` actually resolve. This is the Wave-0 empirical gate the rest of the phase's enforcement relies on (RESEARCH Pitfall 1: convex-js ≥1.34 can silently drop the named-template claim).

Purpose: The enforcement code (Plans 49-03/49-04) is fully unit-testable on the local sentinel / injected-identity paths, but its PRODUCTION correctness depends on the claim actually propagating. This checkpoint proves that assumption before the phase is declared complete (Plan 49-09 depends on it).
Output: Two manual Clerk Dashboard claim edits; recorded empirical evidence appended to 49-VERIFICATION.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/49-roles-permissions/49-RESEARCH.md
@.planning/phases/49-roles-permissions/49-VALIDATION.md

<interfaces>
From convex/auth.config.ts — the applicationID that ties Convex to the named Clerk JWT template:
  applicationID: "convex"   // ⇒ the JWT template MUST be named literally "convex"

RESEARCH Pitfall 1 (load-bearing): apps/dispatch-control pins `convex: "^1.38.0"` (past the 1.34 change).
Mitigation = add the SAME `role` claim to BOTH token surfaces, then verify empirically.
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Configure the Clerk role claim on both token surfaces</name>
  <files>.planning/phases/49-roles-permissions/49-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pattern 1" (the exact claim shortcode + why both surfaces) and "### Pitfall 1" (the convex-js ≥1.34 landmine)
    - convex/auth.config.ts (confirms the template must be named "convex")
  </read_first>
  <what-built>
    The Phase 49 contract (§49) has locked role storage = Clerk `publicMetadata.role` (`"Editor-in-chief" | "Collaborator"`) exposed as a JWT claim named `role`. This step is the manual Clerk Dashboard configuration that no CLI/API in this repo performs.
  </what-built>
  <how-to-verify>
    In the Clerk Dashboard for the dispatch-control application:
    1. Configure → Sessions → "Customize session token" → Claims: add `"role": "{{user.public_metadata.role}}"`. (Add the individual field, NOT the whole `public_metadata` object — 1.2KB session-token size caveat.)
    2. JWT Templates → the template named literally `convex` (per convex/auth.config.ts applicationID) → Claims: add the SAME `"role": "{{user.public_metadata.role}}"`.
    3. Users → set `publicMetadata` `{"role":"Editor-in-chief"}` on one test user and `{"role":"Collaborator"}` on another.
    Confirm BOTH surfaces carry the claim — skipping either leaves that backend blind to role (RESEARCH: named template does not inherit session-token claims and vice-versa).
  </how-to-verify>
  <action>
    MANUAL, non-automatable Clerk Dashboard configuration (no repo CLI/API performs this). In the dispatch-control Clerk application: (1) Configure → Sessions → Customize session token → add claim `"role": "{{user.public_metadata.role}}"` (individual field, not the whole public_metadata object — 1.2KB caveat). (2) JWT Templates → the template named literally `convex` → add the SAME `"role": "{{user.public_metadata.role}}"`. (3) Users → set `publicMetadata.role` = "Editor-in-chief" on one test user and "Collaborator" on another. Both surfaces are required (a named template does not inherit session-token claims and vice-versa).
  </action>
  <verify>Human confirms both claim edits + two role-tagged test users exist in the Clerk Dashboard.</verify>
  <acceptance_criteria>
    - Both the default session token AND the `convex` JWT template have a `role` claim mapping to `{{user.public_metadata.role}}`.
    - At least one Editor-in-chief and one Collaborator test user exist with `publicMetadata.role` set.
  </acceptance_criteria>
  <resume-signal>Type "configured" once both claim edits and the two test users are in place, or describe what's blocking (e.g., no Clerk Dashboard access — this blocks the phase per RESEARCH "Environment Availability").</resume-signal>
  <done>Role claim configured on both token surfaces; two role-tagged test users exist.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Empirically verify the role claim propagates end-to-end, then record it</name>
  <files>.planning/phases/49-roles-permissions/49-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/49-roles-permissions/49-RESEARCH.md "### Pitfall 1" warning-signs paragraph (log `JSON.stringify(await ctx.auth.getUserIdentity())`)
    - .planning/phases/49-roles-permissions/49-VALIDATION.md "## Manual-Only Verifications"
  </read_first>
  <what-built>
    A one-time empirical spot-check that the configured claim actually arrives on both backends in a real token-minting env (the local sentinel path CANNOT prove this).
  </what-built>
  <how-to-verify>
    In a deployed/preview env (not local — local uses the sentinel):
    1. Sign in as the Editor-in-chief test user. From any existing authenticated Convex mutation/query, temporarily log `JSON.stringify(await ctx.auth.getUserIdentity())` and confirm `role: "Editor-in-chief"` is present (this proves the convex-js ≥1.34 raw-session-token-vs-template path did NOT drop the claim).
    2. Hit any authenticated FastAPI control route with that user's token and confirm the decoded `claims` dict contains `"role": "Editor-in-chief"`.
    3. Repeat as the Collaborator user; confirm `role: "Collaborator"` on both surfaces.
    Remove any temporary logging afterward.
  </how-to-verify>
  <action>
    After verifying, append an "## Empirical claim-propagation gate (ROL-01)" entry to `.planning/phases/49-roles-permissions/49-VERIFICATION.md` recording: date, env used, and the confirmed values (`getUserIdentity().role` and FastAPI `claims["role"]`) for BOTH roles. This recorded evidence is the artifact Plan 49-09 checks before declaring the phase complete. Remove any temporary debug logging from convex/*.ts.
  </action>
  <verify>
    <automated>grep -c "Empirical claim-propagation gate" .planning/phases/49-roles-permissions/49-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - 49-VERIFICATION.md contains a section titled "Empirical claim-propagation gate (ROL-01)" recording confirmed `role` values for Editor-in-chief and Collaborator on BOTH surfaces.
    - Any temporary debug logging was removed (no stray `JSON.stringify(await ctx.auth.getUserIdentity())` left in convex/*.ts: `grep -rc "JSON.stringify(await ctx.auth.getUserIdentity" convex` == 0).
  </acceptance_criteria>
  <resume-signal>Type "verified" with the observed role values, or report the mismatch (e.g., role undefined on the Convex side ⇒ the named-template claim was dropped — re-check Task 1 step 2).</resume-signal>
  <done>49-VERIFICATION.md records the confirmed role values on both surfaces; temporary logging removed.</done>
</task>

</tasks>

<verification>
- Role claim configured on both the session token and the `convex` JWT template.
- Empirical evidence recorded in 49-VERIFICATION.md that both backends see `role`.
</verification>

<success_criteria>
A signed-in user's Clerk `publicMetadata.role` is provably visible as `role` to BOTH `ctx.auth.getUserIdentity()` and the FastAPI claims dict in a real env — the foundation ROL-01 enforcement depends on.
</success_criteria>

<output>
After completion, create `.planning/phases/49-roles-permissions/49-02-SUMMARY.md`.
</output>
