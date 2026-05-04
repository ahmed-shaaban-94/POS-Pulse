import { useEffect, useRef, type JSX, type ReactNode } from 'react';

type DialogVariant = 'default' | 'confirm' | 'destructive';

interface DialogAction {
  label: string;
  onClick: () => void;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: DialogVariant;
  title: string;
  description?: string;
  children: ReactNode;
  primaryAction?: DialogAction;
  secondaryAction?: DialogAction;
}

export function Dialog({
  open,
  onOpenChange,
  variant = 'default',
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
}: DialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `dialog-title-${Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'var(--color-overlay-scrim)' }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? `${titleId}-desc` : undefined}
        tabIndex={-1}
        data-variant={variant}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: 'var(--shadow-overlay)',
          background: 'var(--color-surface-elevated)',
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <h2 id={titleId}>{title}</h2>
        {description && <p id={`${titleId}-desc`}>{description}</p>}
        <div>{children}</div>
        <div>
          {secondaryAction && (
            <button type="button" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button type="button" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
