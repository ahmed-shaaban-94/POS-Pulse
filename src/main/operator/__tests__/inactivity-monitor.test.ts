import { describe, expect, it } from 'vitest';

import { InactivityMonitor } from '../inactivity-monitor.js';
import { SessionManager } from '../session-manager.js';

/**
 * 004-operator-session T028a — inactivity monitor (FR-009).
 *
 * 15-minute timer. Resets on genuine input (mouse / keypress / touch
 * — modelled here as `reportActivity()` calls). NOT reset by
 * background activity (we do not call `reportActivity` for that).
 */

const MIN = 60 * 1000;

function makeMonitor(opts: { initialNow: number }): {
  monitor: InactivityMonitor;
  sm: SessionManager;
  setNow: (next: number) => void;
} {
  let now = opts.initialNow;
  const sm = new SessionManager();
  const monitor = new InactivityMonitor({
    sessionManager: sm,
    thresholdMs: 15 * MIN,
    tickMs: MIN,
    now: () => now,
    // Test-only: never schedule a real timer.
    setInterval: () => 0 as unknown as NodeJS.Timeout,
    clearInterval: () => undefined,
  });
  return {
    monitor,
    sm,
    setNow: (next) => {
      now = next;
    },
  };
}

describe('InactivityMonitor (T028a — FR-009)', () => {
  it('does nothing when no session is active', () => {
    const { monitor, sm } = makeMonitor({ initialNow: Date.parse('2026-05-06T00:00:00.000Z') });
    monitor.tick();
    expect(sm.getCurrent()).toBeNull();
  });

  it('terminates the session after 15 minutes of no activity', () => {
    const t0 = Date.parse('2026-05-06T00:00:00.000Z');
    const { monitor, sm, setNow } = makeMonitor({ initialNow: t0 });
    sm.create({
      operator_id: 'op-1',
      display_name: 'Manager',
      role: 'manager',
      tenant_id: 't1',
      branch_id: 'b1',
      backend_session_id: 'be-1',
      started_at: new Date(t0).toISOString(),
    });

    // 14 min later — still active.
    setNow(t0 + 14 * MIN);
    monitor.tick();
    expect(sm.getCurrent()).not.toBeNull();

    // 15 min later — terminated.
    setNow(t0 + 15 * MIN);
    monitor.tick();
    expect(sm.getCurrent()).toBeNull();
  });

  it('reportActivity resets the inactivity countdown', () => {
    const t0 = Date.parse('2026-05-06T00:00:00.000Z');
    const { monitor, sm, setNow } = makeMonitor({ initialNow: t0 });
    sm.create({
      operator_id: 'op-1',
      display_name: 'Manager',
      role: 'manager',
      tenant_id: 't1',
      branch_id: 'b1',
      backend_session_id: 'be-1',
      started_at: new Date(t0).toISOString(),
    });

    // 14 min in — operator types something.
    setNow(t0 + 14 * MIN);
    monitor.reportActivity(new Date(t0 + 14 * MIN).toISOString());

    // 28 min from t0 (only 14 min from last activity) — still active.
    setNow(t0 + 28 * MIN);
    monitor.tick();
    expect(sm.getCurrent()).not.toBeNull();

    // 29 min from t0 (15 min from last activity) — terminated.
    setNow(t0 + 29 * MIN);
    monitor.tick();
    expect(sm.getCurrent()).toBeNull();
  });

  it('reportActivity is a no-op when no session is active', () => {
    const { monitor, sm } = makeMonitor({ initialNow: 0 });
    monitor.reportActivity();
    expect(sm.getCurrent()).toBeNull();
  });

  it('start/stop manage the timer handle (no-op when called twice)', () => {
    let scheduled = 0;
    let cleared = 0;
    const sm = new SessionManager();
    const m = new InactivityMonitor({
      sessionManager: sm,
      setInterval: () => {
        scheduled += 1;
        return scheduled as unknown as NodeJS.Timeout;
      },
      clearInterval: () => {
        cleared += 1;
      },
    });
    m.start();
    m.start(); // idempotent
    m.stop();
    m.stop(); // idempotent
    expect(scheduled).toBe(1);
    expect(cleared).toBe(1);
  });
});
