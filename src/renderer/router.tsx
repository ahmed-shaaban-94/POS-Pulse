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
import { AppShell } from './shell/AppShell';
import { DashboardPlaceholder } from './routes/app/DashboardPlaceholder';
import { SalesPlaceholder } from './routes/app/SalesPlaceholder';
import { CartPlaceholder } from './routes/app/CartPlaceholder';
import { InventoryPlaceholder } from './routes/app/InventoryPlaceholder';
import { SettingsHelpPlaceholder } from './routes/app/SettingsHelpPlaceholder';
import { CheckoutPlaceholder } from './routes/app/checkout/CheckoutPlaceholder';
import { SignInRoute } from './routes/sign-in';
import { OperatorRouteGuard } from './routes/operator-route-guard';
import type { OperatorBridgeAPI, PairingBridgeAPI } from '../shared/bridge-api';
import type { PairingStatus } from '../shared/pairing-types';

/**
 * 002-terminal-pairing T016 + T034 — boot router.
 *
 * Calls the injected `pairing.getStatus()` exactly once on mount to
 * decide the START route, then routes are purely path-based:
 *
 *   getStatus() → 'unpaired'              → start at /pairing
 *   getStatus() → 'paired' (with fields)  → start at /paired
 *   getStatus() → 'invalid'               → start at /pairing with reason flag
 *   getStatus() rejects                   → start at /pairing with reason='decrypt_failed'
 *                                            (defensive — bridge failure
 *                                            is most likely an unhealthy
 *                                            SecretStore; operator action
 *                                            is the same: re-pair)
 *
 * After the initial routing decision, navigation is path-driven. The
 * `/paired` route mounts PairedScreen which self-fetches via
 * `getStatus()` and redirects back to `/pairing` on a non-paired
 * status — so a stale boot state cannot strand the operator. T034:
 * after a successful submit, PairingForm calls `navigate('/paired')`,
 * PairedScreen mounts, re-fetches, and shows the fresh assignment.
 *
 * The pairing bridge is INJECTED so tests can render against a fake
 * bridge without touching `window.api`. The application entry point
 * (`src/renderer/main.tsx`) wires the real bridge.
 *
 * `createMemoryRouter` lets unit tests start at a known initial entry;
 * the application uses createHashRouter to avoid file:// → server-side
 * routing conflicts in packaged builds.
 */

export interface AppRouterProps {
  pairing: PairingBridgeAPI;
  /**
   * 004-operator-session T032 — operator bridge for the `/sign-in`
   * route. Optional so existing 002 / 003 callers (and tests rooted
   * at /pairing or /paired) keep their current shape; production
   * (`src/renderer/App.tsx`) wires the real bridge.
   */
  operator?: OperatorBridgeAPI;
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
  | {
      phase: 'ready';
      startPath: '/pairing' | '/paired';
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
          resolved = { phase: 'ready', startPath: '/paired' };
        } else if (status.kind === 'invalid') {
          resolved = { phase: 'ready', startPath: '/pairing', invalidReason: status.reason };
        } else {
          resolved = { phase: 'ready', startPath: '/pairing' };
        }
      } catch {
        // Defensive fallback: any rejection from the bridge lands the
        // operator on /pairing with the most actionable diagnostic.
        // We deliberately do NOT include the rejection's value in any
        // log emission here — Constitution VII (no secret-shaped data
        // through the logger from a typed error path).
        resolved = { phase: 'ready', startPath: '/pairing', invalidReason: 'decrypt_failed' };
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

  // T034: routes are purely path-based after the initial decision.
  // PairingForm.navigate('/paired') on success lands on PairedScreen,
  // which self-fetches and shows the fresh assignment. PairedScreen
  // redirects back to /pairing on its own if the status it reads is
  // not 'paired' — so a stale boot state cannot strand the operator.
  const pairingScreenElement =
    boot.invalidReason !== undefined ? (
      <PairingScreen pairing={props.pairing} invalidReason={boot.invalidReason} />
    ) : (
      <PairingScreen pairing={props.pairing} />
    );
  // T035 — /app/* parent route wired per contracts/shell-routes.ts.
  // Existing /pairing and /paired routes are unchanged.
  // Pairing-bypass guard (T007) stays green: unpaired/invalid terminals
  // still route to /pairing and cannot reach /app/* directly.
  // 004-operator-session T032: `/sign-in` mounts above `/app/*`. The
  // shell is wrapped in `<OperatorRouteGuard>` (no `allow` filter at
  // S1 — any signed-in role passes; per-route role gating lands with
  // the manager-only surfaces in S4 / S5). Any deep-link to `/app/*`
  // without an operator session redirects to `/sign-in` (FR-005).
  //
  // The operator bridge is optional on AppRouterProps so existing 002
  // / 003 callers keep working. When it's present, `/sign-in` is
  // mounted; when absent, the route falls back to a redirect to the
  // start path (test scenarios that don't exercise sign-in stay
  // green).
  const signInElement =
    props.operator !== undefined ? (
      <SignInRoute operator={props.operator} />
    ) : (
      <Navigate to={boot.startPath} replace />
    );

  const guardedShell =
    props.operator !== undefined ? (
      <OperatorRouteGuard>
        <AppShell />
      </OperatorRouteGuard>
    ) : (
      <AppShell />
    );

  const routes: RouteObject[] = [
    { path: '/', element: <Navigate to={boot.startPath} replace /> },
    { path: '/pairing', element: pairingScreenElement },
    { path: '/paired', element: <PairedScreen pairing={props.pairing} /> },
    { path: '/sign-in', element: signInElement },
    {
      path: '/app',
      element: guardedShell,
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPlaceholder /> },
        { path: 'sales', element: <SalesPlaceholder /> },
        { path: 'cart', element: <CartPlaceholder /> },
        { path: 'checkout', element: <CheckoutPlaceholder /> },
        { path: 'inventory', element: <InventoryPlaceholder /> },
        { path: 'settings', element: <SettingsHelpPlaceholder /> },
      ],
    },
  ];

  // Tests use a memory router so window.location.pathname remains
  // controllable; production uses hash-routing to survive file://.
  if (typeof props.initialEntry === 'string' || isUnderTestEnvironment()) {
    const initialEntry = props.initialEntry ?? '/';
    const router = createMemoryRouter(routes, {
      initialEntries: [initialEntry],
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
  // Production-only branch — covered by the manual Electron smoke (T035)
  // and by the CI package:dir build. Vitest always returns true from
  // isUnderTestEnvironment(), so this branch is never exercised in unit
  // tests; v8-ignore to keep coverage honest about what unit tests
  // actually cover.
  /* v8 ignore start */
  const router = createHashRouter(routes);
  return <RouterProvider router={router} />;
  /* v8 ignore stop */
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
      // Guard against an infinite update loop if the memory router and
      // the DOM history are already in sync (e.g., on the very first
      // sync call after mount).
      /* v8 ignore next 3 */
      if (current === window.location.pathname) {
        return;
      }
      window.history.replaceState(null, '', current);
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
  // The `?? process.env.NODE_ENV` fallback is a production-only safety
  // net — under Vitest, `import.meta.env.MODE` is always set, so the
  // right side of the `??` never executes in tests.
  /* v8 ignore next 4 */
  const mode =
    (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE ??
    (typeof process !== 'undefined' ? process.env['NODE_ENV'] : undefined);
  return mode === 'test';
}
