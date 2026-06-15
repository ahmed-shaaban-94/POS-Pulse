# #349 — Re-pin api-types.ts to deployed read-down contract — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-pin POS's generated `src/shared/api-types.ts` so it carries the deployed read-down contract (`/api/pos/v1/catalog/snapshot` + `/deltas`), replacing the stale pharmacy-era `/api/v1/pos/catalog/products` shape — enabling the (separate, later) #360/T039 live read-down client.

**Architecture:** POS generates `api-types.ts` deterministically from a single pinned OpenAPI JSON snapshot (`scripts/openapi-snapshot.json`) via `npm run codegen:api`, gated by `npm run codegen:verify`. We MERGE the read-down contract's 2 paths + 13 schemas into that snapshot, DROP the 2 stale catalogue paths, then regenerate. No codegen-runner change. The snapshot is the source; `api-types.ts` is never hand-edited.

**Tech Stack:** OpenAPI 3.1.0, `openapi-typescript` v7, Node, TypeScript (strict), Vitest.

**Source of truth:** DP-2 `packages/contracts/openapi/catalog/read-down.yaml` (read from WSL `~/projects/Data-Pulse-2`, on current `main`).

**Key facts established during scoping:**
- `api-types.ts` has 4 LIVE consumers (`src/main/pairing/network.ts`, `src/main/payments/voucher-authority/{redeem,reverse,validate}.ts`) → snapshot can't be replaced wholesale, only merged.
- Read-down schema names vs snapshot's 379: only **`Error` collides** — and read-down's `Error` is byte-identical in intent to the snapshot's ("used verbatim"). So: drop read-down's `Error`, repoint its refs at the snapshot's existing `#/components/schemas/Error`. The other 12 schemas are collision-free, merged as-is.
- Stale paths to drop: `/api/v1/pos/catalog/products`, `/api/v1/pos/catalog/stock`.
- 010 read-down unit tests depend on LOCAL types (`SellableCatalogRow` in `map-sellable-row.ts`, `ReadDownClient` interface), NOT `api-types.ts` — so they must stay green (a scope-held guard).

---

### Task 1: Capture baseline + the read-down source

**Files:**
- Read: `scripts/openapi-snapshot.json` (current pin)
- Read (WSL): `~/projects/Data-Pulse-2/packages/contracts/openapi/catalog/read-down.yaml`

- [ ] **Step 1: Confirm clean baseline + branch**

Run: `git checkout feat/349-repin-readdown-contract && git status --short`
Expected: on the branch; only the committed design doc, no stray changes.

- [ ] **Step 2: Snapshot the baseline facts (record for verification)**

Run:
```bash
node -e 'const s=JSON.parse(require("fs").readFileSync("scripts/openapi-snapshot.json","utf8")); console.log("paths",Object.keys(s.paths).length,"schemas",Object.keys(s.components.schemas).length); console.log("has products path", !!s.paths["/api/v1/pos/catalog/products"]); console.log("has snapshot path", !!s.paths["/api/pos/v1/catalog/snapshot"]);'
```
Expected: `paths 281 schemas 379`, `has products path true`, `has snapshot path false`.

- [ ] **Step 3: Fetch read-down.yaml into the repo workspace as JSON**

Read-down.yaml is YAML; the snapshot is JSON. Convert it to a temp JSON file the merge script will read. Use the project's existing YAML capability or `js-yaml` (already a transitive dep) via a one-shot:
```bash
# from WSL, copy the yaml into the POS repo tmp dir:
wsl -e bash -lc 'cp ~/projects/Data-Pulse-2/packages/contracts/openapi/catalog/read-down.yaml /mnt/c/Users/user/Documents/GitHub/POS-Pulse/scripts/.readdown-source.yaml'
ls -l scripts/.readdown-source.yaml
```
Expected: the file exists (~490 lines). (It is a TEMP input, removed in Task 5 — do not commit it.)

- [ ] **Step 4: Commit nothing yet** (no code change this task).

---

### Task 2: Write the merge as a small deterministic script (test-first)

We realize the merge as a reviewable, re-runnable script `scripts/merge-readdown-contract.ts` so the snapshot change is reproducible (not a hand-edit). It reads the current snapshot + the read-down YAML, applies the documented transform, and writes the new snapshot. TDD: test the transform's invariants first.

**Files:**
- Create: `scripts/merge-readdown-contract.ts`
- Test: `scripts/__tests__/merge-readdown-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mergeReadDown } from '../merge-readdown-contract.js';

const baseSnapshot = {
  openapi: '3.1.0',
  paths: {
    '/api/v1/pos/catalog/products': { get: { responses: {} } },
    '/api/v1/pos/catalog/stock': { get: { responses: {} } },
    '/api/pos/v1/operators/sign-in': { post: { responses: {} } },
  },
  components: { schemas: { Error: { type: 'object' }, ActiveShiftResponse: { type: 'object' } } },
};
const readDown = {
  openapi: '3.1.0',
  paths: {
    '/api/pos/v1/catalog/snapshot': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogSnapshotPage' } } } } } } },
    '/api/pos/v1/catalog/deltas': { get: { responses: {} } },
  },
  components: { schemas: {
    SellableCatalogRow: { type: 'object' },
    CatalogSnapshotPage: { type: 'object', properties: { err: { $ref: '#/components/schemas/Error' } } },
    Error: { type: 'object', description: 'dup' },
  } },
};

describe('mergeReadDown', () => {
  it('adds the two read-down paths and drops the two stale catalogue paths', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.paths['/api/pos/v1/catalog/snapshot']).toBeDefined();
    expect(out.paths['/api/pos/v1/catalog/deltas']).toBeDefined();
    expect(out.paths['/api/v1/pos/catalog/products']).toBeUndefined();
    expect(out.paths['/api/v1/pos/catalog/stock']).toBeUndefined();
  });

  it('keeps live-consumer paths + schemas untouched', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.paths['/api/pos/v1/operators/sign-in']).toBeDefined();
    expect(out.components.schemas.ActiveShiftResponse).toBeDefined();
  });

  it('merges the 12 collision-free read-down schemas', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.components.schemas.SellableCatalogRow).toBeDefined();
    expect(out.components.schemas.CatalogSnapshotPage).toBeDefined();
  });

  it('does NOT clobber the existing Error schema (drops read-down Error, repoints refs)', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    // existing Error preserved (no "dup" description from read-down)
    expect(out.components.schemas.Error.description).toBeUndefined();
    // read-down ref to Error still points at the canonical #/components/schemas/Error
    expect(out.components.schemas.CatalogSnapshotPage.properties.err.$ref).toBe('#/components/schemas/Error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/__tests__/merge-readdown-contract.test.ts`
Expected: FAIL — `mergeReadDown` not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * #349 — merge the DP-2 read-down contract into the pinned OpenAPI snapshot.
 *
 * Pure transform (snapshot, readDown) -> newSnapshot:
 *   1. Drop the stale catalogue paths.
 *   2. Add the read-down paths.
 *   3. Merge read-down schemas EXCEPT `Error` (collision; read-down's Error is
 *      the same canonical envelope used verbatim, so we keep the snapshot's and
 *      drop read-down's). Read-down `$ref`s to `#/components/schemas/Error`
 *      remain valid against the snapshot's existing Error — no rewrite needed
 *      since the ref string is identical.
 */
type OpenApiDoc = {
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
  [k: string]: unknown;
};

const STALE_PATHS = ['/api/v1/pos/catalog/products', '/api/v1/pos/catalog/stock'];
const SKIP_SCHEMAS = new Set(['Error']); // collides; identical canonical envelope

export function mergeReadDown(snapshot: OpenApiDoc, readDown: OpenApiDoc): OpenApiDoc {
  const paths = { ...snapshot.paths };
  for (const p of STALE_PATHS) delete paths[p];
  for (const [p, def] of Object.entries(readDown.paths)) paths[p] = def;

  const schemas = { ...snapshot.components.schemas };
  for (const [name, def] of Object.entries(readDown.components.schemas)) {
    if (SKIP_SCHEMAS.has(name)) continue;
    schemas[name] = def;
  }

  return { ...snapshot, paths, components: { ...snapshot.components, schemas } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/__tests__/merge-readdown-contract.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/merge-readdown-contract.ts scripts/__tests__/merge-readdown-contract.test.ts
git commit -m "feat(349): pure merge transform for read-down contract into snapshot"
```

---

### Task 3: Add the CLI driver to the merge script + apply it to the real snapshot

**Files:**
- Modify: `scripts/merge-readdown-contract.ts` (add a `main()` that reads files, parses YAML, writes the snapshot)
- Modify: `scripts/openapi-snapshot.json` (the real output)

- [ ] **Step 1: Add the file-IO `main()` to the script (below the pure `mergeReadDown`)**

```typescript
// --- CLI driver (runs only when invoked directly) ---
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const SNAPSHOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'openapi-snapshot.json');
const RD_YAML = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.readdown-source.yaml');

function main(): void {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as OpenApiDoc;
  const readDown = yaml.load(readFileSync(RD_YAML, 'utf8')) as OpenApiDoc;
  const merged = mergeReadDown(snapshot, readDown);
  // Deterministic: 2-space JSON, trailing newline (matches the existing snapshot format).
  writeFileSync(SNAPSHOT, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log('[merge-readdown] snapshot updated');
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedAsScript) main();
```

Note: confirm the existing snapshot's JSON formatting first (`head -c 200 scripts/openapi-snapshot.json`) — it is currently single-line (1 line, 514KB). If single-line, match it: use `JSON.stringify(merged)` (no pretty-print) + `'\n'` to keep the diff style consistent. **Pick whichever matches the committed file and note it here before running.**

- [ ] **Step 2: Run the merge against the real snapshot**

Run: `npx tsx scripts/merge-readdown-contract.ts`
Expected: `[merge-readdown] snapshot updated`.

- [ ] **Step 3: Verify the snapshot transformed correctly**

Run:
```bash
node -e 'const s=JSON.parse(require("fs").readFileSync("scripts/openapi-snapshot.json","utf8")); console.log("snapshot path", !!s.paths["/api/pos/v1/catalog/snapshot"], "| deltas", !!s.paths["/api/pos/v1/catalog/deltas"], "| products GONE", !s.paths["/api/v1/pos/catalog/products"], "| SellableCatalogRow", !!s.components.schemas.SellableCatalogRow, "| Error kept", !!s.components.schemas.Error, "| live ActiveShiftResponse kept", !!s.components.schemas.ActiveShiftResponse);'
```
Expected: `snapshot path true | deltas true | products GONE true | SellableCatalogRow true | Error kept true | live ActiveShiftResponse kept true`.

- [ ] **Step 4: Commit the merged snapshot**

```bash
git add scripts/merge-readdown-contract.ts scripts/openapi-snapshot.json
git commit -m "feat(349): merge read-down contract into pinned snapshot; drop stale catalogue paths"
```

---

### Task 4: Regenerate api-types.ts + verify determinism + typecheck

**Files:**
- Modify: `src/shared/api-types.ts` (regenerated output)

- [ ] **Step 1: Regenerate the types from the merged snapshot**

Run: `npm run codegen:api`
Expected: `[codegen-api] generating src/shared/api-types.ts from source=local` … `done.`

- [ ] **Step 2: Confirm the read-down types are present + stale gone**

Run:
```bash
grep -c "/api/pos/v1/catalog/snapshot" src/shared/api-types.ts
grep -c "/api/pos/v1/catalog/deltas" src/shared/api-types.ts
grep -c "SellableCatalogRow" src/shared/api-types.ts
grep -c "/api/v1/pos/catalog/products" src/shared/api-types.ts
```
Expected: snapshot ≥1, deltas ≥1, SellableCatalogRow ≥1, products **0**.

- [ ] **Step 3: Verify determinism gate**

Run: `npm run codegen:verify`
Expected: exit 0 — "committed file equals fresh codegen". (If it drifts, the committed `api-types.ts` was not regenerated from the committed snapshot — re-run Step 1 and re-commit.)

- [ ] **Step 4: Typecheck — the 4 live consumers must still compile, read-down types resolvable**

Run: `npm run typecheck`
Expected: PASS, no errors. (If `pairing/network.ts` or `voucher-authority/*` error, a needed schema was dropped — STOP, that schema must be kept in Task 3's merge.)

- [ ] **Step 5: Commit the regenerated types**

```bash
git add src/shared/api-types.ts
git commit -m "feat(349): regenerate api-types.ts from re-pinned read-down snapshot"
```

---

### Task 5: Full verification + cleanup

**Files:**
- Delete: `scripts/.readdown-source.yaml` (temp input)

- [ ] **Step 1: Remove the temp YAML input (must NOT be committed)**

Run: `rm -f scripts/.readdown-source.yaml && git status --short`
Expected: no `.readdown-source.yaml` anywhere; only the intended changes staged/committed.

- [ ] **Step 2: Confirm 010 read-down unit tests still green (scope-held guard)**

Run: `npx vitest run src/main/catalogue/read-down`
Expected: all pass — they depend on local `SellableCatalogRow`/`ReadDownClient`, not `api-types.ts`, so re-pinning must not disturb them.

- [ ] **Step 3: Lint + full unit suite**

Run: `npm run lint && npm test -- --run`
Expected: lint clean; full suite green (no regressions from the type change).

- [ ] **Step 4: Final grep proof (the #349 acceptance criteria)**

Run:
```bash
grep -q "/api/pos/v1/catalog/snapshot" src/shared/api-types.ts && grep -q "/api/pos/v1/catalog/deltas" src/shared/api-types.ts && ! grep -q "/api/v1/pos/catalog/products" src/shared/api-types.ts && echo "[349 ACCEPTANCE MET]"
```
Expected: `[349 ACCEPTANCE MET]`.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feat/349-repin-readdown-contract
gh pr create --base main --title "feat(349): re-pin api-types.ts to deployed read-down contract" --body "Closes the codegen half of #349. Merges DP-2 read-down.yaml (/api/pos/v1/catalog/snapshot + /deltas) into the pinned snapshot, drops the stale /api/v1/pos/catalog/products + /stock paths, regenerates api-types.ts. Live consumers (pairing + voucher-authority) unaffected; 010 read-down tests green. #360/T039 (live client + driver) is the next separate effort. Design: docs/superpowers/specs/2026-06-15-349-repin-readdown-contract-design.md"
```

---

## Notes for the implementer

- **Do NOT hand-edit `src/shared/api-types.ts`** — it's autogenerated (header sentinel). Only edit the snapshot + regenerate.
- **The single `Error` collision is the one real hazard.** Read-down's `Error` is the same canonical envelope ("used verbatim"), so we keep the snapshot's and skip read-down's; read-down `$ref: '#/components/schemas/Error'` stays valid because the ref string is identical. If a future contract's colliding schema is NOT identical, namespace it instead.
- **Snapshot formatting:** the committed snapshot is currently single-line minified JSON. Match that exact style in Task 3 Step 1 so the diff is the content change, not a reformat. Verify with `head -c 100 scripts/openapi-snapshot.json` before writing.
- **If typecheck fails on a dropped schema:** the stale `/catalog/products` or `/stock` path's schemas were referenced by a live consumer after all — keep that schema in the merge (only the PATHS need dropping, not necessarily every schema).
