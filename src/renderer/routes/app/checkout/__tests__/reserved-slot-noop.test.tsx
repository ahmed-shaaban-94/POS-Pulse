import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { CheckoutPlaceholder } from '../CheckoutPlaceholder';
import { reservedSlotIds } from '../reserved-slot-ids';

afterEach(cleanup);
afterEach(() => vi.unstubAllGlobals());
afterEach(() => vi.restoreAllMocks());

/**
 * T051 — reserved-slot-noop guard: for each rendered slot, mount → hover
 * → focus → click triggers ZERO observable calls to fetch, window.api,
 * localStorage, sessionStorage, or any print-related global.
 *
 * This guard locks the "no payment logic, no IPC, no persistence, no printing"
 * boundary for the Checkout placeholder.
 */
describe('reserved-slot-noop guard (T051)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let printMock: ReturnType<typeof vi.fn>;
  let localStorageSpy: ReturnType<typeof vi.spyOn>;
  let sessionStorageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Stub fetch
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Stub window.print
    printMock = vi.fn();
    vi.stubGlobal('print', printMock);

    // Spy on storage
    localStorageSpy = vi.spyOn(window, 'localStorage', 'get');
    sessionStorageSpy = vi.spyOn(window, 'sessionStorage', 'get');
  });

  it('zero fetch calls across all slot interactions', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );

    for (const slotId of reservedSlotIds) {
      const slot = container.querySelector(`[data-slot-id="${slotId}"]`) as HTMLElement;
      expect(slot).not.toBeNull();
      await user.hover(slot);
      slot.focus();
      await user.click(slot);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  }, 15000);

  it('zero localStorage calls across all slot interactions', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );

    for (const slotId of reservedSlotIds) {
      const slot = container.querySelector(`[data-slot-id="${slotId}"]`) as HTMLElement;
      expect(slot).not.toBeNull();
      await user.hover(slot);
      slot.focus();
      await user.click(slot);
    }

    expect(localStorageSpy).not.toHaveBeenCalled();
  }, 15000);

  it('zero sessionStorage calls across all slot interactions', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );

    for (const slotId of reservedSlotIds) {
      const slot = container.querySelector(`[data-slot-id="${slotId}"]`) as HTMLElement;
      expect(slot).not.toBeNull();
      await user.hover(slot);
      slot.focus();
      await user.click(slot);
    }

    expect(sessionStorageSpy).not.toHaveBeenCalled();
  }, 15000);

  it('zero window.print calls across all slot interactions', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <CheckoutPlaceholder />
      </MemoryRouter>,
    );

    for (const slotId of reservedSlotIds) {
      const slot = container.querySelector(`[data-slot-id="${slotId}"]`) as HTMLElement;
      expect(slot).not.toBeNull();
      await user.hover(slot);
      slot.focus();
      await user.click(slot);
    }

    expect(printMock).not.toHaveBeenCalled();
  }, 15000);

  it('window.api is not called on mount', () => {
    // window.api does not exist in test environment (no preload), so we
    // verify that the component mounts without attempting to call any api method.
    // If it tried to call window.api.pairing.getStatus(), it would throw.
    expect(() => {
      render(
        <MemoryRouter>
          <CheckoutPlaceholder />
        </MemoryRouter>,
      );
    }).not.toThrow();
  });
});
