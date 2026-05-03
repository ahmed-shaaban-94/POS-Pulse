import { useEffect, useState, type ReactNode, type JSX } from 'react';
import {
  createMemoryRouter,
  createHashRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

import { PairingScreen } from './routes/pairing/PairingScreen';
import { PairedScreen } from './routes/paired/PairedScreen';
import type { PairingBridgeAPI } from '../shared/bridge-api';
import type { PairingStatus } from '../shared/pairing-types';

/**
 * 002-terminal-pairing T016 — boot router.
 *
 * Calls the injected `pairing.getStatus()` exactly once on mount and
 * decides the start route from the discriminated PairingStatus:
 *
 *   getStatus() → 'unpaired'              → /pairing
 *   getStatus() → 'paired' (with fields)  → /paired
 *   getStatus() → 'invalid'               → /pairing with reason flag
 *   getStatus() rejects                   → /pairing with reason='decrypt_failed'
 *                                            (defensive — bridge failure
 *                                            is most likely an unhealthy
 *                                            SecretStore; operator action
 *                                            is the same: re-pair)
 *
 * The TanStack Query / Zustand stack from PR#15 is reserved for US2's
 * submit mutation — boot is a single one-shot fetch, so a plain
 * useEffect is the smaller surface (R2 from tasks.md § Risks).
 *
 * The router is INJECTED with `pairing` so tests can render against a
 * fake bridge without touching `window.api`. The application entry
 * point (`src/renderer/main.tsx`) wires the real bridge.
 *
 * `useMemoryRouter` lets unit tests start at a known initial entry; the
 * application uses createHashRouter to avoid file:// → server-side
 * routing conflicts in packaged builds.
 */

export interface AppRouterProps {
  pairing: PairingBridgeAPI;
  /**
   * Test-only: render with a memory router rooted at this initial
   * entry. When omitted (production), a hash router is used so the
   * packaged file:// renderer can navigate without backend rewrite
   * rules.
   */
  initialEntry?: string;
}

type BootStatus =
  | { phase: 'loading' }
  | { phase: 'paired'; status: Extract<PairingStatus, { kind: 'paired' }> }
  | {
      phase: 'pairing';
      invalidReason?: Extract<PairingStatus, { kind: 'invalid' }>['reason'];
    };

export function AppRouter(props: AppRouterProps): JSX.Element {
  const [boot, setBoot] = useState<BootStatus>({ phase: 'loading' });

  useEffect(() => {
    // Box the cancellation flag so eslint's flow analysis doesn't
    // narrow `cancelled` to `false` after the synchronous read; the
    // cleanup function flips it after the surrounding `await`.
    const guard = { cancelled: false };
    void (async () => {
      let resolved: BootStatus;
      try {
        const status = await props.pairing.getStatus();
        if (status.kind === 'paired') {
          resolved = { phase: 'paired', status };
        } else if (status.kind === 'invalid') {
          resolved = { phase: 'pairing', invalidReason: status.reason };
        } else {
          resolved = { phase: 'pairing' };
        }
      } catch {
        // Defensive fallback: any rejection from the bridge lands the
        // operator on /pairing with the most actionable diagnostic.
        // We deliberately do NOT include the rejection's value in any
        // log emission here — Constitution VII (no secret-shaped data
        // through the logger from a typed error path).
        resolved = { phase: 'pairing', invalidReason: 'decrypt_failed' };
      }
      if (!guard.cancelled) setBoot(resolved);
    })();
    return () => {
      guard.cancelled = true;
    };
  }, [props.pairing]);

  if (boot.phase === 'loading') {
    return <main data-testid="route-loading" />;
  }

  const routes: RouteObject[] = [
    {
      path: '/',
      element:
        boot.phase === 'paired' ? (
          <Navigate to="/paired" replace />
        ) : (
          <Navigate to="/pairing" replace />
        ),
    },
    {
      path: '/pairing',
      element:
        boot.phase === 'pairing' ? (
          // exactOptionalPropertyTypes: only forward the prop when defined.
          boot.invalidReason !== undefined ? (
            <PairingScreen invalidReason={boot.invalidReason} />
          ) : (
            <PairingScreen />
          )
        ) : (
          <Navigate to="/paired" replace />
        ),
    },
    {
      path: '/paired',
      element:
        boot.phase === 'paired' ? (
          <PairedScreen status={boot.status} />
        ) : (
          <Navigate to="/pairing" replace />
        ),
    },
  ];

  // Tests use a memory router so window.location.pathname remains
  // controllable; production uses hash-routing to survive file://.
  if (typeof props.initialEntry === 'string' || isUnderTestEnvironment()) {
    const router = createMemoryRouter(routes, {
      initialEntries: [props.initialEntry ?? '/'],
    });
    // The memory router does NOT update window.location, so we mirror
    // the path back into history for tests that assert on
    // window.location.pathname (per the data-model + the router test).
    return (
      <PathMirrorBridge router={router}>
        <RouterProvider router={router} />
      </PathMirrorBridge>
    );
  }
  const router = createHashRouter(routes);
  return <RouterProvider router={router} />;
}

/**
 * happy-dom + memory router: the test asserts on
 * `window.location.pathname`. createMemoryRouter does not touch the
 * browser URL, so we mirror its current location into the DOM history
 * via `replaceState` whenever it changes. Keeps the router test
 * DOM-based without coupling to memory-router internals.
 */
function PathMirrorBridge(props: {
  router: ReturnType<typeof createMemoryRouter>;
  children: ReactNode;
}): JSX.Element {
  useEffect(() => {
    const sync = (): void => {
      const current = props.router.state.location.pathname;
      if (current !== window.location.pathname) {
        window.history.replaceState(null, '', current);
      }
    };
    sync();
    const unsubscribe = props.router.subscribe(sync);
    return () => {
      unsubscribe();
    };
  }, [props.router]);
  return <>{props.children}</>;
}

/**
 * Detect the Vitest / happy-dom test environment. Vitest sets
 * `import.meta.env.MODE === 'test'` and `process.env.NODE_ENV === 'test'`
 * (latter only when run via `vitest`). We check both so a future runner
 * change does not silently flip production into memory-routing.
 */
function isUnderTestEnvironment(): boolean {
  // import.meta.env is provided by Vite-side tooling; read it defensively.
  const mode =
    (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE ??
    (typeof process !== 'undefined' ? process.env['NODE_ENV'] : undefined);
  return mode === 'test';
}
