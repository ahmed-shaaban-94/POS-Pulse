import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * 004-operator-session — bootstrap-wires-operator guard.
 *
 * Asserts that `src/main/index.ts` imports and calls
 * `registerOperatorHandlers`, constructs the production
 * `ClerkExchanger` and `BackendClient`, and starts the
 * `InactivityMonitor`. A pure static check: importing `src/main/
 * index.ts` for runtime testing requires the Electron `app` /
 * `BrowserWindow` globals (the file invokes `app.whenReady()` at
 * module load), which are not available in vitest's `node` /
 * `happy-dom` environments.
 *
 * If a future contributor removes any of these wires, this guard
 * fails — and `/sign-in` would silently break end-to-end (an
 * `operator:*` IPC channel without a registered handler rejects
 * with "no handler for channel" at the bridge boundary).
 */

const INDEX_PATH = resolve(__dirname, '../index.ts');

describe('main/index.ts wires the operator namespace (004 S1)', () => {
  const source = readFileSync(INDEX_PATH, 'utf-8');

  it('imports registerOperatorHandlers from ./ipc/operator', () => {
    expect(source).toMatch(
      /import\s+\{\s*registerOperatorHandlers\s*\}\s+from\s+'\.\/ipc\/operator/,
    );
  });

  it('imports the production ClerkExchanger factory', () => {
    expect(source).toContain('createClerkExchanger');
    expect(source).toContain("from './operator/clerk-client.js'");
  });

  it('imports the production BackendClient factory', () => {
    expect(source).toContain('createBackendClient');
    expect(source).toContain("from './operator/backend-client.js'");
  });

  it('imports the SessionManager, SignInHandler, SignOutHandler, InactivityMonitor', () => {
    expect(source).toContain('SessionManager');
    expect(source).toContain('SignInHandler');
    expect(source).toContain('SignOutHandler');
    expect(source).toContain('InactivityMonitor');
    expect(source).toContain("from './operator/session-manager.js'");
    expect(source).toContain("from './operator/sign-in-handler.js'");
    expect(source).toContain("from './operator/sign-out-handler.js'");
    expect(source).toContain("from './operator/inactivity-monitor.js'");
  });

  it('imports the JwtHolder factory', () => {
    expect(source).toContain('createJwtHolder');
    expect(source).toContain("from './operator/jwt-holder.js'");
  });

  it('calls registerOperatorHandlers (the load-bearing call site)', () => {
    expect(source).toMatch(/registerOperatorHandlers\(\s*ipcMain\s*,/);
  });

  it('starts the inactivity monitor', () => {
    expect(source).toMatch(/operatorInactivityMonitor\.start\(\)/);
  });

  it('reads CLERK_PUBLISHABLE_KEY from process.env (publishable, not secret)', () => {
    expect(source).toContain("process.env['CLERK_PUBLISHABLE_KEY']");
  });

  it('does NOT import @clerk/clerk-js (browser-only SDK; main uses Frontend API REST)', () => {
    expect(source).not.toMatch(/from\s+['"]@clerk\/clerk-js['"]/);
  });
});
