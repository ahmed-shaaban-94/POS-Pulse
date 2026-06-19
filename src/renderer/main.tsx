import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/electron/renderer';
import type { BrowserOptions } from '@sentry/electron/renderer';
import App from './App';
import { initSentryRenderer } from './observability/sentry-renderer';
import './styles/tailwind.css';
import type { PreloadBridgeAPI } from '../shared/bridge-api';
import { useFeatureFlagsStore } from './stores/feature-flags-store';
import { installCartStoreSignOutHook } from './stores/cart-signout-hook';
import { initTheme } from './stores/theme-store';

/**
 * T068 — initialise renderer-side Sentry BEFORE React mounts.
 *
 * Fire-and-forget: the bridge call is async, but we don't block React
 * mounting on it. With no DSN configured, init is a no-op; with an
 * invalid DSN, the throw is swallowed and a single console.warn fires.
 * Either way, the app launches normally (AS-8).
 *
 * The renderer SDK marks `dsn`/`release` as "should only be set in
 * main", but we pass them anyway because AS-8 reasons about the
 * renderer's init posture independently. We cast the `init` reference
 * — not the argument — so the call site is type-safe.
 */
// POS v3.5 Phase 1 (ADR-0004) — reconcile the theme store + document root
// with the persisted selection BEFORE React mounts. index.html bakes the
// `data-theme="dark"` default for a flash-free dark boot; this only repaints
// to `light` for operators who chose it. Side-effect-isolated + DOM-guarded,
// so it is safe ahead of the Sentry/flag bootstrap.
initTheme();

const sentryInit = Sentry.init as unknown as (opts: BrowserOptions) => void;

// Narrow `window.api` explicitly so ESLint's no-unsafe-call rule doesn't
// trip on the augmented global (the augmentation works at runtime; the
// inline annotation just makes the type flow obvious to the lint pass).
const bridge = (window as unknown as { api: PreloadBridgeAPI }).api;

void initSentryRenderer({
  sentryInit,
  fetchConfig: () => bridge.appConfig(),
  console: window.console,
  appVersion: '0.1.0',
});

// 005-sales-cart T001 — hydrate feature flags from main once at boot.
// Failures are non-fatal: flags remain at fail-closed defaults.
void bridge
  .appConfig()
  .then((cfg) => {
    useFeatureFlagsStore.getState().hydrate(cfg.features ?? {});
  })
  .catch(() => undefined);

// 005-sales-cart Q3 — discard cart draft when operator session ends.
installCartStoreSignOutHook();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in DOM');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
