#!/usr/bin/env node
// Report-only Convex deploy-parity guard.
//
// Problem: git-committed convex/*.ts is NOT automatically live on the
// deployment until someone runs `convex dev`/`convex deploy`. Locally,
// `convex/_generated/api.d.ts` lists MODULES, not individual function
// names, so a function that was committed but never synced still looks
// "present" from a static read of the generated types. Nothing catches
// that drift until a caller hits it in production.
//
// This script closes that gap by diffing two sets:
//   - DEPLOYED: every `module:function` path reported by the live
//     `convex function-spec` for the deployment configured in
//     convex/.env.local (currently dev:modest-magpie-797).
//   - CALLED: every `module:function`-shaped string literal found by
//     scanning packages/pipeline/src/**/*.py (the Python pipeline is the
//     untyped caller — nothing there is checked against Convex at
//     build time).
//
// It NEVER runs `convex dev` or `convex deploy` and never mutates
// anything — it only reads `convex function-spec`.
//
// Exit codes:
//   0 -> every called path is present on the deployment (success)
//   1 -> at least one called path is missing (real parity failure)
//   2 -> could not reach / parse the deployment, or the pipeline source
//        directory is missing (SKIP - "couldn't check", NOT "all clear")
//
// Phase 40 Plan 40-05 (Rule 3 auto-fix): moved from convex/scripts/ to
// repo-root scripts/ — living inside convex/ made Convex's function
// bundler try to bundle this file as a Convex function on every
// `convex codegen`/`convex dev`, which fails because it uses Node
// built-ins (`node:child_process`, `node:fs`, etc.) without a "use node"
// directive. This script was never meant to be a Convex function (it
// shells out to the Convex CLI itself) — it belongs outside convex/.
// Path derivation below updated accordingly; behavior is unchanged.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const convexDir = path.join(repoRoot, 'convex');
const pipelineSrc = path.join(repoRoot, 'packages/pipeline/src');

const DEPLOYMENT_NAME = 'dev:modest-magpie-797';

// Matches "module:function" or 'module:function' — both identifier
// halves must be valid Python/JS-style identifiers. Hyphenated strings
// (e.g. "dev:modest-magpie-797") do not match because `-` is not in
// [A-Za-z0-9_]. Header-style strings ("Content-Type") do not match
// because they contain no `word:word` colon at all.
const MODULE_FN_RE = /^[A-Za-z_][A-Za-z0-9_]*:[A-Za-z_][A-Za-z0-9_]*$/;

// Finds every quoted string literal (single or double) on a line and
// captures its inner content in group 1 (double-quoted) or group 2
// (single-quoted).
const STRING_LITERAL_RE = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g;

function skip(message, detail) {
  console.error(`SKIP: ${message}`);
  if (detail) {
    console.error(String(detail));
  }
  process.exit(2);
}

function getDeployedSpec() {
  let stdout;
  try {
    stdout = execFileSync('npx', ['convex', 'function-spec'], {
      cwd: convexDir,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    skip(
      'could not reach Convex deployment (convex function-spec failed) — parity NOT checked',
      err && err.message
    );
    return; // unreachable — skip() exits the process
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    const first = stdout.indexOf('{');
    const last = stdout.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      skip(
        'could not reach Convex deployment (convex function-spec failed) — parity NOT checked',
        'stdout did not contain a parseable JSON object'
      );
      return;
    }
    try {
      parsed = JSON.parse(stdout.slice(first, last + 1));
    } catch (err2) {
      skip(
        'could not reach Convex deployment (convex function-spec failed) — parity NOT checked',
        err2 && err2.message
      );
      return;
    }
  }

  if (!parsed || !Array.isArray(parsed.functions)) {
    skip(
      'could not reach Convex deployment (convex function-spec failed) — parity NOT checked',
      'parsed response is missing a `.functions` array'
    );
    return;
  }

  return parsed;
}

function buildDeployedSet(spec) {
  const set = new Set();
  for (const fn of spec.functions) {
    if (!fn || typeof fn.identifier !== 'string') continue;
    // "module.js:fn" -> "module:fn"
    set.add(fn.identifier.replace(/\.js:/, ':'));
  }
  return set;
}

function walkPythonFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === '__pycache__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkPythonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.py')) {
      results.push(full);
    }
  }
  return results;
}

// Over-collects by design: a few `module:function`-shaped strings live
// in docstrings/comments (e.g. references to real deployed functions
// used as documentation). That's fine — those are real deployed
// functions, so they will never false-flag as missing. We deliberately
// do NOT try to detect the convex_query/convex_mutation helper call or
// argument position; a plain string-literal scan is the robust
// approach given multi-line call sites.
function collectCalledPaths(srcDir, rootDir) {
  if (!fs.existsSync(srcDir)) {
    skip(`pipeline source directory not found: ${srcDir}`);
    return new Map(); // unreachable — skip() exits the process
  }

  const calledMap = new Map(); // "module:fn" -> ["file:line", ...]
  const files = walkPythonFiles(srcDir);

  for (const file of files) {
    const relPath = path.relative(rootDir, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      STRING_LITERAL_RE.lastIndex = 0;
      let match;
      while ((match = STRING_LITERAL_RE.exec(line)) !== null) {
        const inner = match[1] !== undefined ? match[1] : match[2];
        if (inner && MODULE_FN_RE.test(inner)) {
          const ref = `${relPath}:${lineNo}`;
          if (!calledMap.has(inner)) {
            calledMap.set(inner, []);
          }
          calledMap.get(inner).push(ref);
        }
      }
    });
  }

  return calledMap;
}

function main() {
  const spec = getDeployedSpec();
  const deployedSet = buildDeployedSet(spec);
  const calledMap = collectCalledPaths(pipelineSrc, repoRoot);

  const calledPaths = [...calledMap.keys()].sort();
  const missing = calledPaths.filter((p) => !deployedSet.has(p));

  if (missing.length > 0) {
    console.error(
      '✗ convex deploy parity FAILED — function(s) called from the pipeline are missing from the live deployment\n'
    );
    console.error(
      `Run: pnpm --filter @eisenbalm/convex dev:once   (syncs convex/ to ${DEPLOYMENT_NAME}), then re-run pnpm check:convex-parity\n`
    );
    for (const called of missing) {
      console.error(`  ${called}`);
      for (const ref of calledMap.get(called)) {
        console.error(`    - ${ref}`);
      }
    }
    console.error(`\ntotal called: ${calledPaths.length}, total deployed: ${deployedSet.size}`);
    process.exit(1);
    return;
  }

  console.log(
    `✓ convex deploy parity: ${calledPaths.length} called functions all present on ${DEPLOYMENT_NAME} (${deployedSet.size} deployed)`
  );
  process.exit(0);
}

main();
