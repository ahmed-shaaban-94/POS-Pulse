import { describe, it, expect, vi } from 'vitest';
import { CheckActiveSessionHandler } from '../../../../src/main/operator/check-active-session.js';
import type {
  BackendClient,
  BackendActiveSessionResponse,
} from '../../../../src/main/operator/backend-client.js';

function fakeBackend(
  result: BackendActiveSessionResponse,
  calls: { operatorId?: string }[] = [],
): BackendClient {
  return {
    signIn: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    signOut: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    listRoster: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    confirmTakeover: vi.fn(() => Promise.resolve({ kind: 'refused' as const })),
    getActiveSession: vi.fn((operatorId: string) => {
      calls.push({ operatorId });
      return Promise.resolve(result);
    }),
  };
}

describe('CheckActiveSessionHandler', () => {
  it('returns { kind: "none" } when backend reports none', async () => {
    const handler = new CheckActiveSessionHandler({ backend: fakeBackend({ kind: 'none' }) });
    const result = await handler.checkActiveSession('op-123');
    expect(result).toEqual({ kind: 'none' });
  });

  it('returns { kind: "active" } when backend reports active', async () => {
    const handler = new CheckActiveSessionHandler({ backend: fakeBackend({ kind: 'active' }) });
    const result = await handler.checkActiveSession('op-123');
    expect(result).toEqual({ kind: 'active' });
  });

  it('returns refused/no_connection when backend reports no_connection', async () => {
    const handler = new CheckActiveSessionHandler({
      backend: fakeBackend({ kind: 'no_connection' }),
    });
    const result = await handler.checkActiveSession('op-123');
    expect(result).toEqual({ kind: 'refused', category: 'no_connection' });
  });

  it('returns refused/invalid_input when backend reports refused (4xx)', async () => {
    const handler = new CheckActiveSessionHandler({ backend: fakeBackend({ kind: 'refused' }) });
    const result = await handler.checkActiveSession('op-123');
    expect(result).toEqual({ kind: 'refused', category: 'invalid_input' });
  });

  it('forwards operatorId verbatim to backend.getActiveSession', async () => {
    const calls: { operatorId?: string }[] = [];
    const handler = new CheckActiveSessionHandler({
      backend: fakeBackend({ kind: 'none' }, calls),
    });
    await handler.checkActiveSession('op-abc-999');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.operatorId).toBe('op-abc-999');
  });

  it('returns refused/invalid_input for empty operatorId without calling backend', async () => {
    const calls: { operatorId?: string }[] = [];
    const handler = new CheckActiveSessionHandler({
      backend: fakeBackend({ kind: 'none' }, calls),
    });
    const result = await handler.checkActiveSession('');
    expect(result).toEqual({ kind: 'refused', category: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('response shape contains only kind (none case) — minimum disclosure', async () => {
    const handler = new CheckActiveSessionHandler({ backend: fakeBackend({ kind: 'none' }) });
    const result = await handler.checkActiveSession('op-123');
    expect(Object.keys(result)).toEqual(['kind']);
  });

  it('response shape contains only kind (active case) — minimum disclosure', async () => {
    const handler = new CheckActiveSessionHandler({ backend: fakeBackend({ kind: 'active' }) });
    const result = await handler.checkActiveSession('op-123');
    expect(Object.keys(result)).toEqual(['kind']);
  });

  it('refusal shape contains exactly kind + category (no_connection case)', async () => {
    const handler = new CheckActiveSessionHandler({
      backend: fakeBackend({ kind: 'no_connection' }),
    });
    const result = await handler.checkActiveSession('op-123');
    expect(Object.keys(result).sort()).toEqual(['category', 'kind']);
  });

  it('refusal shape contains exactly kind + category (invalid_input case)', async () => {
    const handler = new CheckActiveSessionHandler({ backend: fakeBackend({ kind: 'refused' }) });
    const result = await handler.checkActiveSession('op-123');
    expect(Object.keys(result).sort()).toEqual(['category', 'kind']);
  });
});
