/**
 * Phase 24 — extension-less `.ts`/`.tsx` runtime require() support for vitest.
 *
 * The Wave 0 RED scaffold tests (VariableRegistry / PromptEditor / DiffViewer)
 * load the new prompts components via a guarded runtime require() WITHOUT a
 * file extension, e.g.
 *
 *   require('../app/(dashboard)/prompt-lab/_components/VariableRegistry')
 *
 * vitest's CJS executor resolves runtime require() through Node's
 * `createRequire(...).resolve(id)`, whose extension search list is
 * `Module._extensions` — by default `.js`, `.json`, `.node` only. TypeScript
 * source is therefore not found and the test falls into its RED catch branch.
 *
 * Registering `.ts`/`.tsx` in `Module._extensions` makes the resolver find the
 * file AND compiles it (TypeScript → CJS) on load via `m._compile`, so the
 * extension-less require resolves to real exports. Static ESM imports are
 * untouched (Vite already transforms those).
 *
 * The transform uses the TypeScript compiler (`ts.transpileModule`) rather than
 * esbuild on purpose: this setup file runs once per test ENVIRONMENT, including
 * jsdom and edge-runtime. esbuild's native bridge asserts
 * `new TextEncoder().encode("") instanceof Uint8Array`, which is false under
 * jsdom/edge-runtime and throws on load. The TypeScript compiler is pure JS and
 * works in every environment.
 *
 * Loaded as a vitest `setupFiles` entry (runs once per test environment).
 */
import { Module } from 'node:module'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

type CompileModule = { _compile: (code: string, filename: string) => void }

// ── tsconfig path-alias resolution for the CJS require() hook ────────────────
// Vite (which transforms statically-imported ESM) honors tsconfig `paths` via
// the tsconfigPaths() plugin. The Module._extensions hook below uses raw Node
// CJS resolution, which knows nothing about those aliases — so a shim-compiled
// component doing `require('@convex/_generated/api')` would fail. Mirror the two
// aliases from tsconfig (`@convex/*` → ../../convex/*, `@/*` → app root) by
// rewriting alias specifiers to absolute paths before Node resolves them.
const _setupDir = path.dirname(fileURLToPath(import.meta.url)) // apps/dispatch-control/__tests__
const _appRoot = path.resolve(_setupDir, '..') // apps/dispatch-control
const _convexRoot = path.resolve(_appRoot, '../../convex') // <repo>/convex

const _moduleInternals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string
}
const _origResolveFilename = _moduleInternals._resolveFilename
_moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]): string {
  let req = request
  if (req === '@convex' || req.startsWith('@convex/')) {
    req = path.join(_convexRoot, req.slice('@convex'.length).replace(/^\//, ''))
  } else if (req.startsWith('@/')) {
    req = path.join(_appRoot, req.slice('@/'.length))
  }
  return _origResolveFilename.call(this, req, ...rest)
}

function register(ext: '.ts' | '.tsx'): void {
  const extensions = (Module as unknown as {
    _extensions: Record<string, (m: CompileModule, filename: string) => void>
  })._extensions
  if (extensions[ext]) return
  extensions[ext] = (m, filename) => {
    const src = fs.readFileSync(filename, 'utf8')
    const { outputText } = ts.transpileModule(src, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ext === '.tsx' ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
        jsxImportSource: 'react',
        esModuleInterop: true,
        allowJs: true,
        resolveJsonModule: true,
        isolatedModules: true,
      },
    })
    m._compile(outputText, filename)
  }
}

register('.ts')
register('.tsx')
