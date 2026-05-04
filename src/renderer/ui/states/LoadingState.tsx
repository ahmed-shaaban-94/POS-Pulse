import type { JSX } from 'react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps): JSX.Element {
  return (
    <div role="status" aria-live="polite">
      <span>{message}</span>
    </div>
  );
}
