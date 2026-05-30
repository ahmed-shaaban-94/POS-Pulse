import type { Role } from '../../shared/operator/role.js';
import type { CatalogueRefusalReason } from '../../shared/bridge-api.js';

/**
 * 009-product-search-and-barcode-lookup T015 — `catalogue.*` session gate.
 *
 * The first executable step of every `catalogue.*` handler (AD-1 / NFR-6a):
 * the renderer↔main trust boundary for product lookup. There is NO role gate
 * beyond an active session — cashier, manager, and admin all look up products
 * (NFR-6a). Refusals are generic (the `reason` is for diagnostic logging only,
 * never echoed to the cashier verbatim).
 *
 * Returns a discriminated union — it NEVER throws. Callers check
 * `result.kind === 'refused'` and propagate the refusal as-is. Mirrors the
 * cart/sales bridge-gate discipline (005/008).
 */

/**
 * Minimal session projection the catalogue gate needs. The full
 * `OperatorSessionRecord` lives in `operator/session-manager.ts`; this is the
 * tenant/branch/identity subset every lookup gates on (mirrors 008's
 * `OperatorSessionForSales`).
 */
export interface OperatorSessionForCatalogue {
  readonly role: Role;
  readonly operator_id: string;
  readonly operator_session_id: string;
  readonly tenant_id: string;
  readonly branch_id: string;
}

export type RequireCatalogueSessionResult =
  | { readonly kind: 'ok'; readonly session: OperatorSessionForCatalogue }
  | { readonly kind: 'refused'; readonly reason: CatalogueRefusalReason };

/**
 * Gate a `catalogue.*` operation on an active session, and (when a resource
 * tenant is known) on tenant isolation (P17).
 *
 * @param session            the current operator session, or null if none
 * @param resourceTenantId   the tenant of the product row a query resolved to,
 *                           when known. Omitted at the bridge-skeleton stage
 *                           (S1, no read model); supplied by the repo layer at
 *                           S2 so a tenant-A product never resolves for a
 *                           tenant-B session.
 */
export function requireCatalogueSession(
  session: OperatorSessionForCatalogue | null,
  resourceTenantId?: string,
): RequireCatalogueSessionResult {
  if (session === null) {
    return { kind: 'refused', reason: 'no_session' };
  }
  if (resourceTenantId !== undefined && resourceTenantId !== session.tenant_id) {
    return { kind: 'refused', reason: 'tenant_isolation' };
  }
  return { kind: 'ok', session };
}
