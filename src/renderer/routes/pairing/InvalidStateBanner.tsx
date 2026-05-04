import type { JSX } from 'react';

import type { PairingStatus } from '../../../shared/pairing-types';

type InvalidReason = Extract<PairingStatus, { kind: 'invalid' }>['reason'];

const MESSAGES: Record<InvalidReason, string> = {
  missing_token: 'This terminal needs to be paired again. The secure token is missing.',
  orphaned_row: 'This terminal needs to be paired again. Local assignment data is incomplete.',
  decrypt_failed: 'This terminal needs to be paired again. Secure token recovery failed.',
};

interface InvalidStateBannerProps {
  reason: InvalidReason;
}

export function InvalidStateBanner({ reason }: InvalidStateBannerProps): JSX.Element {
  return (
    <div role="alert" data-testid="invalid-state-banner">
      {MESSAGES[reason]}
    </div>
  );
}
