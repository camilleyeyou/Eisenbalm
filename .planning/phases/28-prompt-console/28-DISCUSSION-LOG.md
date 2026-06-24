# Phase 28: Prompt Console — Editorial Authoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 28-prompt-console
**Areas discussed:** Canonical source of truth, Rubric-scoring mechanism, Editorial context + drift safety, Variable tooling depth

---

## Canonical source of truth

### Authority
| Option | Description | Selected |
|--------|-------------|----------|
| DB authoritative | prompt_versions canonical; .md seed-only + fallback; add publish/export; dashboard is editing home | ✓ |
| .md authoritative | .md stays canonical (git/code-review); DB as override + drift/import surface | |

### Round-trip
| Option | Description | Selected |
|--------|-------------|----------|
| Retire for prompts; dashboard is home | Console replaces the Google-Docs/.docx round-trip for prompts; .docx stays for non-prompt copy only | ✓ |
| Keep as an import path | Keep the Doc/.docx round-trip; surface divergence + import/reconcile | |
| Unsure — it's editorial copy | Clarify scope; maybe round-trip out of scope | |

### Drift surface
| Option | Description | Selected |
|--------|-------------|----------|
| Drift badge + copyable export | Per-prompt drift badge + button rendering exact .md-marker content to copy→commit; no repo write (Vercel boundary) | ✓ |
| Drift badge only | Surface divergence visually; accept stale fallback | |
| Pipeline-side sync script | Script writes active DB versions to .md, run manually/CI | |

**User's choice:** DB authoritative; retire round-trip for prompts; drift badge + copyable export.
**Notes:** The dashboard runs on Vercel and cannot write the git repo — export is copy-to-clipboard of the byte-exact `.md`-marker form so the `load_prompt`/`_extract` fallback stays valid.

---

## Rubric-scoring mechanism

### Mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Standalone scoring call, loads same rubric | New lightweight call (output + active rubric) → score; single arbitrary output; brand-agnostic | ✓ |
| Reuse QA judge via new endpoint | Run judge over single output, derive number from findings; assumes narrative section bodies | |

### Score shape
| Option | Description | Selected |
|--------|-------------|----------|
| Per-axis breakdown + overall + rationale | Each voice axis pass/score + headline number + 1–2 line rationale | ✓ |
| Single 0–100 headline only | One number + rationale | |
| Pass / flag / fail verdict | Coarse traffic-light, no numbers | |

### Gating
| Option | Description | Selected |
|--------|-------------|----------|
| Advisory only | Never blocks save/activate; consistent with QA judge D-04 | ✓ |
| Soft warning on save | Low score → confirm-before-save, overridable | |

**User's choice:** Standalone scoring call loading the real rubric; per-axis + overall + rationale; advisory only.

---

## The authoring loop — side-by-side

### Side-by-side execution
| Option | Description | Selected |
|--------|-------------|----------|
| Draft by default, active on-demand | Run draft (1× cost); 'compare against active' button runs active too | ✓ |
| Run both every time | Every Run executes draft AND active (2× cost/latency) | |

### Score delta
| Option | Description | Selected |
|--------|-------------|----------|
| Score whichever side(s) ran, show delta when both | Draft always scored; active scored on compare; show delta | ✓ |
| Score the draft only | Active shown for raw comparison, not scored | |

**User's choice:** Draft by default, active on-demand; score whichever ran, show delta when both.

---

## Editorial context + drift safety

### Description source
| Option | Description | Selected |
|--------|-------------|----------|
| Console-side descriptions map for all keys | One brand-agnostic map keyed by agentKey, covers all editable keys; seed from agents.description | ✓ |
| Convex agents.description + fallback map | agents.description for agent nodes; static map for non-agent keys | |
| Sanity agentProfile role/personality | Rich but narrative-only + Eisenbalm-specific (violates brand-agnostic) | |

### Unsaved guard
| Option | Description | Selected |
|--------|-------------|----------|
| In-app guard on leave + switch | Confirm on navigate/switch/toggle with dirty draft + indicator | ✓ |
| Full guard incl. beforeunload | Above + native beforeunload prompt | |
| Dirty indicator only | Badge only, no dialogs | |

### Search/filter
| Option | Description | Selected |
|--------|-------------|----------|
| Text search + group + drift filter | Name text + group + 'edited since seed' drift | ✓ |
| Text search + group filter | Name + group only | |
| Text search only | Name search only | |

**User's choice:** Console-side descriptions map; in-app unsaved guard; text + group + drift filter.

---

## Variable tooling depth

### Variable descriptions
| Option | Description | Selected |
|--------|-------------|----------|
| Global descriptions map keyed by variable name | DRY; pairs with names-only VARIABLE_REGISTRY without changing its shape | ✓ |
| Extend VARIABLE_REGISTRY to {name, description} | Per-agentKey objects; duplicates shared-var descriptions; rewrites consumed shape | |

### Preview sample values
| Option | Description | Selected |
|--------|-------------|----------|
| Client-side per-variable sample map, instant | Substitute instantly, no server call; readability aid not execution | ✓ |
| Reuse server SAMPLE_FIXTURES via endpoint | Faithful to test-run; fixtures are per-agent dicts + adds fetch | |

**User's choice:** Global variable→description map + client-side variable→sample map. Unused-variable hint = passive advisory (complement to the existing unknown-variable save gate).

## Claude's Discretion

- Scoring endpoint shape/location; structured-output use.
- Active-side test-run reuse for compare.
- Drift detection implementation + .md-marker export rendering.
- Layout of side-by-side, assembled-preview, chip tooltips, drift badge, filters.
- Unsaved-guard mechanism (route interception vs in-component confirm).
- Descriptions/sample map file organization + initial copy text.

## Deferred Ideas

- Pipeline-side CI sync script (.md write-back).
- Server SAMPLE_FIXTURES reuse for the preview.
- Score-based save gating.
- Native beforeunload guard.
- Editable graph topology (productization).
- RBAC (users.role).
