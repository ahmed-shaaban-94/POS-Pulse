import { describe, it, expectTypeOf } from 'vitest';

import type {
  OperatorBridgeAPI,
  OperatorSessionBridgeView,
  SignInRequest,
  SignInResponse,
  SignInSuccessResponse,
  SignOutResponse,
  TakeoverRequiredResponse,
} from '../bridge-api.js';
import type { OperatorRefusal } from '../audit/event-shape.js';

/**
 * 004-operator-session T008 — bridge contract test (manager/admin
 * paths only at S1).
 *
 * Type-only assertion that the `operator.*` namespace exposed by the
 * preload bridge matches the contract in
 * `specs/004-operator-session/contracts/bridge-api.md` for the calls
 * S1 actually wires. Cashier paths, takeover-confirm, roster,
 * audit-event-emit, and PIN management are §A1-gated and intentionally
 * absent — they land with their slices.
 */

describe('operator bridge typed surface (T008)', () => {
  it('signIn accepts manager_admin request and resolves to discriminated union', () => {
    expectTypeOf<Parameters<OperatorBridgeAPI['signIn']>[0]>().toEqualTypeOf<SignInRequest>();
    expectTypeOf<
      Awaited<ReturnType<OperatorBridgeAPI['signIn']>>
    >().toEqualTypeOf<SignInResponse>();
  });

  it('SignInResponse is the closed union of success | takeover | refusal', () => {
    expectTypeOf<SignInResponse>().toEqualTypeOf<
      SignInSuccessResponse | TakeoverRequiredResponse | OperatorRefusal
    >();
  });

  it('signOut takes no arguments and resolves to SignOutResponse', () => {
    expectTypeOf<Parameters<OperatorBridgeAPI['signOut']>>().toEqualTypeOf<[]>();
    expectTypeOf<
      Awaited<ReturnType<OperatorBridgeAPI['signOut']>>
    >().toEqualTypeOf<SignOutResponse>();
  });

  it('getCurrentSession resolves to OperatorSessionBridgeView | null', () => {
    expectTypeOf<
      Awaited<ReturnType<OperatorBridgeAPI['getCurrentSession']>>
    >().toEqualTypeOf<OperatorSessionBridgeView | null>();
  });

  it('OperatorSessionBridgeView omits credential / token fields', () => {
    type Keys = keyof OperatorSessionBridgeView;
    expectTypeOf<Keys>().toEqualTypeOf<
      'id' | 'operator_id' | 'display_name' | 'role' | 'tenant_id' | 'branch_id' | 'started_at'
    >();
  });

  it('TakeoverRequiredResponse carries capability token but no identifying detail (FR-013)', () => {
    type Keys = keyof TakeoverRequiredResponse;
    // Only `kind` + `pending_takeover_id` — no terminal label, no timestamp, no operator id.
    expectTypeOf<Keys>().toEqualTypeOf<'kind' | 'pending_takeover_id'>();
  });
});
