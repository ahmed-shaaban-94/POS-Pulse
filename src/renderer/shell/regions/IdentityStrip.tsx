import type { JSX } from 'react';
import { Badge } from '../../ui/primitives/Badge/Badge';

interface IdentityStripProps {
  tenantId: string;
  branchId: string;
  terminalLabel: string;
}

export function IdentityStrip({
  tenantId,
  branchId,
  terminalLabel,
}: IdentityStripProps): JSX.Element {
  const tenant = tenantId || '—';
  const branch = branchId || '—';
  const label = terminalLabel || '—';

  return (
    <div className="identity-strip">
      <span style={{ fontWeight: 'var(--font-weight-regular)' }}>{tenant}</span>
      <span aria-hidden="true"> · </span>
      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{branch}</span>
      <span aria-hidden="true"> · </span>
      <Badge intent="neutral">{label}</Badge>
    </div>
  );
}
