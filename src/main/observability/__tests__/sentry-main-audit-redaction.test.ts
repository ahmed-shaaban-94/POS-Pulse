import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/electron/main';

import { scrubEvent } from '../sentry-main.js';
import { FORBIDDEN_PAYLOAD_KEYS } from '../../../shared/audit/forbidden-keys.js';

/**
 * 004-operator-session T050 — main-process Sentry scrubber coverage for
 * audit-event forbidden payload field names.
 *
 * Two new guarantees beyond Phase 9 / US7's baseline:
 *
 *   1. **Audit-key denylist coverage**. Every name in
 *      `FORBIDDEN_PAYLOAD_KEYS` (raw cardholder data, full PII, credential
 *      fragments, PIN values, Clerk JWTs, session tokens, device-token
 *      attestations, pairing codes) is matched by the extended denylist
 *      regex (`pin|jwt|clerk|auth` additions on top of the original set).
 *
 *   2. **Recursive scrubbing**. The prior shape was shallow — only the
 *      top-level keys of `extra` and each `contexts[name]` bag were
 *      inspected. Audit payloads are nested objects, so any caller doing
 *      `Sentry.setContext('audit', { event: { payload: { ... } } })`
 *      would have leaked. T050 walks the tree.
 *
 * If any assertion fails, tighten the SOURCE — never the test.
 */

function asEvent(partial: Partial<ErrorEvent>): ErrorEvent {
  return partial as unknown as ErrorEvent;
}

const SENTINEL = 'LEAKED-SECRET-VALUE-T050-SENTRY-MAIN';

describe('scrubEvent — audit-event forbidden-key denylist coverage (T050)', () => {
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    it(`strips top-level extra key '${key}'`, () => {
      const cleaned = scrubEvent(
        asEvent({
          message: 'kept',
          extra: { [key]: SENTINEL, kept: 'ok' },
        }),
      ) as { extra?: Record<string, unknown> };
      expect(cleaned.extra).toBeDefined();
      expect(cleaned.extra?.[key]).toBeUndefined();
      expect(cleaned.extra?.['kept']).toBe('ok');
    });

    it(`strips '${key}' from nested object inside extra (recursive walk)`, () => {
      const cleaned = scrubEvent(
        asEvent({
          message: 'kept',
          extra: {
            audit: { event: { payload: { [key]: SENTINEL, ok: 'kept' } } },
          },
        }),
      );
      const serialized = JSON.stringify(cleaned);
      expect(serialized).not.toContain(SENTINEL);
      expect(serialized).toContain('"ok":"kept"');
    });

    it(`strips '${key}' from nested object inside contexts (recursive walk)`, () => {
      const cleaned = scrubEvent(
        asEvent({
          message: 'kept',
          contexts: {
            audit: { event: { payload: { [key]: SENTINEL, ok: 'kept' } } },
          },
        }),
      );
      const serialized = JSON.stringify(cleaned);
      expect(serialized).not.toContain(SENTINEL);
      expect(serialized).toContain('"ok":"kept"');
    });
  }
});

describe('scrubEvent — recursive scrub semantics (T050)', () => {
  it('strips denylisted keys at every depth in extra', () => {
    const cleaned = scrubEvent(
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
    );
    const serialized = JSON.stringify(cleaned);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).toContain('kept-deep');
  });

  it('strips denylisted keys inside arrays of objects', () => {
    const cleaned = scrubEvent(
      asEvent({
        message: 'kept',
        extra: {
          items: [{ token: SENTINEL, kept: 'one' }, { kept: 'two' }],
        },
      }),
    );
    const serialized = JSON.stringify(cleaned);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).toContain('one');
    expect(serialized).toContain('two');
  });

  it('preserves nested non-sensitive structure intact', () => {
    // After scrubbing, the surrounding tree shape MUST be preserved so
    // Sentry events remain useful for triage (audit envelope IDs survive,
    // only the credential leaf is gone).
    const cleaned = scrubEvent(
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
    expect(cleaned.extra?.audit?.payload?.['forced_close_reason']).toBe('cashier_no_show');
    expect(cleaned.extra?.audit?.payload?.['annotation']).toBe('manager closed at 18:05');
    expect(cleaned.extra?.audit?.payload?.['password_hash']).toBeUndefined();
  });

  it('null and primitives in nested values do not crash the walker', () => {
    const cleaned = scrubEvent(
      asEvent({
        message: 'kept',
        extra: {
          a: null,
          b: 42,
          c: 'string',
          d: true,
          e: { nested: null, leaf: 'kept' },
        },
      }),
    ) as { extra?: Record<string, unknown> };
    expect(cleaned.extra?.['a']).toBeNull();
    expect(cleaned.extra?.['b']).toBe(42);
    expect(cleaned.extra?.['c']).toBe('string');
    expect(cleaned.extra?.['d']).toBe(true);
    expect((cleaned.extra?.['e'] as Record<string, unknown>)['leaf']).toBe('kept');
  });
});
