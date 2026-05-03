import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { PairingScreen } from '../PairingScreen';
import type { PairingBridgeAPI } from '../../../../shared/bridge-api';

/**
 * 002-terminal-pairing T030 — `PairingScreen` tests.
 *
 * The screen hosts `PairingForm` and preserves the US1 surface
 * (data-testid="route-pairing", optional data-invalid-reason for US7).
 * The screen MUST NOT add any other input element on the route — the
 * form's single input is the only input the operator/scanner sees.
 */

function makeBridge(): PairingBridgeAPI {
  return {
    getStatus: vi.fn(() => Promise.reject(new Error('PairingScreen must not call getStatus'))),
    submit: vi.fn(() =>
      Promise.resolve({
        outcome: 'success',
        tenant_id: 't',
        branch_id: 'b',
        terminal_id: 'term',
        terminal_label: 'Counter',
      } as const),
    ),
  };
}

afterEach(() => {
  cleanup();
});

describe('PairingScreen — composition (T030)', () => {
  it('renders inside the route-pairing test scope', () => {
    render(
      <MemoryRouter initialEntries={['/pairing']}>
        <PairingScreen pairing={makeBridge()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('route-pairing')).toBeInTheDocument();
  });

  it('renders the PairingForm (input + submit button visible)', () => {
    render(
      <MemoryRouter initialEntries={['/pairing']}>
        <PairingScreen pairing={makeBridge()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('autofocuses the input on mount', async () => {
    render(
      <MemoryRouter initialEntries={['/pairing']}>
        <PairingScreen pairing={makeBridge()} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus());
  });

  it('contains exactly one input element on the route', () => {
    render(
      <MemoryRouter initialEntries={['/pairing']}>
        <PairingScreen pairing={makeBridge()} />
      </MemoryRouter>,
    );
    // Only the form's pairing-code input is allowed. A future US3+ change
    // adding any second input on the route MUST break this test.
    const inputs = document.querySelectorAll('input');
    expect(inputs).toHaveLength(1);
  });

  it('preserves data-invalid-reason when invalidReason prop is set (US7 compatibility)', () => {
    render(
      <MemoryRouter initialEntries={['/pairing']}>
        <PairingScreen pairing={makeBridge()} invalidReason="missing_token" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('route-pairing')).toHaveAttribute(
      'data-invalid-reason',
      'missing_token',
    );
  });

  it('does NOT set data-invalid-reason when invalidReason prop is omitted', () => {
    render(
      <MemoryRouter initialEntries={['/pairing']}>
        <PairingScreen pairing={makeBridge()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('route-pairing')).not.toHaveAttribute('data-invalid-reason');
  });

  it('falls back to window.api when no `pairing` prop is provided (production path)', () => {
    const fakeApi = {
      ping: vi.fn(),
      appVersion: vi.fn(),
      log: vi.fn(),
      appConfig: vi.fn(),
      pairing: {
        getStatus: vi.fn(() => Promise.reject(new Error('not used'))),
        submit: vi.fn(),
      },
    };
    const original = (window as unknown as { api?: unknown }).api;
    (window as unknown as { api: typeof fakeApi }).api = fakeApi;
    try {
      render(
        <MemoryRouter initialEntries={['/pairing']}>
          {/* No pairing prop — Screen renders form without forwarding,
              form falls back to window.api. */}
          <PairingScreen />
        </MemoryRouter>,
      );
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    } finally {
      if (original === undefined) delete (window as unknown as { api?: unknown }).api;
      else (window as unknown as { api?: unknown }).api = original;
    }
  });

  it('forwards the bridge prop down to the PairingForm (no re-reading window.api)', () => {
    // Regression guard: the screen MUST pass the injected bridge to the
    // form. If the form falls through to window.api when the screen
    // received a bridge prop, this test fails.
    const bridge = makeBridge();
    // Deliberately do NOT set window.api — if the form tries to read
    // it, the form throws "window.api missing".
    const original = (window as unknown as { api?: unknown }).api;
    delete (window as unknown as { api?: unknown }).api;
    try {
      render(
        <MemoryRouter initialEntries={['/pairing']}>
          <PairingScreen pairing={bridge} />
        </MemoryRouter>,
      );
      // The form rendered without throwing — it received the prop.
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    } finally {
      if (original !== undefined) (window as unknown as { api?: unknown }).api = original;
    }
  });
});
