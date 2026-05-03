import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { PairingForm } from '../PairingForm';
import type { PairingBridgeAPI } from '../../../../shared/bridge-api';
import type { PairingSubmitResult } from '../../../../shared/pairing-types';

/**
 * 002-terminal-pairing T027 + T028 + T034 — `PairingForm` tests.
 *
 * Coverage for the single-input form that drives the pairing submit
 * flow. The form:
 *   - autofocuses the input on mount,
 *   - reads the current input value via ref (not stale useState),
 *     because userEvent.keyboard('CODE{Enter}') and a real wedge
 *     scanner both fire keys synchronously and React 19 batching
 *     would otherwise produce a stale read,
 *   - calls bridge.pairing.submit(value.trim()) once on Enter or click,
 *   - disables submit while in flight; re-enables after the result,
 *   - on outcome === 'success' navigates to /paired (replace=true).
 *
 * No outcome-specific user-facing copy in US2 — that is T074 / Phase
 * Final. The form is correct-but-coarse on failure.
 */

const SUCCESS_RESULT: PairingSubmitResult = {
  outcome: 'success',
  tenant_id: 'tenant-A',
  branch_id: 'branch-B',
  terminal_id: 'terminal-C',
  terminal_label: 'Counter 1',
};

interface BridgeFixture {
  bridge: PairingBridgeAPI;
  submit: ReturnType<typeof vi.fn<(code: string) => Promise<PairingSubmitResult>>>;
}

function makeBridge(
  opts: {
    result?: PairingSubmitResult;
    submitImpl?: (code: string) => Promise<PairingSubmitResult>;
  } = {},
): BridgeFixture {
  const submit = vi.fn<(code: string) => Promise<PairingSubmitResult>>(
    opts.submitImpl ?? (() => Promise.resolve(opts.result ?? SUCCESS_RESULT)),
  );
  // getStatus is fixture-only: the form does not call it. Reject loudly
  // if the form ever touches it so a regression fails fast.
  const getStatus = vi.fn<PairingBridgeAPI['getStatus']>(() => {
    return Promise.reject(new Error('PairingForm must not call getStatus'));
  });
  return { bridge: { submit, getStatus }, submit };
}

/**
 * Render `PairingForm` inside a memory router so `useNavigate()` has a
 * router context, plus a `<LocationProbe>` route that records the
 * current pathname into a captured array. Tests assert the probe's
 * recorded paths to verify navigation.
 */
function renderInRouter(bridge: PairingBridgeAPI): { locations: string[] } {
  const locations: string[] = [];
  function LocationProbe(): null {
    const loc = useLocation();
    locations.push(loc.pathname);
    return null;
  }
  render(
    <MemoryRouter initialEntries={['/pairing']}>
      <Routes>
        <Route
          path="/pairing"
          element={
            <>
              <PairingForm pairing={bridge} />
              <LocationProbe />
            </>
          }
        />
        <Route path="/paired" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return { locations };
}

afterEach(() => {
  cleanup();
});

describe('PairingForm — manual entry (T027)', () => {
  it('typing a code and pressing Enter calls pairing.submit exactly once with the typed string', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    const input = screen.getByRole('textbox');
    await user.type(input, 'VALIDCODE{Enter}');

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    expect(submit).toHaveBeenCalledWith('VALIDCODE');
  });

  it('clicking the submit button after typing also fires submit exactly once with the typed string', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), 'CLICKED');
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    expect(submit).toHaveBeenCalledWith('CLICKED');
  });

  it('disables the submit button while in flight and re-enables it after the result is in', async () => {
    const user = userEvent.setup();
    let resolveSubmit!: (v: PairingSubmitResult) => void;
    const pending = new Promise<PairingSubmitResult>((r) => {
      resolveSubmit = r;
    });
    const { bridge } = makeBridge({ submitImpl: () => pending });
    renderInRouter(bridge);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'CODE{Enter}');

    // After Enter fires, submit should be disabled while the bridge call
    // is in flight.
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    resolveSubmit({ outcome: 'unknown_error' }); // any non-success outcome
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it('trims the input before sending (whitespace around the code is dropped)', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), '  PADDED-CODE  {Enter}');

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    expect(submit).toHaveBeenCalledWith('PADDED-CODE');
  });
});

describe('PairingForm — wedge scanner (T028)', () => {
  it('userEvent.keyboard("VALIDCODE{Enter}") against the autofocused input fires submit once', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    // The input must already have focus on mount (autofocus). The
    // wedge scanner emits its keystrokes wherever focus is.
    const input = screen.getByRole('textbox');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // Drive without first calling user.click — that is the wedge sim.
    await user.keyboard('VALIDCODE{Enter}');

    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    expect(submit).toHaveBeenCalledWith('VALIDCODE');
  });

  it('does NOT submit on focus alone (no extra submit on autofocus)', async () => {
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    const input = screen.getByRole('textbox');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // Wait a tick to be sure no spurious submit fires from the focus
    // event — autofocus must not trigger a submit.
    await Promise.resolve();
    expect(submit).not.toHaveBeenCalled();
  });

  it('does NOT submit on partial input (no Enter, just keystrokes)', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    await user.keyboard('PARTIAL'); // no {Enter}
    expect(submit).not.toHaveBeenCalled();
  });

  it('empty Enter is a no-op (no bridge call)', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    await user.keyboard('{Enter}'); // empty input
    expect(submit).not.toHaveBeenCalled();
  });

  it('whitespace-only Enter is a no-op (trimmed to empty)', async () => {
    const user = userEvent.setup();
    const { bridge, submit } = makeBridge();
    renderInRouter(bridge);

    await user.keyboard('   {Enter}'); // whitespace then enter
    expect(submit).not.toHaveBeenCalled();
  });

  it('two consecutive Enters fire submit at most twice (no extra phantom submits)', async () => {
    // Edge: if the user double-taps Enter (or the wedge appends two
    // CRs), we accept up to two submits — but never more, and never
    // fewer than zero. The in-flight disable should suppress the
    // second one when the first has not yet resolved.
    const user = userEvent.setup();
    const resolves: Array<(v: PairingSubmitResult) => void> = [];
    const { bridge, submit } = makeBridge({
      submitImpl: () =>
        new Promise<PairingSubmitResult>((r) => {
          resolves.push(r);
        }),
    });
    renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), 'CODE');
    await user.keyboard('{Enter}{Enter}');

    // The second Enter happens while submit is in flight (first not
    // resolved). The form's in-flight guard should prevent a second
    // call.
    await waitFor(() => {
      expect(submit).toHaveBeenCalledTimes(1);
    });
    // Resolve so we can clean up; assert no further calls.
    resolves[0]?.({ outcome: 'unknown_error' });
    await Promise.resolve();
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('PairingForm — production fallback to window.api', () => {
  it('reads bridge from window.api when no `pairing` prop is provided', async () => {
    // Production wire-up path: PairingForm mounts inside the renderer
    // app where window.api is exposed by the preload script. We
    // simulate that here by setting window.api before mount.
    const user = userEvent.setup();
    const submit = vi.fn(() => Promise.resolve(SUCCESS_RESULT));
    const fakeApi = {
      ping: vi.fn(),
      appVersion: vi.fn(),
      log: vi.fn(),
      appConfig: vi.fn(),
      pairing: {
        getStatus: vi.fn(),
        submit,
      },
    };
    const original = (window as unknown as { api?: unknown }).api;
    (window as unknown as { api: typeof fakeApi }).api = fakeApi;
    try {
      render(
        <MemoryRouter initialEntries={['/pairing']}>
          {/* No `pairing` prop — must fall through to window.api */}
          <PairingForm />
        </MemoryRouter>,
      );
      await user.type(screen.getByRole('textbox'), 'CODE{Enter}');
      await waitFor(() => {
        expect(submit).toHaveBeenCalledWith('CODE');
      });
    } finally {
      if (original === undefined) delete (window as unknown as { api?: unknown }).api;
      else (window as unknown as { api?: unknown }).api = original;
    }
  });

  it('throws a clear error when no `pairing` prop AND window.api is missing', () => {
    const original = (window as unknown as { api?: unknown }).api;
    delete (window as unknown as { api?: unknown }).api;
    try {
      // happy-dom hides React's error boundary output; we catch via
      // try/render. React 19 surfaces hook-throw errors during render.
      expect(() => {
        render(
          <MemoryRouter initialEntries={['/pairing']}>
            <PairingForm />
          </MemoryRouter>,
        );
      }).toThrow(/window\.api missing/);
    } finally {
      if (original !== undefined) (window as unknown as { api?: unknown }).api = original;
    }
  });
});

describe('PairingForm — navigation on success (T034)', () => {
  it('on outcome=success: navigates to /paired exactly once', async () => {
    const user = userEvent.setup();
    const { bridge } = makeBridge({ result: SUCCESS_RESULT });
    const { locations } = renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), 'GOOD{Enter}');

    await waitFor(() => {
      expect(locations).toContain('/paired');
    });
    // /pairing -> /paired; the probe records both. /paired must appear
    // exactly once (replace:true means no extra hops).
    expect(locations.filter((p) => p === '/paired')).toHaveLength(1);
  });

  it('on outcome=network_error: stays on /pairing (does NOT navigate)', async () => {
    const user = userEvent.setup();
    const { bridge } = makeBridge({ result: { outcome: 'network_error' } });
    const { locations } = renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), 'CODE{Enter}');

    // Wait for the submit to settle (button re-enables).
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(locations).not.toContain('/paired');
  });

  it('on outcome=unknown_error: stays on /pairing and re-enables the form', async () => {
    const user = userEvent.setup();
    const { bridge } = makeBridge({ result: { outcome: 'unknown_error' } });
    const { locations } = renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), 'CODE{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(locations).not.toContain('/paired');
    // Form is editable again.
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  it('does NOT echo the pairing_code into the rendered tree on any outcome', async () => {
    // Defensive: the React state is allowed to hold the code for retry,
    // but the rendered DOM tree MUST NOT contain it as text.
    const user = userEvent.setup();
    const sentinel = 'TOP-SECRET-PAIR-CODE';
    const { bridge } = makeBridge({ result: { outcome: 'unknown_error' } });
    renderInRouter(bridge);

    await user.type(screen.getByRole('textbox'), `${sentinel}{Enter}`);
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    // The input is type="text" — its value attribute carries the code
    // for retry, which is expected. Assertion: no other DOM text node
    // contains the sentinel.
    // happy-dom always provides document.body; the closest('form') chain
    // is guaranteed by the test setup. We assert the form's container.
    const form = screen.getByRole('textbox').closest('form');
    if (!form) throw new Error('form not found in test DOM');
    const allText = (form.parentElement ?? form).textContent;
    expect(allText).not.toContain(sentinel);
  });
});
