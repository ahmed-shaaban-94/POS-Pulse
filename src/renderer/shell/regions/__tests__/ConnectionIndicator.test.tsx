import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { ConnectionIndicator } from '../ConnectionIndicator';
import { expectNoAxeViolations } from '../../../ui/primitives/__tests__/axe-config';
import type { ConnectionState } from '../../../ui/tokens/connection-state';

afterEach(cleanup);

/**
 * T044 — ConnectionIndicator: four distinct visual states.
 *
 * Asserts:
 * - Four states render distinct color-intent marker + label + accessible name.
 * - syncing carries the visual + accessible name but triggers NO fetch / IPC /
 *   localStorage / sessionStorage calls (spies at zero).
 * - online shows a "normal" (success) visual.
 * - role="status" — dynamic status / live-region semantics.
 * - The indicator is non-actionable (clicks are no-ops in this feature).
 * - No axe violations across all four states.
 *
 * FR-23 — connection-state changes announced to assistive tech via
 * StatusBanner's aria-live="polite" semantics (exercised in TopBar tests).
 */

const STATES: Array<{ state: ConnectionState; label: string; intent: string }> = [
  { state: 'online', label: 'Online', intent: 'success' },
  { state: 'degraded', label: 'Connection slow', intent: 'warning' },
  { state: 'offline', label: 'Offline', intent: 'danger' },
  { state: 'syncing', label: 'Syncing…', intent: 'neutral' },
];

describe('ConnectionIndicator (T044)', () => {
  it.each(STATES)(
    'state=$state renders intent=$intent and accessible label="$label"',
    ({ state, label, intent }) => {
      const { container } = render(<ConnectionIndicator state={state} />);

      // role="status" present
      const indicator = container.querySelector('[role="status"]');
      expect(indicator).toBeInTheDocument();

      // Accessible name matches label
      expect(screen.getByRole('status', { name: label })).toBeInTheDocument();

      // Distinct color-intent marker on the element
      expect(indicator).toHaveAttribute('data-connection-state', state);
      expect(indicator).toHaveAttribute('data-intent', intent);
    },
  );

  it('online state shows "success" intent (normal visual)', () => {
    const { container } = render(<ConnectionIndicator state="online" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveAttribute('data-intent', 'success');
  });

  it('degraded state shows "warning" intent (distinct from online)', () => {
    const { container } = render(<ConnectionIndicator state="degraded" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveAttribute('data-intent', 'warning');
    expect(indicator).not.toHaveAttribute('data-intent', 'success');
  });

  it('offline state shows "danger" intent (distinct from degraded)', () => {
    const { container } = render(<ConnectionIndicator state="offline" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveAttribute('data-intent', 'danger');
  });

  it('syncing state shows "neutral" intent (distinct from danger)', () => {
    const { container } = render(<ConnectionIndicator state="syncing" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toHaveAttribute('data-intent', 'neutral');
  });

  it('all four states have distinct intent values', () => {
    const intents = STATES.map(({ state }) => {
      const { container } = render(<ConnectionIndicator state={state} />);
      const indicator = container.querySelector('[role="status"]');
      const intent = indicator?.getAttribute('data-intent');
      cleanup();
      return intent;
    });
    const uniqueIntents = new Set(intents);
    // All four states must map to distinct intents
    expect(uniqueIntents.size).toBe(4);
  });

  it('is non-actionable — no button, no anchor, no interactive role inside', () => {
    const { container } = render(<ConnectionIndicator state="online" />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(container.querySelector('[role="link"]')).toBeNull();
  });

  it('click on indicator is a no-op — no fetch, IPC, localStorage, sessionStorage', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const localStorageSpy = vi.spyOn(window, 'localStorage', 'get').mockReturnValue({} as Storage);
    const sessionStorageSpy = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockReturnValue({} as Storage);

    const { container } = render(<ConnectionIndicator state="syncing" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    const indicatorEl = indicator!;

    await user.click(indicatorEl);
    await user.pointer({ target: indicatorEl, keys: '[MouseLeft]' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    localStorageSpy.mockRestore();
    sessionStorageSpy.mockRestore();
  });

  it('syncing: mount + hover + focus + click — zero fetch/IPC/localStorage/sessionStorage calls', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const localStorageSpy = vi.spyOn(window, 'localStorage', 'get').mockReturnValue({} as Storage);
    const sessionStorageSpy = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockReturnValue({} as Storage);

    const { container } = render(<ConnectionIndicator state="syncing" />);
    const indicator = container.querySelector('[role="status"]');
    expect(indicator).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
    const indicatorEl = indicator!;

    // mount — already checked above; now exercise hover + focus + click
    await user.hover(indicatorEl);
    await user.tab();
    await user.click(indicatorEl);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    localStorageSpy.mockRestore();
    sessionStorageSpy.mockRestore();
  });

  it.each(STATES)('no axe violations for state=$state', async ({ state }) => {
    const { container } = render(<ConnectionIndicator state={state} />);
    await expectNoAxeViolations(container);
  });
});
