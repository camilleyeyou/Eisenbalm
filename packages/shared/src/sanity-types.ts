// ─── Sanity-derived types ─────────────────────────────────────────────
// This file is the single import point for apps/web (Phase 2) and
// packages/pipeline (Phase 4) to consume Sanity-generated types.
//
// Plan 05 replaces the TODO export below with a real re-export pointing
// at apps/studio/sanity.types.ts. Keeping the indirection here means
// schema changes only ripple through one path.
//
// TODO(plan-05): replace with `export type * from '../../../apps/studio/sanity.types'`
// (or the path-mapped equivalent once Plan 05 wires the typegen output).
export {}
