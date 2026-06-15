import { describe, expect, it, vi } from 'vitest';

import {
  assertTrustedSender,
  createSenderGuardedIpcMain,
  UntrustedSenderError,
} from '../sender-guard.js';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';

/**
 * #370 (LOW hardening) — IPC sender-origin guard.
 *
 * Defense-in-depth on the renderer→main trust boundary: every `ipcMain.handle`
 * (and `.on`) handler should only run for an event whose sender frame is the
 * trusted renderer origin (the same `rendererOrigin` allow-list `createWindow`
 * uses for `will-navigate`). A frame whose URL is null, throws, or does not
 * start with the allowed origin is rejected fail-closed.
 *
 * Two units:
 *   • `assertTrustedSender(event, origin)` — the pure check (throws on untrusted).
 *   • `createSenderGuardedIpcMain(ipcMain, origin)` — wraps `handle`/`.on` so the
 *     guard runs BEFORE the real handler, with ZERO edits to the 12 registrars
 *     (they already take `ipcMain: IpcMain`; the composition root passes the
 *     guarded instance).
 */

/** Sentinel: a senderFrame whose getter throws (detached frame). */
const FRAME_THROWS = Symbol('frame-throws');

/** Build a fake invoke event with a senderFrame of the given url (or a throwing/null frame). */
function eventWithFrameUrl(url: string | null | typeof FRAME_THROWS): IpcMainInvokeEvent {
  if (url === FRAME_THROWS) {
    return {
      get senderFrame(): never {
        throw new Error('frame detached');
      },
    } as unknown as IpcMainInvokeEvent;
  }
  return {
    senderFrame: url === null ? null : { url },
  } as unknown as IpcMainInvokeEvent;
}

const PROD_ORIGIN = 'file:///C:/app/resources/app/dist/renderer/';
const DEV_ORIGIN = 'http://localhost:5173';

describe('#370 — assertTrustedSender (pure check)', () => {
  it('passes when the sender frame url starts with the trusted origin (prod file://)', () => {
    const event = eventWithFrameUrl(`${PROD_ORIGIN}index.html`);
    expect(() => {
      assertTrustedSender(event, PROD_ORIGIN);
    }).not.toThrow();
  });

  it('passes when the sender frame url starts with the trusted origin (dev localhost)', () => {
    const event = eventWithFrameUrl(`${DEV_ORIGIN}/index.html`);
    expect(() => {
      assertTrustedSender(event, DEV_ORIGIN);
    }).not.toThrow();
  });

  it('throws UntrustedSenderError when the url does not start with the origin', () => {
    const event = eventWithFrameUrl('https://evil.example/phish.html');
    expect(() => {
      assertTrustedSender(event, PROD_ORIGIN);
    }).toThrow(UntrustedSenderError);
  });

  it('throws (fail-closed) when senderFrame is null', () => {
    const event = eventWithFrameUrl(null);
    expect(() => {
      assertTrustedSender(event, PROD_ORIGIN);
    }).toThrow(UntrustedSenderError);
  });

  it('throws (fail-closed) when reading senderFrame throws (detached frame)', () => {
    const event = eventWithFrameUrl(FRAME_THROWS);
    expect(() => {
      assertTrustedSender(event, PROD_ORIGIN);
    }).toThrow(UntrustedSenderError);
  });

  it('does NOT leak the rejected url into the error message (no reflected sender url)', () => {
    const event = eventWithFrameUrl('https://evil.example/phish.html');
    try {
      assertTrustedSender(event, PROD_ORIGIN);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain('evil.example');
    }
  });

  it('matches across encoding divergence — spaces-in-path install (%20 vs space)', () => {
    // The load-bearing prod case: a real install under `C:\Program Files\` →
    // a file URL with spaces. If the trusted origin carries a literal space and
    // the sender frame carries `%20` (or vice-versa), a raw startsWith would
    // FAIL and brick every IPC. Both-sides `new URL().href` normalization makes
    // them match. We assert BOTH encodings of the same path are accepted.
    const spaced = 'file:///C:/Program Files/POS-Pulse/resources/app/dist/renderer/';
    const encoded = 'file:///C:/Program%20Files/POS-Pulse/resources/app/dist/renderer/';
    // trusted = spaced, sender = encoded child:
    expect(() => {
      assertTrustedSender(eventWithFrameUrl(`${encoded}index.html`), spaced);
    }).not.toThrow();
    // trusted = encoded, sender = spaced child:
    expect(() => {
      assertTrustedSender(eventWithFrameUrl(`${spaced}index.html`), encoded);
    }).not.toThrow();
  });

  it('still rejects a different path under the same drive (no over-broad match)', () => {
    const trusted = 'file:///C:/Program Files/POS-Pulse/resources/app/dist/renderer/';
    // A sibling dir that shares a prefix up to a path segment boundary must NOT match.
    const sneaky = 'file:///C:/Program Files/POS-Pulse-EVIL/resources/app/dist/renderer/index.html';
    expect(() => {
      assertTrustedSender(eventWithFrameUrl(sneaky), trusted);
    }).toThrow(UntrustedSenderError);
  });
});

describe('#370 — createSenderGuardedIpcMain (wrap-once)', () => {
  it('runs the guard BEFORE the wrapped handle handler; trusted sender → handler runs', async () => {
    const realHandle = vi.fn();
    const fakeIpcMain = { handle: realHandle, on: vi.fn() } as unknown as IpcMain;
    const guarded = createSenderGuardedIpcMain(fakeIpcMain, PROD_ORIGIN);

    const userHandler = vi.fn(() => 'ok');
    guarded.handle('test:channel', userHandler);

    // The guard registered a WRAPPED handler on the real ipcMain.
    expect(realHandle).toHaveBeenCalledOnce();
    const channel = realHandle.mock.calls[0]?.[0] as string;
    const wrapped = realHandle.mock.calls[0]?.[1] as (
      e: IpcMainInvokeEvent,
      ...a: unknown[]
    ) => unknown;
    expect(channel).toBe('test:channel');

    const trustedEvent = eventWithFrameUrl(`${PROD_ORIGIN}index.html`);
    const result = await wrapped(trustedEvent, 'arg1');
    expect(userHandler).toHaveBeenCalledWith(trustedEvent, 'arg1');
    expect(result).toBe('ok');
  });

  it('blocks the wrapped handle handler for an untrusted sender (handler never runs, throws)', async () => {
    const realHandle = vi.fn();
    const fakeIpcMain = { handle: realHandle, on: vi.fn() } as unknown as IpcMain;
    const guarded = createSenderGuardedIpcMain(fakeIpcMain, PROD_ORIGIN);

    const userHandler = vi.fn(() => 'ok');
    guarded.handle('test:channel', userHandler);
    const wrapped = realHandle.mock.calls[0]?.[1] as (e: IpcMainInvokeEvent) => Promise<unknown>;

    const evilEvent = eventWithFrameUrl('https://evil.example/x');
    await expect(wrapped(evilEvent)).rejects.toThrow(UntrustedSenderError);
    expect(userHandler).not.toHaveBeenCalled();
  });

  it('wraps `.on` listeners too (a future fire-and-forget channel stays guarded)', () => {
    const realOn = vi.fn();
    const fakeIpcMain = { handle: vi.fn(), on: realOn } as unknown as IpcMain;
    const guarded = createSenderGuardedIpcMain(fakeIpcMain, PROD_ORIGIN);

    const listener = vi.fn();
    guarded.on('evt:channel', listener);
    expect(realOn).toHaveBeenCalledOnce();
    const wrapped = realOn.mock.calls[0]?.[1] as (e: unknown, ...a: unknown[]) => void;

    // Untrusted → listener never runs (fail-closed; .on cannot reject, so it no-ops).
    wrapped(eventWithFrameUrl('https://evil.example/x'));
    expect(listener).not.toHaveBeenCalled();

    // Trusted → listener runs.
    const trusted = eventWithFrameUrl(`${PROD_ORIGIN}x`);
    wrapped(trusted, 'payload');
    expect(listener).toHaveBeenCalledWith(trusted, 'payload');
  });
});
