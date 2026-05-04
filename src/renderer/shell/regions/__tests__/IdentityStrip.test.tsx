import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { IdentityStrip } from '../IdentityStrip';

afterEach(cleanup);

/**
 * T029 — IdentityStrip: tenant + branch + terminal label render from
 * injected paired-state values; missing values fall back to —.
 */
describe('IdentityStrip (T029)', () => {
  it('renders tenant, branch, and terminal label', () => {
    render(<IdentityStrip tenantId="Acme Pharmacy" branchId="Main St" terminalLabel="Counter 1" />);
    expect(screen.getByText('Acme Pharmacy')).toBeInTheDocument();
    expect(screen.getByText('Main St')).toBeInTheDocument();
    expect(screen.getByText('Counter 1')).toBeInTheDocument();
  });

  it('falls back to — when tenantId is empty', () => {
    render(<IdentityStrip tenantId="" branchId="Main St" terminalLabel="Counter 1" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('falls back to — when branchId is empty', () => {
    render(<IdentityStrip tenantId="Acme" branchId="" terminalLabel="Counter 1" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('falls back to — when terminalLabel is empty', () => {
    render(<IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('does not use hard-coded colors', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="C1" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('');
    expect(el.style.backgroundColor).toBe('');
  });
});
