import type { Logger } from 'pino';

import { CartBridgeHandlers } from './cart-bridge.js';
import { bindCartStore } from './cart-store.js';
import { resolveItemRef as fixtureResolver } from './resolve-item-ref.js';
import type { DatabaseHandle } from '../db/client.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import type { OperatorSessionRecord } from '../operator/session-manager.js';

export interface CartHandlersDeps {
  dbHandle: DatabaseHandle;
  getCurrentSession: () => OperatorSessionRecord | null;
  logger: Logger;
  auditEmitter: AuditEmitter;
  /**
   * `app.isPackaged` from Electron.  Must be `true` in production builds.
   * When `true`, the dev fixture resolver is unconditionally skipped even if
   * `POS_PULSE_DEV_ITEM_RESOLVER` is set in the environment.
   */
  isPackaged: boolean;
}

/**
 * Returns `true` only when the `POS_PULSE_DEV_ITEM_RESOLVER` env variable
 * is explicitly set to a truthy value.  Mirrors the truthy-value list used
 * by the T001 cart feature flag so operator behaviour is consistent.
 */
function isDevResolverEnvSet(): boolean {
  const raw = process.env['POS_PULSE_DEV_ITEM_RESOLVER'];
  return typeof raw === 'string' && ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/**
 * Production factory for `CartBridgeHandlers`.
 *
 * Wires the DB-backed `CartStore` from `dbHandle`.
 *
 * `resolveItemRef` is wired to the T053 fixture resolver ONLY when both
 * conditions hold:
 *   1. `deps.isPackaged` is `false` (dev / CI build), AND
 *   2. `POS_PULSE_DEV_ITEM_RESOLVER` is truthy in the environment.
 *
 * In all other cases (any packaged build, or env flag absent/falsy) the dep
 * is omitted and `CartBridgeHandlers` falls back to `DEFAULT_ITEM_REF_RESOLVER`
 * which refuses generically — the correct production behaviour until the real
 * item-catalogue feature ships (R7 seam / future feature).
 *
 * SECURITY: `deps.isPackaged === true` short-circuits unconditionally; ops
 * cannot enable fixture data in a packaged build by exporting the env var.
 */
export function createCartBridgeHandlers(deps: CartHandlersDeps): CartBridgeHandlers {
  const useFixtureResolver = !deps.isPackaged && isDevResolverEnvSet();

  const baseDeps = {
    getCurrentSession: deps.getCurrentSession,
    cartStore: bindCartStore(deps.dbHandle),
    logger: deps.logger,
    auditEmitter: deps.auditEmitter,
  };

  return new CartBridgeHandlers(
    useFixtureResolver ? { ...baseDeps, resolveItemRef: fixtureResolver } : baseDeps,
  );
}
