import { describe, it, expectTypeOf } from 'vitest';

import type {
  OperatorBridgeAPI,
  OperatorSessionBridgeView,
  CancelTakeoverRequest,
  CancelTakeoverResponse,
  ConfirmTakeoverRequest,
  ConfirmTakeoverResponse,
  EmitAuditEventRequest,
  EmitAuditEventResponse,
  ForceCloseShiftRequest,
  ForceCloseShiftResponse,
  ListBranchRosterResponse,
  ListStuckShiftsResponse,
  ProvisionCashierPinRequest,
  ProvisionCashierPinResponse,
  ResetCashierPinRequest,
  ResetCashierPinResponse,
  SignInRequest,
  SignInResponse,
  SignInSuccessResponse,
  SignOutResponse,
  TakeoverRequiredResponse,
  UnlockCashierRequest,
  UnlockCashierResponse,
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
  it('operator namespace has the approved implemented method set', () => {
    expectTypeOf<keyof OperatorBridgeAPI>().toEqualTypeOf<
      | 'signIn'
      | 'signOut'
      | 'getCurrentSession'
      | '_reportActivity'
      | 'emitAuditEvent'
      | '_emitAuditEventSmoke'
      | 'listBranchRoster'
      | 'confirmTakeover'
      | 'cancelTakeover'
      | 'resetCashierPin'
      | 'provisionCashierPin'
      | 'unlockCashier'
      | 'forceCloseShift'
      | 'listStuckShifts'
      | 'dismissShiftClosedNotice'
    >();
  });

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

  it('S5 bridge methods match the documented request and response contracts', () => {
    expectTypeOf<Parameters<OperatorBridgeAPI['listBranchRoster']>>().toEqualTypeOf<[]>();
    expectTypeOf<
      Awaited<ReturnType<OperatorBridgeAPI['listBranchRoster']>>
    >().toEqualTypeOf<ListBranchRosterResponse>();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['confirmTakeover']>[0]
    >().toEqualTypeOf<ConfirmTakeoverRequest>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['confirmTakeover']>>>().toEqualTypeOf<
      ConfirmTakeoverResponse | OperatorRefusal
    >();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['cancelTakeover']>[0]
    >().toEqualTypeOf<CancelTakeoverRequest>();
    expectTypeOf<
      Awaited<ReturnType<OperatorBridgeAPI['cancelTakeover']>>
    >().toEqualTypeOf<CancelTakeoverResponse>();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['forceCloseShift']>[0]
    >().toEqualTypeOf<ForceCloseShiftRequest>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['forceCloseShift']>>>().toEqualTypeOf<
      ForceCloseShiftResponse | OperatorRefusal
    >();

    expectTypeOf<Parameters<OperatorBridgeAPI['listStuckShifts']>>().toEqualTypeOf<[]>();
    expectTypeOf<
      Awaited<ReturnType<OperatorBridgeAPI['listStuckShifts']>>
    >().toEqualTypeOf<ListStuckShiftsResponse>();

    expectTypeOf<Parameters<OperatorBridgeAPI['dismissShiftClosedNotice']>>().toEqualTypeOf<[]>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['dismissShiftClosedNotice']>>>().toBeVoid();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['resetCashierPin']>[0]
    >().toEqualTypeOf<ResetCashierPinRequest>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['resetCashierPin']>>>().toEqualTypeOf<
      ResetCashierPinResponse | OperatorRefusal
    >();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['provisionCashierPin']>[0]
    >().toEqualTypeOf<ProvisionCashierPinRequest>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['provisionCashierPin']>>>().toEqualTypeOf<
      ProvisionCashierPinResponse | OperatorRefusal
    >();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['unlockCashier']>[0]
    >().toEqualTypeOf<UnlockCashierRequest>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['unlockCashier']>>>().toEqualTypeOf<
      UnlockCashierResponse | OperatorRefusal
    >();

    expectTypeOf<
      Parameters<OperatorBridgeAPI['emitAuditEvent']>[0]
    >().toEqualTypeOf<EmitAuditEventRequest>();
    expectTypeOf<Awaited<ReturnType<OperatorBridgeAPI['emitAuditEvent']>>>().toEqualTypeOf<
      EmitAuditEventResponse | OperatorRefusal
    >();
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
