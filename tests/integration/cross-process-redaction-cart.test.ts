import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';

import { createLogger, type PinoRollFactory } from '../../src/main/logging/logger.js';

/**
 * T024 — Cross-process redaction smoke (005-sales-cart extension).
 *
 * Mirrors the 002 + 004 redaction tests (NFR-006). For 005 the cart
 * payload allowlist is the set of cart-line / cart-action payload fields
 * that may carry free-text or sensitive operator identity fragments and
 * MUST be scrubbed at every reachable nesting depth in any pino log line.
 *
 * Cart-specific keys covered:
 *   - `note`               — free-text item-line note (Q1 ≤ 200 chars); PII risk.
 *   - `attribution_operator_id` — manager identity; cashier-forbidden info.
 *
 * Existing forbidden-key coverage from 004 (`pin`, `clerk_jwt`, etc.) is
 * unchanged. This test verifies the cart-extension keys are also scrubbed.
 */

const SENTINEL = 'LEAKED-CART-PAYLOAD-T024-VALUE';

function makeCapturingFactory(): { factory: PinoRollFactory; read: () => string } {
  const stream = new PassThrough();
  const buf: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => buf.push(chunk));
  const factory: PinoRollFactory = () => Promise.resolve(stream);
  return {
    factory,
    read: () => Buffer.concat(buf).toString('utf8'),
  };
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function makeLogger() {
  const { factory, read } = makeCapturingFactory();
  const logger = await createLogger({
    process: 'main',
    appVersion: '0.1.0-t024',
    logsDir: '/tmp/x-t024',
    pinoRollFactory: factory,
  });
  return { logger, read };
}

const CART_PAYLOAD_KEYS = ['note', 'attribution_operator_id'] as const;

describe('cross-process redaction (cart extension) — T024', () => {
  for (const key of CART_PAYLOAD_KEYS) {
    it(`redacts cart payload key '${key}' at top level`, async () => {
      const { logger, read } = await makeLogger();
      logger.info({ [key]: SENTINEL }, 'cart:debug');
      await flush();
      expect(read()).not.toContain(SENTINEL);
    });

    it(`redacts cart payload key '${key}' nested one level (cart.payload.${key})`, async () => {
      const { logger, read } = await makeLogger();
      logger.info({ cart: { [key]: SENTINEL } }, 'cart:debug');
      await flush();
      expect(read()).not.toContain(SENTINEL);
    });

    it(`redacts cart payload key '${key}' nested two levels (cart.action.payload.${key})`, async () => {
      const { logger, read } = await makeLogger();
      logger.info({ cart: { action: { [key]: SENTINEL } } }, 'cart:debug');
      await flush();
      expect(read()).not.toContain(SENTINEL);
    });
  }

  it('preserves structural cart envelope fields (cart_id, action_kind)', async () => {
    const { logger, read } = await makeLogger();
    logger.info(
      {
        cart_id: 'cart-uuid-visible',
        action_kind: 'cart.line.add',
      },
      'cart:debug',
    );
    await flush();
    const text = read();
    expect(text).toContain('cart-uuid-visible');
    expect(text).toContain('cart.line.add');
  });

  it('still redacts pre-existing operator/audit keys (regression: pin)', async () => {
    const { logger, read } = await makeLogger();
    logger.info({ payload: { pin: SENTINEL } }, 'cart:debug');
    await flush();
    expect(read()).not.toContain(SENTINEL);
  });
});
