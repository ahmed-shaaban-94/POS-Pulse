import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { AppRouter } from '../router';
import type { PairingBridgeAPI } from '../../shared/bridge-api';
import type { PairingStatus } from '../../shared/pairing-types';

/**
 * 002-terminal-pairing T079a — FR-13 no-self-service-unpair regression.
 *
 * FR-13: The application MUST NOT expose a self-service "Unpair" or
 * "Reset terminal identity" action to the operator in this feature.
 *
 * This test mounts each route reachable from an authenticated state
 * (/paired) and the unauthenticated pairing surface (/pairing), then
 * asserts the rendered tree contains zero elements whose text or
 * data-testid matches any unpair-affordance pattern:
 *
 *   /^unpair$/i          — a button/link labelled exactly "Unpair"
 *   /reset terminal/i    — any "Reset terminal" affordance
 *   /forget device/i     — any "Forget device" affordance
 *
 * The test passes immediately (no unpair surface exists). Its VALUE is
 * as a regression guard: if a future contributor accidentally introduces
 * an unpair affordance, this test fails loudly before merge.
 *
 * When feature 003+ deliberately adds an admin-initiated re-pair
 * surface, update this test to reflect the approved affordance rather
 * than deleting the guard entirely — the spirit of FR-13 (no
 * self-service unpair) must be preserved across features.
 */

const UNPAIR_PATTERNS = [/^unpair$/i, /reset terminal/i, /forget device/i] as const;

function makePairedBridge(): PairingBridgeAPI {
  const status: PairingStatus = {
    kind: 'paired',
    tenant_id: 'tenant-A',
    branch_id: 'branch-B',
    terminal_id: 'terminal-C',
    terminal_label: 'Counter 1',
    paired_at: 1735689600,
  };
  return {
    getStatus: vi.fn(() => Promise.resolve(status)),
    submit: vi.fn(() => Promise.reject(new Error('submit not called in T079a'))),
  };
}

function makeUnpairedBridge(): PairingBridgeAPI {
  return {
    getStatus: vi.fn(() => Promise.resolve({ kind: 'unpaired' } satisfies PairingStatus)),
    submit: vi.fn(() => Promise.reject(new Error('submit not called in T079a'))),
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('FR-13 no-self-service-unpair regression (T079a)', () => {
  it('/paired route renders zero unpair-affordance elements', async () => {
    render(<AppRouter pairing={makePairedBridge()} />);

    // Wait until the paired route has fully rendered its content.
    await waitFor(() => expect(screen.getByTestId('route-paired')).toBeInTheDocument());

    for (const pattern of UNPAIR_PATTERNS) {
      // Text match: any element whose full text matches the pattern.
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();

      // data-testid match: any element with a testid containing the pattern.
      const byTestId = document.querySelector(`[data-testid]`);
      if (byTestId) {
        const allTestIds = Array.from(document.querySelectorAll('[data-testid]'));
        for (const el of allTestIds) {
          const testId = el.getAttribute('data-testid') ?? '';
          expect(testId).not.toMatch(pattern);
        }
      }
    }
  });

  it('/pairing route renders zero unpair-affordance elements', async () => {
    render(<AppRouter pairing={makeUnpairedBridge()} />);

    await waitFor(() => expect(screen.getByTestId('route-pairing')).toBeInTheDocument());

    for (const pattern of UNPAIR_PATTERNS) {
      expect(screen.queryByText(pattern)).not.toBeInTheDocument();

      const allTestIds = Array.from(document.querySelectorAll('[data-testid]'));
      for (const el of allTestIds) {
        const testId = el.getAttribute('data-testid') ?? '';
        expect(testId).not.toMatch(pattern);
      }
    }
  });

  it('no interactive element (button, link, input) on /paired has unpair-related accessible name', async () => {
    render(<AppRouter pairing={makePairedBridge()} />);

    await waitFor(() => expect(screen.getByTestId('route-paired')).toBeInTheDocument());

    const interactives = Array.from(
      document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'),
    );
    for (const el of interactives) {
      const label = el.getAttribute('aria-label') ?? '';
      // textContent is string|null in the DOM type but always a string
      // at runtime for element nodes; use || to stay condition-free.
      const combined = (el.textContent || '') + label;
      for (const pattern of UNPAIR_PATTERNS) {
        expect(combined).not.toMatch(pattern);
      }
    }
  });
});
