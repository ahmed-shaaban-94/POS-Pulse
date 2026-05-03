import type { JSX } from 'react';

import { AppRouter } from './router';
import type { PreloadBridgeAPI } from '../shared/bridge-api';

/**
 * 002-terminal-pairing T016 — App root.
 *
 * Replaces the blank Phase 2 stub with the boot router. The pairing
 * bridge is read from `window.api`; tests render `AppRouter` directly
 * with an injected bridge, so this component stays a one-liner.
 */
export default function App(): JSX.Element {
  const bridge = (window as unknown as { api: PreloadBridgeAPI }).api;
  return <AppRouter pairing={bridge.pairing} />;
}
