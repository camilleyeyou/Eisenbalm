/**
 * Shared convex-test utilities for Phase 23 integration tests.
 *
 * Re-exports `schema` from the monorepo Convex schema and `convexTest`
 * from the convex-test library, so individual test files can import both
 * from a single location.
 *
 * Relative path: apps/dispatch-control/__tests__/ → convex/schema.ts
 *   = ../../../convex/schema
 *
 * NOTE: Individual test files must pass `import.meta.glob` modules to
 * `convexTest({ schema, modules })` so Vite can statically analyze the
 * imports. The glob pattern must be literal in the calling file.
 */
export { convexTest } from 'convex-test'
export { default as schema } from '../../../convex/schema'
