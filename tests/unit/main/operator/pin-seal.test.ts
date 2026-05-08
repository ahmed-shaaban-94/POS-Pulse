import { beforeAll, describe, expect, it } from 'vitest';

import { hashPin, verifyPin } from '../../../../src/main/operator/pin-credential.js';
import { sealPinMaterial, unsealPinMaterial } from '../../../../src/main/operator/pin-seal.js';
import type { SafeStorageLike } from '../../../../src/main/secrets/safe-storage.js';
import type { RawPinMaterial, SealedPinMaterial } from '../../../../src/main/operator/pin-seal.js';

/**
 * 004-operator-session T068 — safeStorage seal unit tests.
 *
 * Verifies:
 *  - Round-trip: unseal(seal(raw)) equals raw for both pin_hash and pin_salt.
 *  - Ciphertext opacity: sealed bytes differ from plaintext bytes (encrypt called).
 *  - Tampered ciphertext throws; error message does not contain PIN value.
 *  - End-to-end smoke: hashPin → sealPinMaterial → unsealPinMaterial → verifyPin → match.
 *
 * One Argon2id hash is computed in beforeAll and shared across tests.
 * Argon2id at m=64MiB/t=3 takes 50–200ms — shared to keep the suite fast.
 */

const PREFIX = Buffer.from('SEALED:', 'utf8');

function makeFakeSafeStorage(): SafeStorageLike {
  return {
    isEncryptionAvailable: () => true,
    encryptString(plain: string): Buffer {
      return Buffer.concat([PREFIX, Buffer.from(plain, 'utf8')]);
    },
    decryptString(buf: Buffer): string {
      if (buf.length < PREFIX.length || !buf.subarray(0, PREFIX.length).equals(PREFIX)) {
        throw new Error('decryptString: invalid or tampered ciphertext');
      }
      return buf.subarray(PREFIX.length).toString('utf8');
    },
  };
}

const ss = makeFakeSafeStorage();

const SAMPLE_HASH = Buffer.from(
  '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'utf8',
);
const SAMPLE_SALT = Buffer.alloc(16, 0xab);

const SAMPLE_RAW: RawPinMaterial = { pin_hash: SAMPLE_HASH, pin_salt: SAMPLE_SALT };

describe('sealPinMaterial / unsealPinMaterial — round-trip', () => {
  it('unseal(seal(raw)).pin_hash equals original pin_hash', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    const unsealed = unsealPinMaterial(sealed, ss);
    expect(unsealed.pin_hash.equals(SAMPLE_RAW.pin_hash)).toBe(true);
  });

  it('unseal(seal(raw)).pin_salt equals original pin_salt', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    const unsealed = unsealPinMaterial(sealed, ss);
    expect(unsealed.pin_salt.equals(SAMPLE_RAW.pin_salt)).toBe(true);
  });

  it('round-trip preserves pin_salt byte-for-byte for all-zero salt', () => {
    const raw: RawPinMaterial = { pin_hash: SAMPLE_HASH, pin_salt: Buffer.alloc(16, 0x00) };
    const unsealed = unsealPinMaterial(sealPinMaterial(raw, ss), ss);
    expect(unsealed.pin_salt.equals(raw.pin_salt)).toBe(true);
  });

  it('round-trip preserves pin_salt byte-for-byte for all-ff salt', () => {
    const raw: RawPinMaterial = { pin_hash: SAMPLE_HASH, pin_salt: Buffer.alloc(16, 0xff) };
    const unsealed = unsealPinMaterial(sealPinMaterial(raw, ss), ss);
    expect(unsealed.pin_salt.equals(raw.pin_salt)).toBe(true);
  });
});

describe('sealPinMaterial — ciphertext opacity', () => {
  it('sealed pin_hash buffer differs from raw pin_hash bytes', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    expect(sealed.pin_hash.equals(SAMPLE_RAW.pin_hash)).toBe(false);
  });

  it('sealed pin_salt buffer differs from raw pin_salt bytes', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    expect(sealed.pin_salt.equals(SAMPLE_RAW.pin_salt)).toBe(false);
  });

  it('sealPinMaterial does not mutate the input row', () => {
    const original = { pin_hash: Buffer.from(SAMPLE_HASH), pin_salt: Buffer.from(SAMPLE_SALT) };
    sealPinMaterial(original, ss);
    expect(original.pin_hash.equals(SAMPLE_HASH)).toBe(true);
    expect(original.pin_salt.equals(SAMPLE_SALT)).toBe(true);
  });
});

describe('unsealPinMaterial — tampered ciphertext', () => {
  it('throws when pin_hash ciphertext is tampered', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    const tampered: SealedPinMaterial = {
      ...sealed,
      pin_hash: Buffer.from('corrupted-ciphertext', 'utf8'),
    };
    expect(() => unsealPinMaterial(tampered, ss)).toThrow();
  });

  it('throws when pin_salt ciphertext is tampered', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    const tampered: SealedPinMaterial = {
      ...sealed,
      pin_salt: Buffer.from('corrupted-ciphertext', 'utf8'),
    };
    expect(() => unsealPinMaterial(tampered, ss)).toThrow();
  });

  it('error message does not contain PIN-like values (PR-1 guard)', () => {
    const sealed = sealPinMaterial(SAMPLE_RAW, ss);
    const tampered: SealedPinMaterial = { ...sealed, pin_hash: Buffer.from('bad', 'utf8') };
    let message = '';
    try {
      unsealPinMaterial(tampered, ss);
    } catch (err) {
      message = String(err);
    }
    // Message must not contain the raw PHC string or salt bytes
    expect(message).not.toContain('argon2id');
    expect(message).not.toContain('65536');
  });
});

describe('end-to-end — hashPin → sealPinMaterial → unsealPinMaterial → verifyPin', () => {
  let hashedRaw: RawPinMaterial;
  const PIN = '7391';

  beforeAll(async () => {
    const { pin_hash, pin_salt } = await hashPin(PIN);
    hashedRaw = { pin_hash, pin_salt };
  }, 10_000);

  it('unsealed material produces {kind: match} for the correct PIN', async () => {
    const sealed = sealPinMaterial(hashedRaw, ss);
    const unsealed = unsealPinMaterial(sealed, ss);
    const result = await verifyPin(PIN, {
      ...unsealed,
      failed_attempt_count: 0,
      lockout_until: null,
    });
    expect(result).toEqual({ kind: 'match' });
  });

  it('unsealed material produces {kind: no_match} for a wrong PIN', async () => {
    const sealed = sealPinMaterial(hashedRaw, ss);
    const unsealed = unsealPinMaterial(sealed, ss);
    const result = await verifyPin('0000', {
      ...unsealed,
      failed_attempt_count: 0,
      lockout_until: null,
    });
    expect(result.kind).toBe('no_match');
  });
});
