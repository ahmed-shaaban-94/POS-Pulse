import type { JSX } from 'react';

import type { PairingStatus } from '../../../shared/pairing-types';

/**
 * 002-terminal-pairing T016 — `/paired` route placeholder.
 *
 * US1 ships an EMPTY scaffold so the boot router can mount something
 * type-safely. The full content (tenant / branch / terminal-label
 * surface, post-pair confirmation flow) lands in US2 (T032-T033).
 *
 * SECURITY: this component receives only the configuration half of
 * PairingStatus (tenant/branch/terminal_id/terminal_label/paired_at).
 * The device_token never crosses the bridge — getStatus() returns the
 * `paired` discriminant whose type explicitly omits the token. US2's
 * test (T032) re-asserts that no `device_token` field reaches the
 * component.
 */
export interface PairedScreenProps {
  status: Extract<PairingStatus, { kind: 'paired' }>;
}

export function PairedScreen(props: PairedScreenProps): JSX.Element {
  // Render the assignment fields as data attributes so the router test
  // can assert "we're on /paired" without depending on actual UI text
  // (which lands in US2).
  return (
    <main
      data-testid="route-paired"
      data-tenant-id={props.status.tenant_id}
      data-branch-id={props.status.branch_id}
      data-terminal-id={props.status.terminal_id}
      data-terminal-label={props.status.terminal_label}
    />
  );
}
