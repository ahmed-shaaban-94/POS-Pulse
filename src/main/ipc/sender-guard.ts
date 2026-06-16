import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

/**
 * #370 (LOW hardening) — IPC sender-origin guard (defense-in-depth).
 *
 * Every `ipcMain.handle` / `.on` handler trusts that its event came from OUR
 * renderer. With `contextIsolation` + `sandbox` + the `will-navigate` /
 * `setWindowOpenHandler` locks in `createWindow`, a hostile frame should never
 * reach the bridge — but a single misconfiguration (a stray webview, a future
 * `<iframe>`, a navigation bug) would expose the whole IPC surface. This guard
 * is the belt to that braces: before any handler runs, assert the event's
 * sender FRAME url is the trusted renderer origin (the SAME `rendererOrigin`
 * allow-list `createWindow` already compares against for `will-navigate`).
 *
 * Fail-closed: a null `senderFrame`, a getter that throws (detached frame), or
 * a url that does not start with the trusted origin is REJECTED. The rejected
 * url is never reflected into the error (no information leak).
 *
 * Wired once at the composition root: `index.ts` builds
 * `createSenderGuardedIpcMain(ipcMain, rendererOrigin)` and passes the guarded
 * instance to the ~12 `register…(ipcMain, …)` calls — ZERO edits to the
 * registrars (they already take `ipcMain: IpcMain`). The wrapper covers both
 * `handle` (invoke/response) and `on` (fire-and-forget) so a future `.on`
 * channel is guarded by construction. (As of this change there are zero `.on`
 * registrations — verified by grep — but the wrapper covers them regardless.)
 */

/** Thrown when an IPC event's sender frame is not the trusted renderer origin. */
export class UntrustedSenderError extends Error {
  constructor() {
    // Deliberately generic — never reflect the rejected sender url (no leak).
    super('ipc: rejected event from an untrusted sender frame');
    this.name = 'UntrustedSenderError';
  }
}

/**
 * Canonicalize a URL string via `new URL(x).href` so two encodings of the SAME
 * url collapse to one form. Load-bearing for the prod `file://` match: a real
 * install path with spaces (`C:\Program Files\POS-Pulse\`) is percent-encoded
 * (`%20`) in a file URL, and `pathToFileURL`'s encoding need not byte-match
 * Electron's `senderFrame.url` encoding. Running BOTH sides through the SAME
 * `new URL().href` makes any such divergence cancel by construction, instead of
 * a raw `startsWith` bricking every IPC when the encodings differ (fail-closed
 * → every invoke rejects → app unusable). Returns null on an unparseable url
 * (treated as untrusted). NOTE: `file://` URLs have a null `.origin`, so we
 * compare normalized `.href` prefixes, never `.origin`.
 */
function canonicalUrl(raw: string): string | null {
  try {
    return new URL(raw).href;
  } catch {
    return null;
  }
}

/**
 * Assert the event's sender frame url is the trusted renderer origin.
 * Throws `UntrustedSenderError` (fail-closed) on null/throwing/unparseable frame
 * or mismatch. Pure: no I/O, no logging — the caller decides how to react.
 */
export function assertTrustedSender(
  event: IpcMainInvokeEvent | IpcMainEvent,
  trustedOrigin: string,
): void {
  let rawUrl: string | null;
  try {
    // `senderFrame` can be null (frame gone) or its access can throw (detached).
    rawUrl = event.senderFrame?.url ?? null;
  } catch {
    throw new UntrustedSenderError();
  }
  if (rawUrl === null) throw new UntrustedSenderError();

  // Normalize BOTH sides identically so encoding divergence (e.g. %20 in a
  // spaces-in-path install) cancels rather than bricks. An unparseable trusted
  // origin or sender url is untrusted (fail-closed).
  const sender = canonicalUrl(rawUrl);
  const trusted = canonicalUrl(trustedOrigin);
  if (sender === null || trusted === null || !sender.startsWith(trusted)) {
    throw new UntrustedSenderError();
  }
}

/** The subset of `IpcMain` the guard wraps. */
type GuardableIpcMain = Pick<IpcMain, 'handle' | 'on'>;

/**
 * Wrap an `IpcMain` so every `handle`/`on` runs `assertTrustedSender` BEFORE the
 * real handler. Returns an object structurally compatible with `IpcMain` for the
 * methods the registrars use; non-wrapped members pass through via a Proxy so the
 * guarded instance is a drop-in for `IpcMain`.
 */
export function createSenderGuardedIpcMain(ipcMain: IpcMain, trustedOrigin: string): IpcMain {
  const overrides: GuardableIpcMain = {
    handle(channel, listener) {
      ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
        // Throw on an untrusted sender — `handle` surfaces it as a rejected
        // invoke in the renderer (the handler never runs). `await` so an async
        // listener's rejection propagates as the invoke's rejection.
        assertTrustedSender(event, trustedOrigin);
        const fn = listener as (e: IpcMainInvokeEvent, ...a: unknown[]) => unknown;
        return await fn(event, ...args);
      });
    },
    on(channel, listener) {
      ipcMain.on(channel, (event: IpcMainEvent, ...args: unknown[]) => {
        // `.on` has no return channel; a throw would be unhandled, so fail-closed
        // by NO-OP (drop the event) for an untrusted sender.
        try {
          assertTrustedSender(event, trustedOrigin);
        } catch {
          return;
        }
        const fn = listener as (e: IpcMainEvent, ...a: unknown[]) => void;
        fn(event, ...args);
      });
      return ipcMain;
    },
  };

  return new Proxy(ipcMain, {
    get(target, prop, receiver): unknown {
      if (prop === 'handle' || prop === 'on') {
        return overrides[prop];
      }
      const value: unknown = Reflect.get(target, prop, receiver);
      // Bind methods to the real ipcMain so `this` stays correct when called
      // through the proxy (e.g. removeHandler, emit).
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}
