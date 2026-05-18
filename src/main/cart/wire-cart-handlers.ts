import type { Logger } from 'pino';

import { CartBridgeHandlers } from './cart-bridge.js';
import { bindCartStore } from './cart-store.js';
import type { DatabaseHandle } from '../db/client.js';
import type { AuditEmitter } from '../audit/audit-emitter.js';
import type { OperatorSessionRecord } from '../operator/session-manager.js';

export interface CartHandlersDeps {
  dbHandle: DatabaseHandle;
  getCurrentSession: () => OperatorSessionRecord | null;
  logger: Logger;
  auditEmitter: AuditEmitter;
}

/**
 * Production factory for `CartBridgeHandlers`.
 *
 * Wires the DB-backed `CartStore` from `dbHandle`.
 * `resolveItemRef` is intentionally omitted — the default refusing stub
 * in `cart-bridge.ts` is the correct production fallback until the
 * item-catalogue feature ships (T053 / R7).
 */
export function createCartBridgeHandlers(deps: CartHandlersDeps): CartBridgeHandlers {
  return new CartBridgeHandlers({
    getCurrentSession: deps.getCurrentSession,
    cartStore: bindCartStore(deps.dbHandle),
    logger: deps.logger,
    auditEmitter: deps.auditEmitter,
  });
}
