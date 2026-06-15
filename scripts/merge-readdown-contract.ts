/**
 * #349 — merge the DP-2 read-down contract into the pinned OpenAPI snapshot.
 *
 * Pure transform (snapshot, readDown) -> newSnapshot:
 *   1. Drop the stale catalogue paths (/api/v1/pos/catalog/products + /stock) —
 *      the wrong-domain pharmacy-era surface, served by nothing (404 on preprod).
 *   2. Add the read-down paths (/api/pos/v1/catalog/snapshot + /deltas).
 *   3. Merge read-down's component schemas EXCEPT `Error`: it collides with the
 *      snapshot's existing `Error`, and read-down's `Error` is the SAME canonical
 *      error envelope ("used verbatim" per read-down.yaml), so we keep the
 *      snapshot's and skip read-down's. Read-down `$ref: '#/components/schemas/Error'`
 *      stays valid against the kept schema — the ref string is identical, so no
 *      rewrite is needed.
 *
 * The CLI driver (main, below) reads scripts/openapi-snapshot.json +
 * scripts/.readdown-source.yaml and writes the merged snapshot back. The pure
 * transform is exported for unit testing.
 */

export interface OpenApiDoc {
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
  [k: string]: unknown;
}

/** Stale pharmacy-era catalogue paths replaced by the read-down surface. */
const STALE_PATHS = ['/api/v1/pos/catalog/products', '/api/v1/pos/catalog/stock'];

/** Read-down schemas that collide with the snapshot and are dropped (identical canonical envelope). */
const SKIP_SCHEMAS = new Set<string>(['Error']);

/**
 * Merge the read-down contract into the snapshot. Pure — does not mutate inputs.
 */
export function mergeReadDown(snapshot: OpenApiDoc, readDown: OpenApiDoc): OpenApiDoc {
  const paths: Record<string, unknown> = { ...snapshot.paths };
  for (const p of STALE_PATHS) delete paths[p];
  for (const [p, def] of Object.entries(readDown.paths)) paths[p] = def;

  const schemas: Record<string, unknown> = { ...snapshot.components.schemas };
  for (const [name, def] of Object.entries(readDown.components.schemas)) {
    if (SKIP_SCHEMAS.has(name)) continue;
    schemas[name] = def;
  }

  return {
    ...snapshot,
    paths,
    components: { ...snapshot.components, schemas },
  };
}
