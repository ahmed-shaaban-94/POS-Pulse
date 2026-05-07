import { describe, it, expect } from 'vitest';
import type { ErrorEvent, EventHint } from '@sentry/electron/renderer';

import { scrubRendererEvent } from '../sentry-renderer.js';
import { FORBIDDEN_PAYLOAD_KEYS } from '../../../shared/audit/forbidden-keys.js';

/**
 * 004-operator-session T050 — renderer-process Sentry scrubber coverage
 * for audit-event forbidden payload field names. Mirrors
 * `src/main/observability/__tests__/sentry-main-audit-redaction.test.ts`.
 *
 * The renderer scrubber is an independent surface (different
 * `@sentry/electron` module, different `ErrorEvent` type), so it gets
 * its own coverage. Audit payloads MAY reach Sentry via a future
 * `Sentry.setContext('audit', ...)` call from the renderer; the regex
 * extension and recursive walk MUST cover that path equally.
 *
 * If any assertion fails, tighten the SOURCE — never the test.
 */

function asEvent(partial: Partial<ErrorEvent>): ErrorEvent {
  return partial as unknown as ErrorEvent;
}

const NO_HINT: EventHint = {};
const SENTINEL = 'LEAKED-SECRET-VALUE-T050-SENTRY-RENDERER';

describe('scrubRendererEvent — audit-event forbidden-key denylist coverage (T050)', () => {
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    it(`strips top-level extra key '${key}'`, () => {
      const cleaned = scrubRendererEvent(
        asEvent({
          message: 'kept',
          extra: { [key]: SENTINEL, kept: 'ok' },
        }),
        NO_HINT,
      ) as { extra?: Record<string, unknown> };
      expect(cleaned.extra).toBeDefined();
      expect(cleaned.extra?.[key]).toBeUndefined();
      expect(cleaned.extra?.['kept']).toBe('ok');
    });

    it(`strips '${key}' from nested object inside extra (recursive walk)`, () => {
      const cleaned = scrubRendererEvent(
        asEvent({
          message: 'kept',
          extra: {
            audit: { event: { payload: { [key]: SENTINEL, ok: 'kept' } } },
          },
        }),
        NO_HINT,
      );
      const serialized = JSON.stringify(cleaned);
      expect(serialized).not.toContain(SENTINEL);
      expect(serialized).toContain('"ok":"kept"');
    });

    it(`strips '${key}' from nested object inside contexts (recursive walk)`, () => {
      const cleaned = scrubRendererEvent(
        asEvent({
          message: 'kept',
          contexts: {
            audit: { event: { payload: { [key]: SENTINEL, ok: 'kept' } } },
          },
        }),
        NO_HINT,
      );
      const serialized = JSON.stringify(cleaned);
      expect(serialized).not.toContain(SENTINEL);
      expect(serialized).toContain('"ok":"kept"');
    });
  }
});

describe('scrubRendererEvent — recursive scrub semantics (T050)', () => {
  it('strips denylisted keys at every depth in extra', () => {
    const cleaned = scrubRendererEvent(
      asEvent({
        message: 'kept',
        extra: {
          shallow_token: SENTINEL,
          level1: {
            mid_jwt: SENTINEL,
            level2: {
              deep_password: SENTINEL,
              kept: 'kept-deep',
            },
          },
        },
      }),
      NO_HINT,
    );
    const serialized = JSON.stringify(cleaned);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).toContain('kept-deep');
  });

  it('strips denylisted keys inside arrays of objects', () => {
    const cleaned = scrubRendererEvent(
      asEvent({
        message: 'kept',
        extra: {
          items: [{ token: SENTINEL, kept: 'one' }, { kept: 'two' }],
        },
      }),
      NO_HINT,
    );
    const serialized = JSON.stringify(cleaned);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).toContain('one');
    expect(serialized).toContain('two');
  });

  it('preserves nested non-sensitive structure intact', () => {
    const cleaned = scrubRendererEvent(
      asEvent({
        message: 'kept',
        extra: {
          audit: {
            event_id: 'evt-t050-0001',
            action_category: 'shift.forced_close',
            payload: {
              shift_id: 'shift-T050',
              forced_close_reason: 'cashier_no_show',
              annotation: 'manager closed at 18:05',
              password_hash: SENTINEL,
            },
          },
        },
      }),
      NO_HINT,
    ) as {
      extra?: {
        audit?: {
          event_id?: unknown;
          action_category?: unknown;
          payload?: Record<string, unknown>;
        };
      };
    };
    expect(cleaned.extra?.audit?.event_id).toBe('evt-t050-0001');
    expect(cleaned.extra?.audit?.action_category).toBe('shift.forced_close');
    expect(cleaned.extra?.audit?.payload?.['shift_id']).toBe('shift-T050');
    expect(cleaned.extra?.audit?.payload?.['password_hash']).toBeUndefined();
  });
});
