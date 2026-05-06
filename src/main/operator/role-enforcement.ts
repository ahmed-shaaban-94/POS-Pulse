import type { Role } from '../../shared/operator/role.js';
import { OperatorRefusalError } from '../../shared/audit/event-shape.js';

/**
 * 004-operator-session T015 — primary trust gate (AD-1).
 *
 * Per the architectural decision in plan.md §AD-1, the renderer-side
 * `<OperatorRouteGuard>` is a SECONDARY UX defence — the PRIMARY trust
 * boundary for role enforcement is here, in the main process, on the
 * first executable instruction of every operator-aware bridge handler.
 *
 * The enforcement is intentionally generic: any role mismatch throws an
 * OperatorRefusalError with category `role_mismatch`. The thrown error
 * MUST NOT echo the rejected role, the allowed roles, the operator id,
 * or any other identifying detail (PR-2 / NFR-003 — single generic
 * refusal category per failure mode).
 */

/**
 * Minimal session shape consumed by the gate. The full `OperatorSession`
 * lives in `session-manager.ts`; this interface is the projection the
 * gate needs and nothing more.
 */
export interface OperatorSessionForRoleGate {
  readonly role: Role;
}

/**
 * Throws OperatorRefusalError(`role_mismatch`) iff `session.role` is
 * not in `allowed`. Returns void on success.
 *
 * The first executable line of every operator-aware bridge handler
 * MUST call this with the closed list of allowed roles for that
 * handler. AD-1.
 */
export function requireRole(
  allowed: readonly Role[],
  session: OperatorSessionForRoleGate | null | undefined,
): void {
  if (session === null || session === undefined) {
    throw new OperatorRefusalError('not_signed_in');
  }
  if (!allowed.includes(session.role)) {
    throw new OperatorRefusalError('role_mismatch');
  }
}
