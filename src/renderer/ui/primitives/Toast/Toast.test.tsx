import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { Toast } from './Toast';

afterEach(cleanup);

describe('Toast (T022)', () => {
  const intents = ['info', 'success', 'warning', 'danger'] as const;

  it.each(intents)('renders with intent=%s', (intent) => {
    render(<Toast intent={intent} title={`${intent} toast`} />);
    expect(screen.getByText(`${intent} toast`)).toBeInTheDocument();
  });

  it('has role="status" for info intent', () => {
    render(<Toast intent="info" title="Info" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has role="status" for success intent', () => {
    render(<Toast intent="success" title="Success" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has role="alert" for warning intent', () => {
    render(<Toast intent="warning" title="Warning" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has role="alert" for danger intent', () => {
    render(<Toast intent="danger" title="Danger" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<Toast intent="info" title="Dismissible" onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('auto-dismiss with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onDismiss after durationMs with fake timers', () => {
      const onDismiss = vi.fn();
      render(<Toast intent="info" title="Auto" durationMs={3000} onDismiss={onDismiss} />);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not auto-dismiss when durationMs=0', () => {
      const onDismiss = vi.fn();
      render(<Toast intent="info" title="Manual only" durationMs={0} onDismiss={onDismiss} />);
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
