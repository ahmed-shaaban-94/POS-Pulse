import { describe, it, expectTypeOf } from 'vitest';
import type { PreloadBridgeAPI } from '../shared/bridge-api';

// Side-effect import keeps the global Window augmentation in scope for this file.
import '../shared/bridge-api';

/**
 * T029 — bridge-typing test.
 *
 * Asserts that `window.api` and `PreloadBridgeAPI` are the same shape, so any
 * preload implementation that drifts from the contract fails typecheck (and CI).
 */
describe('window.api typing matches PreloadBridgeAPI', () => {
  it('Window["api"] equals PreloadBridgeAPI', () => {
    expectTypeOf<Window['api']>().toEqualTypeOf<PreloadBridgeAPI>();
  });

  it('PreloadBridgeAPI.ping returns Promise<"pong">', () => {
    expectTypeOf<PreloadBridgeAPI['ping']>().returns.resolves.toEqualTypeOf<'pong'>();
  });

  it('PreloadBridgeAPI.appVersion returns Promise<string>', () => {
    expectTypeOf<PreloadBridgeAPI['appVersion']>().returns.resolves.toEqualTypeOf<string>();
  });
});
