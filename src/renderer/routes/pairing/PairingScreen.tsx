import type { JSX } from 'react';

import type { PairingStatus } from '../../../shared/pairing-types';

/**
 * 002-terminal-pairing T016 — `/pairing` route placeholder.
 *
 * US1 ships an EMPTY scaffold so the boot router can mount something
 * type-safely. The form, autofocus, scanner-keyboard handling, and
 * outcome-message family all land in US2 (T029-T031) and US3-US5.
 *
 * The `invalidReason` prop forwards the route-state flag from the
 * router so the future US7 banner component can render an explanatory
 * message. US1 only exposes it via a data attribute for the router test.
 */
export interface PairingScreenProps {
  /**
   * Present only when the boot router landed here because
   * `pairingStore.getStatus()` returned `kind: 'invalid'`. US7 will turn
   * this into an in-app diagnostic banner (T070); US1 surfaces it via a
   * data attribute so the router test can assert routing decisions.
   */
  invalidReason?: Extract<PairingStatus, { kind: 'invalid' }>['reason'];
}

export function PairingScreen(props: PairingScreenProps): JSX.Element {
  return (
    <main data-testid="route-pairing" data-invalid-reason={props.invalidReason ?? undefined} />
  );
}
