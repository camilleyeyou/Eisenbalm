# Coding Conventions

**Analysis Date:** 2025-02-09

## Current Status

**No linting, formatting, or style guide configuration exists yet.** The project is in early scaffolding. Conventions below are observed in existing schema files only. These patterns should be adopted as baseline when configuration is added.

---

## Naming Patterns

**Files:**
- Sanity schema files: `camelCase.ts` — e.g., `charity.ts`, `weeklyIssue.ts`, `agentProfile.ts` (`schemas/` directory)
- Convex schema: `schema.ts` (`convex/schema.ts`)
- Index files: `index.ts` with named exports of types

**Functions/Variables:**
- `camelCase` throughout: `defineSchema()`, `defineTable()`, `defineField()`, `defineType()`
- Helper functions: `camelCase` — e.g., `editorialSection()` in `schemas/weeklyIssue.ts`

**Types/Interfaces:**
- TypeScript `TypedDict` for schema validation (Convex): `PipelineRuns`, `DeliberationEvents`, `AgentVotes`, `QaCorrections`, `PitchLog`
- Sanity schema objects: inline with `defineField()` calls, no separate type exports

**Database Fields:**
- `camelCase` for all field names: `issueNumber`, `charityId`, `agentId`, `eventType`, `startedAt`, `completedAt`
- Timestamps: `*At` suffix (e.g., `startedAt`, `completedAt`, `timestamp`)
- Status fields: `kebab-case` literal values — e.g., `'running' | 'awaiting-review' | 'complete' | 'failed'`
- Enum-like values: `kebab-case` — e.g., `'scout-finding'`, `'advocate-argument'`, `'editor-decision'`
- Slug fields: `'slug'` field with `{ _type: 'slug', current: 'kebab-case-value' }` structure

---

## Code Style Observations

**TypeScript (Convex schema):**
- `convex/schema.ts` uses functional builder pattern: `defineSchema()` wrapping `defineTable()` calls
- Field definitions: `v.string()`, `v.number()`, `v.optional()`, `v.union()` — Convex values API
- Literal union types: `v.literal('literal-value')` for enum fields
- Indices defined inline: `.index('by_fieldName', ['fieldName'])` after field definitions
- No explicit type annotations in table definitions — validation happens via Convex values

**TypeScript (Sanity schemas):**
- `schemas/` files use functional builder pattern: `defineType()` wrapping `defineField()` calls
- Field definitions: `defineField()` for every field, even in nested objects
- Validation: `validation: Rule => Rule.required()` pattern for required fields
- Nested objects: `type: 'object'`, inline `fields: []` array
- References: `type: 'reference', to: [{ type: 'charity' }]` pattern
- Slug generation: `options: { source: 'name', maxLength: 96 }` or dynamic `source: (doc: any) => ...`
- Preview rendering: `preview: { select: {...}, prepare: ({...}) => {...} }` for Studio display
- Comments: section headers using `// ─── Name ──────` ASCII art separators (in `weeklyIssue.ts`)

**Organization:**
- Schema exports are default exports: `export default defineType({...})`
- Index file uses named exports: `export const schemaTypes = [...]`
- No utility imports outside of Sanity/Convex SDK

---

## Import Organization

**Sanity schemas** (`schemas/charity.ts`, `schemas/weeklyIssue.ts`, `schemas/agentProfile.ts`):
```typescript
import { defineField, defineType } from 'sanity'
```

**Convex schema** (`convex/schema.ts`):
```typescript
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
```

**Index file** (`schemas/index.ts`):
```typescript
import charity from './charity'
import weeklyIssue from './weeklyIssue'
import agentProfile from './agentProfile'
```

No path aliases observed. All imports are relative or from primary SDK packages.

---

## Field Design

**Validation:**
- Required fields: `validation: Rule => Rule.required()`
- Numeric ranges: `Rule.integer().min(1800).max(currentYear)`
- URL fields: `type: 'url'` (built-in validation)
- Slug fields: `type: 'slug'` with source option

**Optional vs. Required:**
- Convex: `v.optional(v.type())` for optional fields
- Sanity: Absence of validation rule = optional; `validation: Rule => Rule.required()` = required

**Descriptions and Help Text:**
- `title: 'Human-Readable Label'` — shown in Sanity Studio UI
- `description: 'Help text or guidance'` — shown below field in Studio
- Descriptions use plain English, no code snippets

**Special Patterns:**
- Portable Text fields in Sanity: `type: 'array', of: [{ type: 'block' }]`
- JSON-in-string fields: `type: 'text'` with `description: 'JSON: ...'` comment (e.g., `modelVersions` in Convex state)
- File/asset uploads: `type: 'file'` or `type: 'image'` with `options: { accept: '...' }`

---

## Comments and Documentation

**Section Headers:**
- Used in `schemas/weeklyIssue.ts` to organize large schema definitions
- Pattern: `// ─── Name ──────────────────────────────────────────────────────────────────`

**Inline Comments:**
- Sanity schema comments explain editorial intent or constraint — e.g., "Jesse voice, played completely straight"
- Convex table comments explain data model purpose — e.g., "One record per weekly pipeline run"
- No JSDoc/TSDoc annotations observed

**Field Descriptions:**
- Use `description` field in Sanity `defineField()` to document intent and constraints
- Descriptions in Convex comments above table/field definitions

---

## Convex-Specific Patterns

**Table Definition:**
- `defineTable({ fieldName: v.validator() })` — all fields declared upfront
- Index naming: `.index('by_fieldName', ['fieldName'])` for single-field indices
- Compound indices: `.index('by_runId_and_type', ['runId', 'eventType'])`

**Value Validators:**
- `v.string()`, `v.number()`, `v.boolean()` — primitive types
- `v.optional(v.type())` — optional fields
- `v.union(v.literal(...), v.literal(...))` — enum-like union types
- `v.any()` — only for JSON payload strings

**Timestamps:**
- Stored as Unix milliseconds: `v.number()`
- Calculated at write time, not query time
- Named consistently: `*At` for datetime-like fields, `timestamp` for event streams

---

## Sanity-Specific Patterns

**Document Types:**
- `type: 'document'` for top-level content (charity, weeklyIssue, agentProfile)
- `type: 'object'` for embedded nested structures (theme, caseStudy, bonus, etc.)

**Slug Fields:**
- Auto-generated from source field using Sanity's slug type
- Source can be static (`source: 'name'`) or dynamic (`source: (doc) => ...`)
- `maxLength: 96` for slugs
- Deterministic slug generation for charity documents: `f'charity-{slugified-name}'`

**References:**
- `type: 'reference', to: [{ type: 'documentTypeName' }]`
- Used to link charity → weeklyIssue and charity → agentProfile
- Sanity automatically resolves references in GROQ queries with `->` syntax

**Portable Text (Rich Text):**
- `type: 'array', of: [{ type: 'block' }]` for body text
- Pipeline converts plain text to Portable Text via `text_to_portable_text()` helper function
- Helper generates `_type: 'block'`, `_key` (UUID), `style`, `markDefs`, `children` structure

**Preview:**
- `preview: { select: {...}, prepare: (...) => {...} }` controls Studio card display
- Used in all document types to show meaningful summaries
- Example: charity preview shows `name` and `location`

---

## Brand & Voice Constraints (from brief, implies convention)

**Jesse's Voice:**
- "Dry, precise, and absurdly serious. No winking. No irony signaling."
- Applied to all agent prompts and section content
- Field descriptions in schemas reflect this tone (e.g., "Founder Bio: Jesse voice, Fortune 500 treatment")

**Charity Treatment:**
- Charities treated with gravity equal to Fortune 500 companies
- Founders treated as visionaries regardless of obscurity
- Question: "Why do you deserve to exist?" — answered without sentiment

**No Gimmicks:**
- "Jesse was born AI. This is not a gimmick."
- Implies: straightforward implementation, no cutesy naming, no artificial pacing

---

## REST + Webhook Boundaries (from brief, implies convention)

**No Shopify, no framework-specific commerce patterns** — Stripe custom integration only

**Webhook handling:**
- Sanity webhook: FastAPI route `POST /webhook/sanity-publish` with HMAC validation
- Signature verification: `hmac.compare_digest(expected, provided)`
- Return `200` immediately, run async tasks in background

**API boundaries:**
- Next.js → Sanity: GROQ read queries (stateless CDN reads)
- Pipeline → Sanity: Python client writes (deterministic document IDs for upserts)
- Pipeline → Convex: HTTP mutation calls (async, non-blocking)
- Next.js → Convex: TypeScript React hooks (real-time subscriptions)

---

## File Paths Reference

**Existing schema files:**
- `convex/schema.ts` — Convex database schema (tables: pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog)
- `schemas/charity.ts` — Sanity document type for charities
- `schemas/weeklyIssue.ts` — Sanity document type for weekly editorial content
- `schemas/agentProfile.ts` — Sanity document type for agent character profiles
- `schemas/index.ts` — Exports all schema types for Sanity Studio integration

**Future files (implied by brief):**
- `apps/web/lib/sanity/queries.ts` — GROQ query definitions
- `packages/pipeline/lib/sanity_client.py` — Python Sanity client initialization
- `packages/pipeline/lib/convex_client.py` — Python Convex HTTP mutation caller
- `packages/pipeline/lib/portable_text.py` — Portable Text conversion helper
- `packages/pipeline/types.py` — LangGraph DispatchState TypedDict
- `apps/web/types/issue.ts` — TypeScript types for issue data structure

---

## Summary

**Established patterns (adopt immediately):**
- `camelCase` for code identifiers, `kebab-case` for enum/status literals
- Functional builder pattern for all schemas (Sanity `defineField`/`defineType`, Convex `defineSchema`/`defineTable`)
- Section headers with ASCII separators for large files
- Inline validation rules in schema definitions
- Default export for schema types, named export for index collections

**Not yet configured (add at next milestone):**
- ESLint configuration (no `.eslintrc` exists)
- Prettier formatting (no `.prettierrc` exists)
- TypeScript strict mode settings (no `tsconfig.json` shared)
- Pre-commit hooks
- Editor config (`.editorconfig`)

**Implied constraints (follow when writing code):**
- Jesse's dry, precise voice — no winking, no irony
- REST boundaries at Sanity, Convex, and Stripe
- No framework shortcuts; custom integration patterns
- Deterministic document IDs for upserts (no random UUIDs)
