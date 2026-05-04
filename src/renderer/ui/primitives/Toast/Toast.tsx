import { useEffect, type JSX } from 'react';

type ToastIntent = 'info' | 'success' | 'warning' | 'danger';

interface ToastProps {
  intent: ToastIntent;
  title: string;
  description?: string;
  durationMs?: number;
  onDismiss?: () => void;
}

export function Toast({
  intent,
  title,
  description,
  durationMs = 5000,
  onDismiss,
}: ToastProps): JSX.Element {
  const isUrgent = intent === 'warning' || intent === 'danger';

  useEffect(() => {
    if (durationMs === 0 || !onDismiss) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(timer);
    };
  }, [durationMs, onDismiss]);

  return (
    <div role={isUrgent ? 'alert' : 'status'} data-intent={intent}>
      <span>{title}</span>
      {description && <p>{description}</p>}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          ×
        </button>
      )}
    </div>
  );
}
