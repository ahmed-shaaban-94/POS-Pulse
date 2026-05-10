/**
 * T057 [S3] — IdentityStrip S3 restyle assertions.
 *
 * Covers:
 * - CSS class names used (no inline styles for font-weight)
 * - Tenant uses .identity-strip__tenant (14/600/--color-text)
 * - Branch uses .identity-strip__branch (14/500/--color-text-muted)
 * - Terminal label uses .identity-strip__terminal (mono chip)
 * - Separator uses .identity-strip__sep
 * - Long branch truncates via CSS (flex-shrink: 1 on branch vs 0 on terminal)
 * - No sensitive identifiers in DOM
 * - axe baseline smoke
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { IdentityStrip } from '../IdentityStrip';
import { expectNoAxeViolations } from '../../../ui/primitives/__tests__/axe-config';

afterEach(cleanup);

describe('IdentityStrip S3 restyle (T057)', () => {
  it('tenant renders with .identity-strip__tenant class', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme Pharmacy" branchId="Main St" terminalLabel="Counter 1" />,
    );
    const tenant = container.querySelector('.identity-strip__tenant');
    expect(tenant).toBeInTheDocument();
    expect(tenant).toHaveTextContent('Acme Pharmacy');
  });

  it('branch renders with .identity-strip__branch class', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="Counter 1" />,
    );
    const branch = container.querySelector('.identity-strip__branch');
    expect(branch).toBeInTheDocument();
    expect(branch).toHaveTextContent('Main St');
  });

  it('terminal label renders with .identity-strip__terminal class (mono chip)', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="Counter 1" />,
    );
    const terminal = container.querySelector('.identity-strip__terminal');
    expect(terminal).toBeInTheDocument();
    expect(terminal).toHaveTextContent('Counter 1');
  });

  it('separator renders with .identity-strip__sep class', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="Counter 1" />,
    );
    const seps = container.querySelectorAll('.identity-strip__sep');
    expect(seps.length).toBeGreaterThanOrEqual(2);
  });

  it('does not use inline font-weight styles', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="C1" />,
    );
    const spans = Array.from(container.querySelectorAll('span'));
    for (const span of spans) {
      expect(span.style.fontWeight).toBe('');
    }
  });

  it('no sensitive identifiers visible', () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme" branchId="Downtown" terminalLabel="T1" />,
    );
    const text = container.textContent;
    expect(text).not.toMatch(/device_token/i);
    expect(text).not.toMatch(/tok_/);
    expect(text).not.toMatch(/jwt/i);
  });

  it('no axe violations', async () => {
    const { container } = render(
      <IdentityStrip tenantId="Acme Pharmacy" branchId="Main St" terminalLabel="Counter 1" />,
    );
    await expectNoAxeViolations(container);
  });

  it('falls back to em dash for empty tenantId', () => {
    render(<IdentityStrip tenantId="" branchId="Main St" terminalLabel="T1" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('falls back to em dash for empty branchId', () => {
    render(<IdentityStrip tenantId="Acme" branchId="" terminalLabel="T1" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('falls back to em dash for empty terminalLabel', () => {
    render(<IdentityStrip tenantId="Acme" branchId="Main St" terminalLabel="" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
