import type { JSX } from 'react';

interface EmptyStateProps {
  heading: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ heading, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div>
      <h2>{heading}</h2>
      <p>{description}</p>
      {action && (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
