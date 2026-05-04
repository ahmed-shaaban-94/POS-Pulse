import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { StatusBanner } from './StatusBanner';
import type { ConnectionState } from '../../tokens/connection-state';

afterEach(cleanup);

describe('StatusBanner (T020)', () => {
  const nonOnlineStates: ConnectionState[] = ['degraded', 'offline', 'syncing'];

  it.each(nonOnlineStates)('renders visible content for state=%s', (state) => {
    render(<StatusBanner state={state} message={`${state} message`} />);
    expect(screen.getByText(`${state} message`)).toBeInTheDocument();
  });

  it('renders nothing visible for state=online', () => {
    const { container } = render(<StatusBanner state="online" />);
    // Online state is hidden — no visible text
    expect(container.textContent).toBe('');
  });

  it('has aria-live="polite"', () => {
    const { container } = render(<StatusBanner state="degraded" message="Slow connection" />);
    const el = container.querySelector('[aria-live="polite"]');
    expect(el).toBeInTheDocument();
  });

  it('has role="status"', () => {
    render(<StatusBanner state="offline" message="No connection" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('never carries a destructive action button', () => {
    const { container } = render(<StatusBanner state="offline" message="Offline" />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('is non-dismissible (no close/dismiss control)', () => {
    const { container } = render(<StatusBanner state="degraded" message="Degraded" />);
    expect(container.querySelectorAll('[aria-label*="dismiss"]')).toHaveLength(0);
    expect(container.querySelectorAll('[aria-label*="close"]')).toHaveLength(0);
  });
});
