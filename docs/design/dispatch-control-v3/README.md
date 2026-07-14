# Dispatch Control v3 — design source

Binding spec for the v4.0 milestone (Dispatch Control v3 — Editorial Workspace).

## Files

| File | Role |
|---|---|
| `Dispatch Control v3 - Annotations.md` | **Binding semantic spec.** Screens, states, permissions, empty/loading/error states, nomenclature table. |
| `Dispatch Control v3.dc.html` | **Binding visual + interaction spec.** ⚠️ **NOT YET IN REPO — please drop the original file here.** See note below. |
| `DERIVED-STATE-CONTRACT.md` | Extract of the prototype's `DCLogic` state machine + inspector artifact shape. Transcribed from the prototype; authoritative for phase planning. |

### Note on `Dispatch Control v3.dc.html`

The prototype was shared in-conversation with mangled UTF-8 (`Â·`, `â`, `ð`), which makes a faithful transcription lossy — glyphs like `✓ ⚠ ✕ ⟳ ▸ ⏸ 🔒` are unrecoverable from the corrupted bytes. Rather than commit a fabricated copy as a *binding* spec, drop the original `.dc.html` into this folder. Everything the implementation actually depends on — layout, logic, and tokens — is captured in the two markdown files here, and the design tokens were verified against `apps/dispatch-control/app/globals.css` (identical: Newsreader/Lora/Space Grotesk/IBM Plex Mono, `#17140e` `#e9eaec` `#253ad4` `#e8471d` `#f2b01e` `#148a52`, `--radius: 0`).

## What carries over from v2 unchanged

The **1c design system shipped in Phase 30 is the v3 design system.** No token work. The v2 design brief's earlier palette (Cormorant Garamond, rust `#C2502A`, gold `#CDA434`, warm paper) was already superseded by `dispatch-control-v2/Dispatch Control.dc.html` and is dead. Do not reintroduce it.

## Color semantics (load-bearing — every state carries label + icon too, never color alone)

| Token | Meaning |
|---|---|
| `cobalt #253ad4` | inspect / provenance / agent attribution / links |
| `vermilion #e8471d` | Must fix · failure · unsourced claim · active nav marker |
| `marigold #f2b01e` | sourced-claim wash · deterministic-check diamond · draft version |
| `marigold-text #9a6f04` | Review recommended · warning |
| `green #148a52` | checked · verified · approved · publish |
| `ink #17140e` | primary action surface, masthead |

## Decisions taken at milestone kickoff (2026-07-14)

1. **"Start from my brief" is in scope.** Second pipeline entry point: human supplies premise/peg/organization; Scout + Gate 1 are skipped; the run enters at Researcher.
2. **Publish drops typed confirmation** (reverses Phase 34). Exact preview + one click. The gate is the safety: Must fix = 0 ∧ Fact Check complete ∧ Voice approved current. Typed confirmation survives **only** for Mark Do-not-use.
3. **Claim importance** (Load-bearing / Supporting / Incidental) is emitted by the Researcher as a field on each claim. Not a new judge call, not derived post-hoc.
4. **"Changed since check"** is a block-level touched-counter, not a re-verification requirement — matching the prototype, where an edit whose replacement text is itself sourced still increments the counter.
5. **Sign-off revocation stays as Phase 34 built it.** The prototype does *not* revoke voice approval when a revision is applied, contradicting its own copy ("any later material prose change returns this to Review needed"). That is a prototype bug. Our behavior is correct; port the sentence, not the wiring.
