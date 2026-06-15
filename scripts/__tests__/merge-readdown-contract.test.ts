import { describe, it, expect } from 'vitest';

import { mergeReadDown } from '../merge-readdown-contract.js';

const baseSnapshot = {
  openapi: '3.1.0',
  paths: {
    '/api/v1/pos/catalog/products': { get: { responses: {} } },
    '/api/v1/pos/catalog/stock': { get: { responses: {} } },
    '/api/pos/v1/operators/sign-in': { post: { responses: {} } },
  },
  components: {
    schemas: { Error: { type: 'object' }, ActiveShiftResponse: { type: 'object' } },
    parameters: { ExistingParam: { name: 'x', in: 'query' } },
    responses: { ExistingResponse: { description: 'kept' } },
    securitySchemes: { clerkJwt: { type: 'http', scheme: 'bearer' } },
  },
};

const readDown = {
  openapi: '3.1.0',
  paths: {
    '/api/pos/v1/catalog/snapshot': {
      get: {
        parameters: [{ $ref: '#/components/parameters/BranchId' }],
        responses: {
          '200': {
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CatalogSnapshotPage' } },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/pos/v1/catalog/deltas': { get: { responses: {} } },
  },
  components: {
    schemas: {
      SellableCatalogRow: { type: 'object' },
      CatalogSnapshotPage: {
        type: 'object',
        properties: { err: { $ref: '#/components/schemas/Error' } },
      },
      Error: { type: 'object', description: 'dup' },
    },
    parameters: { BranchId: { name: 'branch_id', in: 'query' }, Limit: { name: 'limit', in: 'query' } },
    responses: { Unauthorized: { description: 'unauth' }, NotFound: { description: 'nf' } },
    securitySchemes: { device: { type: 'http', scheme: 'bearer' } },
  },
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

  it('merges the collision-free read-down schemas', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.components.schemas.SellableCatalogRow).toBeDefined();
    expect(out.components.schemas.CatalogSnapshotPage).toBeDefined();
  });

  it('does NOT clobber the existing Error schema (drops read-down Error, ref stays valid)', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    // Existing Error preserved — no "dup" description from read-down's Error.
    expect((out.components.schemas.Error as { description?: string }).description).toBeUndefined();
    // Read-down ref to Error still points at the canonical schema (string unchanged).
    expect(
      (out.components.schemas.CatalogSnapshotPage as { properties: { err: { $ref: string } } })
        .properties.err.$ref,
    ).toBe('#/components/schemas/Error');
  });

  it('merges read-down components.parameters (paths $ref them — must not dangle)', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.components.parameters?.BranchId).toBeDefined();
    expect(out.components.parameters?.Limit).toBeDefined();
    // existing parameters preserved
    expect(out.components.parameters?.ExistingParam).toBeDefined();
  });

  it('merges read-down components.responses (paths $ref them — must not dangle)', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.components.responses?.Unauthorized).toBeDefined();
    expect(out.components.responses?.NotFound).toBeDefined();
    // existing responses preserved
    expect(out.components.responses?.ExistingResponse).toBeDefined();
  });

  it('merges read-down securitySchemes without clobbering existing ones', () => {
    const out = mergeReadDown(baseSnapshot, readDown);
    expect(out.components.securitySchemes?.device).toBeDefined();
    expect(out.components.securitySchemes?.clerkJwt).toBeDefined();
  });
});
