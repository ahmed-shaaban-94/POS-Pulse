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

  // #380 (F-007 part b) — onStarted is the symmetric counterpart of onEnded.
  // It is the single seam the cashier-PIN + manager/admin sign-in paths both
  // funnel through (both call create()), so the orphan-attempt sweep registered
  // here covers every sign-in role without per-handler wiring.
  describe('#380 onStarted — fires on session create', () => {
    it('invokes registered callbacks with the new record on create()', () => {
      const m = makeManager();
      const seen: string[] = [];
      m.onStarted((record) => seen.push(record.operator_id));
      m.create({
        operator_id: 'op-start',
        display_name: 'Manager',
        role: 'manager',
        tenant_id: 't1',
        branch_id: 'b1',
        backend_session_id: 'be-1',
        started_at: FIXED_NOW,
      });
      expect(seen).toEqual(['op-start']);
    });

    it('fires every registered callback in order', () => {
      const m = makeManager();
      const order: number[] = [];
      m.onStarted(() => order.push(1));
      m.onStarted(() => order.push(2));
      m.create({
        operator_id: 'op-1',
        display_name: 'M',
        role: 'manager',
        tenant_id: 't1',
        branch_id: 'b1',
        backend_session_id: 'be-1',
        started_at: FIXED_NOW,
      });
      expect(order).toEqual([1, 2]);
    });

    it('a throwing subscriber does not break create() (mirrors onEnded)', () => {
      const m = makeManager();
      m.onStarted(() => {
        throw new Error('subscriber boom');
      });
      let record;
      expect(() => {
        record = m.create({
          operator_id: 'op-1',
          display_name: 'M',
          role: 'manager',
          tenant_id: 't1',
          branch_id: 'b1',
          backend_session_id: 'be-1',
          started_at: FIXED_NOW,
        });
      }).not.toThrow();
      expect(record).toBeDefined();
      expect(m.getCurrent()).not.toBeNull();
    });
  });
});
