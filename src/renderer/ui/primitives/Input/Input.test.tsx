import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Input } from './Input';

afterEach(cleanup);

describe('Input (T019)', () => {
  const variants = ['text', 'password', 'numeric'] as const;

  it.each(variants)('renders variant=%s with mandatory label', (variant) => {
    render(<Input variant={variant} label={`${variant} input`} />);
    expect(screen.getByLabelText(`${variant} input`)).toBeInTheDocument();
  });

  it('label is associated via for/id', () => {
    render(<Input variant="text" label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input).toBeInTheDocument();
  });

  it('sets aria-invalid="true" in error state', () => {
    render(<Input variant="text" label="Name" errorMessage="Required" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('links error message via aria-describedby', () => {
    render(<Input variant="text" label="Name" errorMessage="Required field" />);
    const input = screen.getByLabelText('Name');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const errorEl = document.getElementById(describedBy.split(' ')[0] ?? '');
    expect(errorEl?.textContent).toContain('Required field');
  });

  it('links description via aria-describedby', () => {
    render(<Input variant="text" label="Name" description="Enter your full name" />);
    const input = screen.getByLabelText('Name');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toBeTruthy();
    const descEl = document.getElementById(describedBy.split(' ')[0] ?? '');
    expect(descEl?.textContent).toContain('Enter your full name');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Input variant="text" label="Disabled" disabled />);
    expect(screen.getByLabelText('Disabled')).toBeDisabled();
  });
});
