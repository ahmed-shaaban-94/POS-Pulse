/**
 * Contract: PreloadBridgeAPI
 *
 * The single, typed surface exposed by the preload script to the renderer via
 * Electron `contextBridge.exposeInMainWorld('api', …)`. Both the preload script
 * and the renderer import this interface so that:
 *
 *   - the preload script implements EXACTLY this surface, and
 *   - the renderer's `window.api` is typed as EXACTLY this surface.
 *
 * Any drift between the preload implementation and this interface MUST cause a
 * typecheck failure (which the CI gate catches).
 *
 * In feature 001-foundation this surface is intentionally minimal. Later
 * features extend it; they MUST do so by adding new methods here, never by
 * exposing untyped IPC channels.
 */
export interface PreloadBridgeAPI {
  /**
   * Stub method that establishes the request/response IPC pattern.
   * Returns the literal `"pong"` after a round-trip through the main process.
   * Used by the bridge-typing test in CI to prove the surface works end-to-end.
   */
  ping(): Promise<"pong">;

  /**
   * Returns the application version reported by the main process.
   * Used by the renderer to display version metadata once a UI exists.
   */
  appVersion(): Promise<string>;
}

declare global {
  interface Window {
    /**
     * The frozen, typed bridge surface. Renderer code reaches the main process
     * ONLY through `window.api`. Direct access to Node globals (`process`,
     * `require`, `Buffer`) is forbidden by `contextIsolation: true` and is
     * tested in `tests/renderer-isolation.test.ts`.
     */
    api: PreloadBridgeAPI;
  }
}
