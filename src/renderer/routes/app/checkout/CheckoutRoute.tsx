import type { JSX } from 'react';

import { useFeatureFlagsStore } from '../../../stores/feature-flags-store';
import { Workspace } from '../../../shell/regions/Workspace';
import { PaymentSurface } from '../../../ui/payments/PaymentSurface';
import { CheckoutPlaceholder } from './CheckoutPlaceholder';

/**
 * 006-payments-tender — `/app/checkout` route.
 *
 * When the `payments` feature flag is on, the checkout route renders the live
 * `PaymentSurface` (the tender screen). PaymentSurface self-gates: it returns
 * null unless a signed-in operator session AND a non-null payment envelope
 * exist in the payment store. The envelope is mounted by CartPane's
 * "Continue to payment" handler immediately before navigation here, so by the
 * time this route renders the envelope is present.
 *
 * When the flag is off (fail-closed default), the route falls back to the
 * 003-era `CheckoutPlaceholder` — the visual tender-slot reservation — so the
 * route is never blank and pre-006 behaviour is preserved.
 *
 * PaymentSurface reads its own payments + tender bridge from `window.api`; no
 * props are threaded here.
 */
export function CheckoutRoute(): JSX.Element {
  const paymentsFlag = useFeatureFlagsStore((s) => s.payments);

  if (!paymentsFlag) {
    return <CheckoutPlaceholder />;
  }

  return (
    <Workspace title="Checkout">
      <PaymentSurface />
    </Workspace>
  );
}
