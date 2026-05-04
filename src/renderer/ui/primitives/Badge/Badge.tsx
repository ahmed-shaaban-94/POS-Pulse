import type { JSX, ReactNode, AriaAttributes } from 'react';

type BadgeIntent = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps extends AriaAttributes {
  intent: BadgeIntent;
  children: ReactNode;
}

export function Badge({ intent, children, ...aria }: BadgeProps): JSX.Element {
  return (
    <span data-intent={intent} className={`badge badge--${intent}`} {...aria}>
      {children}
    </span>
  );
}
