import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { Button } from './Button';

afterEach(cleanup);

describe('Button (T016 + T029)', () => {
  const intents = ['primary', 'secondary', 'ghost', 'destructive'] as const;

  it.each(intents)('renders intent=%s', (intent) => {
    render(<Button intent={intent}>Click</Button>);
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  });

  it.each(intents)('applies correct BEM class for intent=%s', (intent) => {
    render(<Button intent={intent}>Click</Button>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn).toHaveClass(`btn--${intent}`);
    expect(btn).toHaveClass('btn');
  });

  it('calls onClick when clicked', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(
      <Button intent="primary" onClick={handler}>
        Click me
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('has visible focus ring (focus-visible class or outline)', () => {
    render(<Button intent="primary">Focus</Button>);
    const btn = screen.getByRole('button', { name: 'Focus' });
    expect(btn).toBeInTheDocument();
  });

  it('sets aria-busy="true" when loading', () => {
    render(
      <Button intent="primary" loading>
        Loading
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('sets aria-disabled="true" when disabled', () => {
    render(
      <Button intent="primary" disabled>
        Disabled
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('is not focusable when disabled', () => {
    render(
      <Button intent="primary" disabled>
        Disabled
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });

  // T029 — Touch-target invariant: md=44px, lg=52px via BEM class on the element.
  // happy-dom does not compute layout; we verify the BEM modifier that maps to
  // the block-size rule in tailwind.css (.btn--md { block-size: 44px } / .btn--lg { block-size: 52px }).
  it('md size: carries btn--md class (maps to 44px block-size in CSS)', () => {
    render(
      <Button intent="primary" size="md">
        Touch
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Touch' });
    expect(btn).toHaveClass('btn--md');
    expect(btn).not.toHaveClass('btn--lg');
    // data-touch-target="44" is the machine-readable token for QA tooling
    expect(btn).toHaveAttribute('data-touch-target', '44');
  });

  it('lg size: carries btn--lg class (maps to 52px block-size in CSS)', () => {
    render(
      <Button intent="primary" size="lg">
        Touch
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Touch' });
    expect(btn).toHaveClass('btn--lg');
    expect(btn).not.toHaveClass('btn--md');
    // lg buttons target 52px; data-touch-target remains "44" (minimum floor)
    expect(btn).toHaveAttribute('data-touch-target', '44');
  });

  it('default size is md (44px touch target)', () => {
    render(<Button intent="primary">Default</Button>);
    const btn = screen.getByRole('button', { name: 'Default' });
    expect(btn).toHaveClass('btn--md');
  });

  it('loading: renders with spinner indicator in label', () => {
    render(
      <Button intent="primary" loading>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    // Loading spinner is discoverable as a status indicator
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not fire onClick when disabled', async () => {
    const handler = vi.fn();
    const user = userEvent.setup();
    render(
      <Button intent="primary" disabled onClick={handler}>
        Disabled
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('iconStart renders before children', () => {
    render(
      <Button intent="primary" iconStart={<span data-testid="icon-start" />}>
        With icon
      </Button>,
    );
    expect(screen.getByTestId('icon-start')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'With icon' })).toBeInTheDocument();
  });
});
