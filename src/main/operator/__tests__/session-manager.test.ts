import { describe, expect, it } from 'vitest';

import { SessionManager } from '../session-manager.js';

/**
 * 004-operator-session T028 — session manager (in-memory).
 */

const FIXED_NOW = '2026-05-06T00:00:00.000Z';

function makeManager(): SessionManager {
  return new SessionManager();
}

describe('SessionManager', () => {
  it('starts with no current session', () => {
    expect(makeManager().getCurrent()).toBeNull();
  });

  it('create() sets a new session and getCurrent returns it', () => {
    const m = makeManager();
    const record = m.create({
      operator_id: 'op-1',
      display_name: 'Manager',
      role: 'manager',
      tenant_id: 't1',
      branch_id: 'b1',
      backend_session_id: 'be-1',
      started_at: FIXED_NOW,
    });
    expect(record.operator_id).toBe('op-1');
    expect(m.getCurrent()).toBe(record);
  });

  it('getCurrentBridgeView strips backend_session_id and last_activity_at', () => {
    const m = makeManager();
    m.create({
      operator_id: 'op-1',
      display_name: 'Manager',
      role: 'manager',
      tenant_id: 't1',
      branch_id: 'b1',
      backend_session_id: 'be-1',
      started_at: FIXED_NOW,
    });
    const view = m.getCurrentBridgeView();
    expect(view).not.toBeNull();
    expect(view).not.toHaveProperty('backend_session_id');
    expect(view).not.toHaveProperty('last_activity_at');
    expect(view?.operator_id).toBe('op-1');
  });

  it('end() clears the current session and returns the prior record', () => {
    const m = makeManager();
    m.create({
      operator_id: 'op-1',
      display_name: 'Manager',
      role: 'manager',
      tenant_id: 't1',
      branch_id: 'b1',
      backend_session_id: 'be-1',
    });
    const ended = m.end();
    expect(ended?.operator_id).toBe('op-1');
    expect(m.getCurrent()).toBeNull();
    expect(m.getCurrentBridgeView()).toBeNull();
    // Idempotent: ending again is a no-op.
    expect(m.end()).toBeNull();
  });

  it('noteActivity updates last_activity_at on the current record', () => {
    const m = makeManager();
    m.create({
      operator_id: 'op-1',
      display_name: 'Manager',
      role: 'manager',
      tenant_id: 't1',
      branch_id: 'b1',
      backend_session_id: 'be-1',
      started_at: FIXED_NOW,
    });
    const newer = '2026-05-06T00:05:00.000Z';
    m.noteActivity(newer);
    expect(m.getCurrent()?.last_activity_at).toBe(newer);
  });

  it('noteActivity is a no-op when no session is active', () => {
    const m = makeManager();
    expect(() => {
      m.noteActivity(FIXED_NOW);
    }).not.toThrow();
    expect(m.getCurrent()).toBeNull();
  });
});
