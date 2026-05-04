import { describe, expect, it, vi } from 'vitest';

import { createPairingService, type PairingAttemptLogRecord } from '../service.js';
import type { PairingStore, PersistInput } from '../store.js';
import { TransportError, type Network, type PairResult } from '../network.js';

/**
 * 002-terminal-pairing T022 / T023b / T023c / T048 — `PairingService.submit` tests.
 *
 * The service is the orchestrator: it composes `network.pair()` +
 * `pairingStore.persist()` + `pairingLog`. US2 covers the load-bearing
 * MVP contract:
 *
 *   - On 200 success: persist token + assignment via the store; emit
 *     exactly one `pairing_attempt` log with `outcome: 'success'`,
 *     including `terminal_id`. Resolves with the `success` result.
 *   - On reachable non-2xx with unrecognised body code: resolves with
 *     `outcome: 'unknown_error'`. State untouched. Exactly one log
 *     record, `outcome: 'unknown_error'`.
 *   - On `TransportError` (incl. 30s timeout): resolves with
 *     `outcome: 'network_error'`. State untouched. Exactly one log
 *     record, `outcome: 'network_error'`. When the TransportError
 *     carries `timed_out: true`, the log record carries it too.
 *   - Never rejects for any backend or network outcome. Programmer
 *     error (invalid argument shape) is the ONLY rejection path.
 *   - No log payload contains the `pairing_code` or `device_token`.
 *
 * US3 (T040) added per-outcome tests for invalid_code / expired_code /
 * already_paired. US4 (T048) adds the BRANCH_MISMATCH branch with the
 * FR-14 token-preservation invariant explicitly asserted.
 */

const SUCCESS_BODY = {
  device_token: 'opaque-device-token-abcdef',
  tenant_id: 'tenant-A',
  branch_id: 'branch-B',
  terminal_id: 'terminal-C',
  terminal_label: 'Counter 1',
};
const PAIRED_AT = 1735689600;

interface Harness {
  service: ReturnType<typeof createPairingService>;
  store: {
    persist: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
  };
  network: { pair: ReturnType<typeof vi.fn> };
  logRecords: PairingAttemptLogRecord[];
}

interface HarnessOpts {
  /** Drive what `network.pair()` resolves with (for the resolve path). */
  pairResult?: PairResult;
  /** Drive a rejection from `network.pair()`. */
  pairRejection?: Error;
  /** Make `pairingStore.persist()` reject with the given error. */
  persistRejection?: Error;
}

function makeHarness(opts: HarnessOpts = {}): Harness {
  const logRecords: PairingAttemptLogRecord[] = [];
  const persistRejection = opts.persistRejection;
  const persist = vi.fn<(input: PersistInput) => Promise<void>>(() => {
    if (persistRejection !== undefined) return Promise.reject(persistRejection);
    return Promise.resolve();
  });
  const clear = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const getStatus = vi.fn<PairingStore['getStatus']>(() => Promise.resolve({ kind: 'unpaired' }));
  const store: PairingStore = { persist, clear, getStatus };

  const pairRejection = opts.pairRejection;
  const pair = vi.fn<Network['pair']>(() => {
    if (pairRejection !== undefined) return Promise.reject(pairRejection);
    if (opts.pairResult !== undefined) return Promise.resolve(opts.pairResult);
    return Promise.resolve({ ok: true, status: 200, body: SUCCESS_BODY });
  });
  const network: Network = { pair };

  const service = createPairingService({
    store,
    network,
    pairingLog: (record) => logRecords.push(record),
    clock: () => new Date(PAIRED_AT * 1000),
  });

  return {
    service,
    store: { persist, clear, getStatus },
    network: { pair },
    logRecords,
  };
}

/* ------------------------- T022 ------------------------- */

describe('PairingService.submit — success path (T022)', () => {
  it('on 200 success: calls store.persist with token + assignment + paired_at', async () => {
    const h = makeHarness();
    await h.service.submit('VALIDCODE');

    expect(h.store.persist).toHaveBeenCalledTimes(1);
    expect(h.store.persist).toHaveBeenCalledWith({
      device_token: SUCCESS_BODY.device_token,
      tenant_id: SUCCESS_BODY.tenant_id,
      branch_id: SUCCESS_BODY.branch_id,
      terminal_id: SUCCESS_BODY.terminal_id,
      terminal_label: SUCCESS_BODY.terminal_label,
      paired_at: PAIRED_AT,
    });
  });

  it('returns outcome=success carrying the assignment fields (no device_token)', async () => {
    const h = makeHarness();
    const result = await h.service.submit('VALIDCODE');

    expect(result).toEqual({
      outcome: 'success',
      tenant_id: SUCCESS_BODY.tenant_id,
      branch_id: SUCCESS_BODY.branch_id,
      terminal_id: SUCCESS_BODY.terminal_id,
      terminal_label: SUCCESS_BODY.terminal_label,
    });
    // The PairingSubmitResult success branch type has NO `device_token`
    // field — even at runtime the value MUST NOT have leaked through.
    expect(result).not.toHaveProperty('device_token');
  });

  it('emits exactly ONE pairing_attempt log with outcome=success and terminal_id', async () => {
    const h = makeHarness();
    await h.service.submit('VALIDCODE');

    expect(h.logRecords).toHaveLength(1);
    expect(h.logRecords[0]).toMatchObject({
      event: 'pairing_attempt',
      outcome: 'success',
      terminal_id: SUCCESS_BODY.terminal_id,
    });
    expect(h.logRecords[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('the success-path log record contains NEITHER pairing_code NOR device_token', async () => {
    const code = 'SUPER-SECRET-CODE-1234';
    const h = makeHarness();
    await h.service.submit(code);

    const dump = JSON.stringify(h.logRecords);
    expect(dump).not.toContain(code);
    expect(dump).not.toContain(SUCCESS_BODY.device_token);
  });

  it('rolls back the SecretStore write when the SQL write fails (atomic via persist)', async () => {
    // The store's persist() already implements compensating-rollback
    // (PR #16). Here we assert the SERVICE surfaces the SQL failure as
    // an outcome (not a rejection), and that no success log was emitted.
    const h = makeHarness({ persistRejection: new Error('forced SQL failure') });
    const result = await h.service.submit('VALIDCODE');

    // Service catch-all turns persist failure into unknown_error — the
    // store handled rollback under the hood. Submit MUST resolve.
    expect(result.outcome).toBe('unknown_error');
    expect(h.logRecords).toHaveLength(1);
    expect(h.logRecords[0]?.outcome).toBe('unknown_error');
    // Critically, we did NOT log a success record.
    expect(h.logRecords.some((r) => r.outcome === 'success')).toBe(false);
  });
});

/* ------------------------- T023b ------------------------- */

describe('PairingService.submit — TransportError catch-all (T023b)', () => {
  it('TransportError(non-timeout) resolves with outcome=network_error', async () => {
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: false, reason: 'fetch_failed' }),
    });
    const result = await h.service.submit('CODE');

    expect(result).toEqual({ outcome: 'network_error' });
    expect(h.store.persist).not.toHaveBeenCalled();
  });

  it('TransportError(timed_out: true) resolves with outcome=network_error AND log carries timed_out: true', async () => {
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: true, reason: 'timeout' }),
    });
    const result = await h.service.submit('CODE');

    expect(result).toEqual({ outcome: 'network_error' });
    expect(h.logRecords).toHaveLength(1);
    expect(h.logRecords[0]).toMatchObject({
      event: 'pairing_attempt',
      outcome: 'network_error',
      timed_out: true,
    });
  });

  it('TransportError(non-timeout) log record does NOT carry timed_out', async () => {
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: false, reason: 'fetch_failed' }),
    });
    await h.service.submit('CODE');

    expect(h.logRecords).toHaveLength(1);
    // timed_out is omitted on the non-timeout path so the log shape is
    // distinct between "we hit the timeout" and "transport just failed".
    expect(h.logRecords[0]).not.toHaveProperty('timed_out');
  });

  it('on TransportError: prior persisted state is byte-for-byte unchanged', async () => {
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: false, reason: 'fetch_failed' }),
    });
    await h.service.submit('CODE');

    expect(h.store.persist).not.toHaveBeenCalled();
    expect(h.store.clear).not.toHaveBeenCalled();
  });

  it('on TransportError: emits exactly ONE log record', async () => {
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: false, reason: 'fetch_failed' }),
    });
    await h.service.submit('CODE');

    expect(h.logRecords).toHaveLength(1);
  });

  it('TransportError path: NO log payload contains the submitted code or any token-shaped string', async () => {
    const code = 'SECRET-PAIR-CODE-XYZ';
    const tokenLike = 'opaque-token-9876';
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: false, reason: 'fetch_failed' }),
    });
    await h.service.submit(code);

    const dump = JSON.stringify(h.logRecords);
    expect(dump).not.toContain(code);
    expect(dump).not.toContain(tokenLike);
  });
});

/* ------------------------- T023c ------------------------- */

describe('PairingService.submit — unknown-envelope catch-all (T023c)', () => {
  it('reachable non-2xx with unrecognised body code resolves with outcome=unknown_error', async () => {
    const h = makeHarness({
      pairResult: { ok: false, status: 400, body: { code: 'NOT_YET_RECOGNISED' } },
    });
    const result = await h.service.submit('CODE');

    expect(result).toEqual({ outcome: 'unknown_error' });
  });

  it('on unknown-envelope: prior persisted state is untouched', async () => {
    const h = makeHarness({ pairResult: { ok: false, status: 500, body: {} } });
    await h.service.submit('CODE');

    expect(h.store.persist).not.toHaveBeenCalled();
    expect(h.store.clear).not.toHaveBeenCalled();
  });

  it('on unknown-envelope: emits exactly ONE log record with outcome=unknown_error', async () => {
    const h = makeHarness({
      pairResult: { ok: false, status: 502, body: { code: 'WHATEVER' } },
    });
    await h.service.submit('CODE');

    expect(h.logRecords).toHaveLength(1);
    expect(h.logRecords[0]).toMatchObject({
      event: 'pairing_attempt',
      outcome: 'unknown_error',
    });
  });

  it('unknown-envelope path: NO log payload contains the submitted code', async () => {
    const code = 'ANOTHER-SECRET-CODE';
    const h = makeHarness({
      pairResult: { ok: false, status: 503, body: { code: 'UNKNOWN' } },
    });
    await h.service.submit(code);

    expect(JSON.stringify(h.logRecords)).not.toContain(code);
  });
});

/* ------------------------- T040 ------------------------- */

describe('PairingService.submit — recoverable failure outcomes (T040)', () => {
  // Each test pre-populates the store fake's getStatus with a paired
  // state so the "prior state untouched" assertion is meaningful: the
  // service must NOT call persist() or clear() on any of the three
  // recoverable-failure paths (FR-8).
  const PRIOR_PAIRED_STATUS = {
    kind: 'paired',
    tenant_id: 'prior-tenant',
    branch_id: 'prior-branch',
    terminal_id: 'prior-terminal',
    terminal_label: 'Prior Counter',
    paired_at: 1700000000,
  } as const;

  function makeHarnessWithPriorPair(opts: HarnessOpts = {}): Harness {
    const h = makeHarness(opts);
    h.store.getStatus.mockResolvedValue(PRIOR_PAIRED_STATUS);
    return h;
  }

  /* ----- INVALID_CODE ----- */

  describe('INVALID_CODE -> outcome=invalid_code', () => {
    it('resolves with { outcome: "invalid_code" }', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 400, body: { code: 'INVALID_CODE', message: 'x' } },
      });
      const result = await h.service.submit('CODE');
      expect(result).toEqual({ outcome: 'invalid_code' });
    });

    it('does NOT call store.persist() (failure path = log only)', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 400, body: { code: 'INVALID_CODE' } },
      });
      await h.service.submit('CODE');
      expect(h.store.persist).not.toHaveBeenCalled();
    });

    it('does NOT call store.clear() (prior state preserved per FR-8)', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 400, body: { code: 'INVALID_CODE' } },
      });
      await h.service.submit('CODE');
      expect(h.store.clear).not.toHaveBeenCalled();
    });

    it('emits exactly ONE log record with outcome=invalid_code (no code/token in payload)', async () => {
      const code = 'SECRET-INVALID-CODE-9999';
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 400, body: { code: 'INVALID_CODE' } },
      });
      await h.service.submit(code);

      expect(h.logRecords).toHaveLength(1);
      expect(h.logRecords[0]).toMatchObject({
        event: 'pairing_attempt',
        outcome: 'invalid_code',
      });
      expect(h.logRecords[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const dump = JSON.stringify(h.logRecords);
      expect(dump).not.toContain(code);
      expect(dump).not.toContain('SECRET-INVALID-CODE-9999');
    });
  });

  /* ----- EXPIRED_CODE ----- */

  describe('EXPIRED_CODE -> outcome=expired_code', () => {
    it('resolves with { outcome: "expired_code" }', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 410, body: { code: 'EXPIRED_CODE', message: 'x' } },
      });
      const result = await h.service.submit('CODE');
      expect(result).toEqual({ outcome: 'expired_code' });
    });

    it('does NOT call store.persist()', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 410, body: { code: 'EXPIRED_CODE' } },
      });
      await h.service.submit('CODE');
      expect(h.store.persist).not.toHaveBeenCalled();
    });

    it('does NOT call store.clear()', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 410, body: { code: 'EXPIRED_CODE' } },
      });
      await h.service.submit('CODE');
      expect(h.store.clear).not.toHaveBeenCalled();
    });

    it('emits exactly ONE log record with outcome=expired_code (no code/token)', async () => {
      const code = 'SECRET-EXPIRED-CODE-1234';
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 410, body: { code: 'EXPIRED_CODE' } },
      });
      await h.service.submit(code);

      expect(h.logRecords).toHaveLength(1);
      expect(h.logRecords[0]).toMatchObject({
        event: 'pairing_attempt',
        outcome: 'expired_code',
      });
      const dump = JSON.stringify(h.logRecords);
      expect(dump).not.toContain(code);
    });
  });

  /* ----- ALREADY_PAIRED ----- */

  describe('ALREADY_PAIRED -> outcome=already_paired', () => {
    it('resolves with { outcome: "already_paired" }', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 409, body: { code: 'ALREADY_PAIRED', message: 'x' } },
      });
      const result = await h.service.submit('CODE');
      expect(result).toEqual({ outcome: 'already_paired' });
    });

    it('does NOT call store.persist()', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 409, body: { code: 'ALREADY_PAIRED' } },
      });
      await h.service.submit('CODE');
      expect(h.store.persist).not.toHaveBeenCalled();
    });

    it('does NOT call store.clear()', async () => {
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 409, body: { code: 'ALREADY_PAIRED' } },
      });
      await h.service.submit('CODE');
      expect(h.store.clear).not.toHaveBeenCalled();
    });

    it('emits exactly ONE log record with outcome=already_paired (no code/token)', async () => {
      const code = 'SECRET-ALREADY-PAIRED-2025';
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status: 409, body: { code: 'ALREADY_PAIRED' } },
      });
      await h.service.submit(code);

      expect(h.logRecords).toHaveLength(1);
      expect(h.logRecords[0]).toMatchObject({
        event: 'pairing_attempt',
        outcome: 'already_paired',
      });
      const dump = JSON.stringify(h.logRecords);
      expect(dump).not.toContain(code);
    });
  });

  /* ----- cross-cutting invariants for the three US3 outcomes ----- */

  it('the three US3 outcomes share the same "no state mutation" invariant (FR-8)', async () => {
    // Drive all three outcomes back-to-back through fresh harnesses and
    // assert NEITHER persist NOR clear was called for any of them. This
    // is the single explicit "failure path = log only" cross-test.
    for (const code of ['INVALID_CODE', 'EXPIRED_CODE', 'ALREADY_PAIRED'] as const) {
      const status = code === 'INVALID_CODE' ? 400 : code === 'EXPIRED_CODE' ? 410 : 409;
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status, body: { code } },
      });
      await h.service.submit('CODE');
      expect(h.store.persist).not.toHaveBeenCalled();
      expect(h.store.clear).not.toHaveBeenCalled();
    }
  });

  it('the three US3 log records carry NO terminal_id (success-only field)', async () => {
    // The PairingAttemptLogRecord schema scopes terminal_id to the
    // success branch. Failure records MUST NOT carry it — the field
    // would expose post-pair identity on a path where no pair occurred.
    for (const code of ['INVALID_CODE', 'EXPIRED_CODE', 'ALREADY_PAIRED'] as const) {
      const status = code === 'INVALID_CODE' ? 400 : code === 'EXPIRED_CODE' ? 410 : 409;
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status, body: { code } },
      });
      await h.service.submit('CODE');
      expect(h.logRecords[0]).not.toHaveProperty('terminal_id');
    }
  });

  it('the three US3 log records carry NO retry_after_s or timed_out (US5/transport-only fields)', async () => {
    for (const code of ['INVALID_CODE', 'EXPIRED_CODE', 'ALREADY_PAIRED'] as const) {
      const status = code === 'INVALID_CODE' ? 400 : code === 'EXPIRED_CODE' ? 410 : 409;
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status, body: { code } },
      });
      await h.service.submit('CODE');
      expect(h.logRecords[0]).not.toHaveProperty('retry_after_s');
      expect(h.logRecords[0]).not.toHaveProperty('timed_out');
    }
  });

  it('NEVER rejects for any of the three US3 outcomes (bridge contract)', async () => {
    for (const code of ['INVALID_CODE', 'EXPIRED_CODE', 'ALREADY_PAIRED'] as const) {
      const status = code === 'INVALID_CODE' ? 400 : code === 'EXPIRED_CODE' ? 410 : 409;
      const h = makeHarnessWithPriorPair({
        pairResult: { ok: false, status, body: { code } },
      });
      await expect(h.service.submit('CODE')).resolves.toBeDefined();
    }
  });
});

/* ------------------------- T048 ------------------------- */

describe('PairingService.submit — BRANCH_MISMATCH branch (T048, FR-14)', () => {
  // FR-14: a failed re-pair attempt that resolves to BRANCH_MISMATCH
  // MUST leave the existing device_token + terminal_assignment row
  // byte-for-byte untouched. The test pre-populates a known prior
  // paired state, drives the BRANCH_MISMATCH envelope, then asserts
  // the service never called persist() or clear() and the prior
  // state survives the call (read-back via the harness's getStatus
  // mock which returns the pre-populated PRIOR_PAIRED_STATUS).

  const PRIOR_PAIRED_STATUS = {
    kind: 'paired',
    tenant_id: 'prior-tenant',
    branch_id: 'prior-branch',
    terminal_id: 'prior-terminal',
    terminal_label: 'Prior Counter',
    paired_at: 1700000000,
  } as const;

  function makeHarnessWithPriorPair(opts: HarnessOpts = {}): Harness {
    const h = makeHarness(opts);
    h.store.getStatus.mockResolvedValue(PRIOR_PAIRED_STATUS);
    return h;
  }

  it('resolves with { outcome: "branch_mismatch" }', async () => {
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH', message: 'x' } },
    });
    const result = await h.service.submit('CODE');
    expect(result).toEqual({ outcome: 'branch_mismatch' });
  });

  it('does NOT call store.persist() (failure path = log only)', async () => {
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await h.service.submit('CODE');
    expect(h.store.persist).not.toHaveBeenCalled();
  });

  it('does NOT call store.clear() (FR-14: prior token + row preserved)', async () => {
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await h.service.submit('CODE');
    expect(h.store.clear).not.toHaveBeenCalled();
  });

  it('prior persisted state is byte-for-byte identical after the call (FR-14)', async () => {
    // FR-14 invariant: existing token + assignment row preserved on
    // BRANCH_MISMATCH. The store mock is pre-populated with
    // PRIOR_PAIRED_STATUS; the only state-mutation calls the service
    // can make are persist() and clear() (see service.ts contract).
    // The two assertions below are therefore a complete proof that
    // no state-mutation path was taken — meaning the prior token and
    // assignment row survive a BRANCH_MISMATCH unchanged. The
    // pre-population guarantees the assertion is non-vacuous: a
    // service that DID clear state would have a meaningful "before"
    // to wipe.
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await h.service.submit('CODE');

    expect(h.store.persist).not.toHaveBeenCalled();
    expect(h.store.clear).not.toHaveBeenCalled();
  });

  it('emits exactly ONE log record with outcome=branch_mismatch (no code/token in payload)', async () => {
    const code = 'SECRET-BRANCH-MISMATCH-CODE-7777';
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await h.service.submit(code);

    expect(h.logRecords).toHaveLength(1);
    expect(h.logRecords[0]).toMatchObject({
      event: 'pairing_attempt',
      outcome: 'branch_mismatch',
    });
    expect(h.logRecords[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const dump = JSON.stringify(h.logRecords);
    expect(dump).not.toContain(code);
    expect(dump).not.toContain('SECRET-BRANCH-MISMATCH-CODE-7777');
  });

  it('the BRANCH_MISMATCH log record carries NO terminal_id (success-only field)', async () => {
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await h.service.submit('CODE');
    expect(h.logRecords[0]).not.toHaveProperty('terminal_id');
  });

  it('the BRANCH_MISMATCH log record carries NO retry_after_s or timed_out', async () => {
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await h.service.submit('CODE');
    expect(h.logRecords[0]).not.toHaveProperty('retry_after_s');
    expect(h.logRecords[0]).not.toHaveProperty('timed_out');
  });

  it('NEVER rejects on BRANCH_MISMATCH (bridge contract)', async () => {
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    await expect(h.service.submit('CODE')).resolves.toBeDefined();
  });

  it('BRANCH_MISMATCH on a non-409 status STILL routes by body.code', async () => {
    // Defensive: if the backend ever returns BRANCH_MISMATCH on a
    // different status, the body code MUST still drive the outcome
    // (status 409 is shared with ALREADY_PAIRED — body.code is what
    // splits them). Same FR-14 invariant applies.
    const h = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 422, body: { code: 'BRANCH_MISMATCH' } },
    });
    const result = await h.service.submit('CODE');
    expect(result).toEqual({ outcome: 'branch_mismatch' });
    expect(h.store.persist).not.toHaveBeenCalled();
    expect(h.store.clear).not.toHaveBeenCalled();
  });

  it('BRANCH_MISMATCH and ALREADY_PAIRED on shared status 409 resolve to distinct outcomes', async () => {
    // Cross-test that adding the BRANCH_MISMATCH branch did not
    // accidentally re-route the ALREADY_PAIRED outcome they share a
    // status with.
    const hAlready = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'ALREADY_PAIRED' } },
    });
    const rAlready = await hAlready.service.submit('CODE');
    expect(rAlready).toEqual({ outcome: 'already_paired' });

    const hBranch = makeHarnessWithPriorPair({
      pairResult: { ok: false, status: 409, body: { code: 'BRANCH_MISMATCH' } },
    });
    const rBranch = await hBranch.service.submit('CODE');
    expect(rBranch).toEqual({ outcome: 'branch_mismatch' });
  });
});

/* ------------------------- contract invariants ------------------------- */

describe('PairingService.submit — contract invariants (T023a)', () => {
  it('NEVER rejects for any backend or network outcome (success path)', async () => {
    const h = makeHarness();
    await expect(h.service.submit('CODE')).resolves.toBeDefined();
  });

  it('NEVER rejects for any backend or network outcome (transport rejection)', async () => {
    const h = makeHarness({
      pairRejection: new TransportError({ timed_out: false, reason: 'fetch_failed' }),
    });
    await expect(h.service.submit('CODE')).resolves.toBeDefined();
  });

  it('NEVER rejects for any backend or network outcome (reachable failure)', async () => {
    const h = makeHarness({
      pairResult: { ok: false, status: 400, body: { code: 'INVALID_CODE' } },
    });
    await expect(h.service.submit('CODE')).resolves.toBeDefined();
  });

  it('NEVER rejects when network rejects with a NON-TransportError (defensive: swallow into unknown_error)', async () => {
    // A future bug or library could throw a vanilla Error from network.
    // The service catch-all MUST resolve with unknown_error rather
    // than let the bug propagate to the renderer as a rejection — the
    // bridge contract is "submit() never rejects for backend/network".
    const h = makeHarness({ pairRejection: new Error('unexpected from network') });
    const result = await h.service.submit('CODE');
    expect(result).toEqual({ outcome: 'unknown_error' });
  });

  it('rejects only on programmer error: non-string code argument', async () => {
    const h = makeHarness();
    // The IPC handler validates this in T024+; here we assert the
    // service ALSO defends against it for callers that bypass IPC.
    // @ts-expect-error — intentional misuse
    await expect(h.service.submit(undefined)).rejects.toThrow(/string|invalid/i);
    // @ts-expect-error — intentional misuse
    await expect(h.service.submit(42)).rejects.toThrow(/string|invalid/i);
  });
});
