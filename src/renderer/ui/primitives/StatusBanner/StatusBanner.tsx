import type { JSX } from 'react';
import type { ConnectionState } from '../../tokens/connection-state';

interface StatusBannerProps {
  state: ConnectionState;
  message?: string;
}

export function StatusBanner({ state, message }: StatusBannerProps): JSX.Element {
  if (state === 'online') {
    return <aside role="status" aria-live="polite" aria-hidden="true" />;
  }

  return (
    <aside role="status" aria-live="polite" data-state={state}>
      {message}
    </aside>
  );
}
