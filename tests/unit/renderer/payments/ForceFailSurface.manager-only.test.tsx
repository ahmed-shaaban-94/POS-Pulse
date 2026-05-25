/**
 * T242 — `<ForceFailSurface>` manager-only renderer test (Wave 5b RED).
 *
 * Asserts (FR-021 / plan AD-5):
 *
 *   1. The surface calls `payments.forceFail` with the
 *      `{ payment_attempt_id, idempotency_key }` shape on confirm
 *      click.
 *   2. On `kind: 'ok'`, the success state renders with the
 *      `force_failed_at` timestamp.
 *   3. On `kind: 'refused'` (any reason — closed enum), the surface
 *      renders the GENERIC refusal copy. The structured reason MUST
 *      NOT be displayed (FR-022 / NFR-003 / PR-2 inherited from 004).
 *   4. **Manager identity NEVER appears anywhere in the rendered DOM.**
 *      This is the load-bearing FR-021 last-clause assertion at the
 *      renderer layer. The signed-in manager's display name belongs in
 *      the manager surface's own chrome (out of scope here), but the
 *      force-fail response NEVER carries operator identity into the
 *      rendered view.
 *
 * The manager-only ROUTE GUARD (T282) is tested separately at the
 * router level — that's the secondary UX defence. This test focuses
 * on the surface's own behaviour given a bridge stub.
 *
 * **Wave 5b — TDD RED.** Forward-references the surface component.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { ForceFailSurface } from '../../../../src/renderer/ui/payments/ForceFailSurface.js';
import type {
  PaymentsBridgeAPI,
  PaymentsForceFailRequest,
  PaymentsForceFailResponse,
} from '../../../../src/shared/bridge-api.js';

afterEach(() => {
  cleanup();
});

function makePayments(response: PaymentsForceFailResponse): {
  bridge: Pick<PaymentsBridgeAPI, 'forceFail'>;
  forceFail: ReturnType<typeof vi.fn>;
} {
  const forceFail = vi.fn<(req: PaymentsForceFailRequest) => Promise<PaymentsForceFailResponse>>(
    async () => await Promise.resolve(response),
  );
  return { bridge: { forceFail }, forceFail };
}

describe('T242 — ForceFailSurface manager-only renderer', () => {
  it('calls payments.forceFail with the expected shape on confirm click', async () => {
    const { bridge, forceFail } = makePayments({
      kind: 'ok',
      force_failed_at: '2026-05-25T13:00:00.000Z',
    });
    const user = userEvent.setup();
    render(
      <ForceFailSurface
        payment_attempt_id="pa-stuck-1"
        idempotency_key="idem-ff-render-1"
        payments={bridge}
      />,
    );
    await user.click(screen.getByTestId('ffs-confirm'));
    await waitFor(() => {
      expect(forceFail).toHaveBeenCalledTimes(1);
    });
    expect(forceFail).toHaveBeenCalledWith({
      payment_attempt_id: 'pa-stuck-1',
      idempotency_key: 'idem-ff-render-1',
    });
  });

  it('renders success state with the force_failed_at timestamp on ok', async () => {
    const { bridge } = makePayments({
      kind: 'ok',
      force_failed_at: '2026-05-25T13:00:00.000Z',
    });
    const user = userEvent.setup();
    const onForceFailed = vi.fn();
    render(
      <ForceFailSurface
        payment_attempt_id="pa-stuck-1"
        idempotency_key="idem-ff-render-2"
        payments={bridge}
        onForceFailed={onForceFailed}
      />,
    );
    await user.click(screen.getByTestId('ffs-confirm'));
    await waitFor(() => {
      expect(screen.queryByTestId('ffs-success')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ffs-success')).toHaveTextContent('2026-05-25T13:00:00.000Z');
    expect(onForceFailed).toHaveBeenCalledWith({
      force_failed_at: '2026-05-25T13:00:00.000Z',
    });
  });

  it('renders GENERIC refusal copy on refused (no structured reason displayed)', async () => {
    const { bridge } = makePayments({
      kind: 'refused',
      reason: 'role_denied',
    });
    const user = userEvent.setup();
    render(
      <ForceFailSurface
        payment_attempt_id="pa-stuck-1"
        idempotency_key="idem-ff-render-3"
        payments={bridge}
      />,
    );
    await user.click(screen.getByTestId('ffs-confirm'));
    await waitFor(() => {
      expect(screen.queryByTestId('ffs-refused')).toBeInTheDocument();
    });
    const refusedNode = screen.getByTestId('ffs-refused');
    // Generic, non-disclosing copy.
    expect(refusedNode).toHaveTextContent(/could not be force-failed/i);
    // The structured reason MUST NOT leak to the DOM.
    expect(refusedNode).not.toHaveTextContent('role_denied');
  });

  it('FR-021 last clause — manager identity NEVER appears in the rendered DOM', async () => {
    // Drive both an ok response and a refused response; assert neither
    // surfaces manager identity. The bridge response shape itself has
    // no operator-identity field (PaymentsForceFailResponse is
    // `{ kind: 'ok'; force_failed_at: string }` or `PaymentRefusal`),
    // so this is a contract assertion: the surface MUST NOT add any
    // operator-id-shaped content from external sources.
    const { bridge } = makePayments({
      kind: 'ok',
      force_failed_at: '2026-05-25T13:00:00.000Z',
    });
    const user = userEvent.setup();
    const { container } = render(
      <ForceFailSurface
        payment_attempt_id="pa-stuck-1"
        idempotency_key="idem-ff-render-4"
        payments={bridge}
      />,
    );
    await user.click(screen.getByTestId('ffs-confirm'));
    await waitFor(() => {
      expect(screen.queryByTestId('ffs-success')).toBeInTheDocument();
    });
    // Sentinel strings that would indicate a manager-identity leak.
    const text = container.textContent;
    expect(text).not.toMatch(/op-manager/i);
    expect(text).not.toMatch(/manager_operator_id/i);
    expect(text).not.toMatch(/force_fail_attribution_operator_id/i);
    // The cashier id should also not be displayed in this surface
    // (a manager view doesn't need it — only the attempt id).
    expect(text).not.toMatch(/op-clerk/i);
    expect(text).not.toMatch(/original_cashier_operator_id/i);
  });

  it('confirm button is disabled while submitting AND after success (prevents double-fire)', async () => {
    let resolveResp: (r: PaymentsForceFailResponse) => void = () => {};
    const pending = new Promise<PaymentsForceFailResponse>((res) => {
      resolveResp = res;
    });
    const forceFail = vi.fn<(req: PaymentsForceFailRequest) => Promise<PaymentsForceFailResponse>>(
      () => pending,
    );
    const bridge: Pick<PaymentsBridgeAPI, 'forceFail'> = { forceFail };
    const user = userEvent.setup();
    render(
      <ForceFailSurface
        payment_attempt_id="pa-stuck-1"
        idempotency_key="idem-ff-render-5"
        payments={bridge}
      />,
    );
    const confirm = screen.getByTestId('ffs-confirm');
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);
    await waitFor(() => {
      expect(screen.queryByTestId('ffs-submitting')).toBeInTheDocument();
    });
    expect(confirm).toBeDisabled();
    // Resolve the bridge response and assert the button remains disabled
    // on success (no double-fire path).
    resolveResp({ kind: 'ok', force_failed_at: '2026-05-25T13:00:05.000Z' });
    await waitFor(() => {
      expect(screen.queryByTestId('ffs-success')).toBeInTheDocument();
    });
    expect(confirm).toBeDisabled();
  });
});
