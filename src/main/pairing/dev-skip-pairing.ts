import type { PairingStore } from './store.js';

/**
 * 002-terminal-pairing dev fixture — boot-time pairing bypass for local
 * development without a live SmartDataPulse backend.
 *
 * Activated ONLY when ALL of the following hold:
 *   1. `isPackaged === false`  (Electron dev build / CI)
 *   2. `POS_PULSE_DEV_SKIP_PAIRING` is truthy in the environment
 *
 * When active, the store is pre-seeded with fixture pairing state so the
 * renderer routes past the pairing screen on first load.  No backend
 * network call is made and no real device token is used or logged.
 *
 * SECURITY:
 *   - `isPackaged === true` short-circuits unconditionally — the env var is
 *     never consulted in a packaged build, so this cannot be activated in
 *     production by exporting the variable.
 *   - The device_token written here is an obviously fake placeholder string
 *     and is NEVER included in any log payload.
 *   - The renderer-visible `PairingStatus` shape carries no token field by
 *     design (`store.getStatus()` returns a `PairingStatus`, which omits
 *     `device_token`) — this bypass does not change that invariant.
 *   - This module MUST NOT be imported or called from any production path
 *     other than the single call site in `src/main/index.ts`.
 */

export const DEV_BYPASS_FIXTURE_TOKEN = 'DEV-BYPASS-NOT-A-REAL-TOKEN';

/** Fixture values written to the store when the bypass runs. */
export const DEV_BYPASS_FIXTURE_ASSIGNMENT = {
  tenant_id: 'dev-tenant',
  branch_id: 'dev-branch',
  terminal_id: 'dev-terminal',
  terminal_label: 'Dev Terminal',
} as const;

export interface DevSkipPairingDeps {
  /** `app.isPackaged` from Electron. Bypass runs ONLY when this is false. */
  isPackaged: boolean;
  env: NodeJS.ProcessEnv;
  pairingStore: Pick<PairingStore, 'persist'>;
  logger: { warn(payload: object, msg: string): void };
  /** Injected for test determinism; defaults to `() => new Date()`. */
  clock?: () => Date;
}

/**
 * Truthy-value list shared across all POS-Pulse dev env flags.
 */
function isTruthy(value: string | undefined): boolean {
  return (
    typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
  );
}

/**
 * If the bypass is enabled (unpackaged + env flag truthy), seeds the
 * pairing store with fixture data and returns `true`. Otherwise no-ops
 * and returns `false`.
 *
 * Returning a boolean lets the call site in `index.ts` log or branch
 * without coupling the helper to the top-level logger type.
 */
export async function applyDevSkipPairingIfRequested(deps: DevSkipPairingDeps): Promise<boolean> {
  if (deps.isPackaged) return false;
  if (!isTruthy(deps.env['POS_PULSE_DEV_SKIP_PAIRING'])) return false;

  const clock = deps.clock ?? (() => new Date());

  // Log BEFORE persist so a crash in persist still leaves a trace.
  // The payload is intentionally restricted to non-sensitive fields:
  //   event, packaged, flag — no token, no assignment values.
  deps.logger.warn(
    {
      event: 'pairing.dev_bypass.active',
      packaged: false,
      flag: 'POS_PULSE_DEV_SKIP_PAIRING',
    },
    'DEV BYPASS: auto-pairing with fixture data. Never enable in a packaged build.',
  );

  await deps.pairingStore.persist({
    device_token: DEV_BYPASS_FIXTURE_TOKEN,
    ...DEV_BYPASS_FIXTURE_ASSIGNMENT,
    paired_at: Math.floor(clock().getTime() / 1000),
  });

  return true;
}
