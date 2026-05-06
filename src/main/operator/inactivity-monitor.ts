import type { Logger } from 'pino';

import type { SessionManager } from './session-manager.js';

/**
 * 004-operator-session T028b — inactivity monitor (FR-009).
 *
 * After 15 minutes of no GENUINE renderer-side input (mouse-move,
 * keypress, touch — explicitly NOT background activity, network
 * heartbeats, or focus changes that aren't user-driven), the active
 * operator session terminates with `end_cause = 'inactivity_timeout'`.
 *
 * S1 wires the timer + the `_reportActivity` notify-only bridge call
 * but does not yet emit the `end_cause` audit event (the audit-emitter
 * lands in S3). The local session is ended; the renderer receives no
 * direct termination signal — it discovers the change on the next
 * `getCurrentSession()` call (which returns null) and the route guard
 * redirects to `/sign-in`.
 *
 * Threshold is configurable per Spec A3; default 15 min.
 */

export interface InactivityMonitorDeps {
  sessionManager: SessionManager;
  /** Threshold in milliseconds. Defaults to 15 minutes. */
  thresholdMs?: number;
  /** Tick cadence in milliseconds. Defaults to 60 s. */
  tickMs?: number;
  /** Test-only override for the wall clock. */
  now?: () => number;
  /** Test-only override for the timer. */
  setInterval?: (fn: () => void, ms: number) => NodeJS.Timeout;
  clearInterval?: (handle: NodeJS.Timeout) => void;
  logger?: Logger;
}

const DEFAULT_THRESHOLD_MS = 15 * 60 * 1000;
const DEFAULT_TICK_MS = 60 * 1000;

export class InactivityMonitor {
  private readonly thresholdMs: number;
  private readonly tickMs: number;
  private readonly now: () => number;
  private readonly setIntervalFn: (fn: () => void, ms: number) => NodeJS.Timeout;
  private readonly clearIntervalFn: (handle: NodeJS.Timeout) => void;
  private handle: NodeJS.Timeout | null = null;

  constructor(private readonly deps: InactivityMonitorDeps) {
    this.thresholdMs = deps.thresholdMs ?? DEFAULT_THRESHOLD_MS;
    this.tickMs = deps.tickMs ?? DEFAULT_TICK_MS;
    this.now = deps.now ?? Date.now;
    this.setIntervalFn = deps.setInterval ?? globalThis.setInterval;
    this.clearIntervalFn = deps.clearInterval ?? globalThis.clearInterval;
  }

  start(): void {
    if (this.handle !== null) return;
    this.handle = this.setIntervalFn(() => {
      this.tick();
    }, this.tickMs);
  }

  stop(): void {
    if (this.handle === null) return;
    this.clearIntervalFn(this.handle);
    this.handle = null;
  }

  /**
   * Called from the bridge when the renderer reports genuine user
   * input. The renderer subscribes to mousemove / keypress / touch
   * and forwards a single throttled signal across the existing
   * `operator.*` namespace (no new IPC channel).
   */
  reportActivity(at: string = new Date(this.now()).toISOString()): void {
    this.deps.sessionManager.noteActivity(at);
  }

  /** Test hook — invokes the timer logic synchronously. */
  tick(): void {
    const current = this.deps.sessionManager.getCurrent();
    if (current === null) return;
    const last = Date.parse(current.last_activity_at);
    if (Number.isNaN(last)) return;
    if (this.now() - last >= this.thresholdMs) {
      this.deps.sessionManager.end();
      this.deps.logger?.info(
        { event: 'operator.session.inactivity_timeout' },
        'session ended on inactivity timeout',
      );
    }
  }
}
