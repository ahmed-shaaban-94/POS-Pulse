/**
 * 004-operator-session T068 — safeStorage seal for cashier_pin_records rows.
 *
 * AD-2 / PR-1: PIN never touches this module. Only the Argon2id PHC string
 * (pin_hash) and the random salt bytes (pin_salt) are sealed/unsealed here.
 *
 * Production-startup refusal (constitution v1.3.0) is enforced at app boot
 * by createSecretStore in src/main/secrets/index.ts (called from
 * src/main/index.ts:~234). This module trusts that safeStorage is available
 * when called — callers must not invoke it if isEncryptionAvailable() is false.
 *
 * Encoding:
 *   pin_hash — Buffer of UTF-8 PHC string → encryptString(phcString) → sealed Buffer.
 *   pin_salt — 16 raw bytes → base64 intermediary → encryptString(b64) → sealed Buffer.
 *   The base64 step is required because SafeStorageLike.encryptString is string-typed,
 *   but salt is raw binary.
 */

import type { SafeStorageLike } from '../secrets/safe-storage.js';

/** Raw (unsealed) pin_hash + pin_salt as read from hashPin() or DB after unseal. */
export interface RawPinMaterial {
  /** UTF-8 bytes of the Argon2id PHC string. */
  pin_hash: Buffer;
  /** 16 raw random bytes. */
  pin_salt: Buffer;
}

/** DPAPI-sealed pin_hash + pin_salt, ready for BLOB storage in cashier_pin_records. */
export interface SealedPinMaterial {
  /** DPAPI ciphertext of the PHC string's UTF-8 bytes. */
  pin_hash: Buffer;
  /** DPAPI ciphertext of the salt's base64 representation. */
  pin_salt: Buffer;
}

/**
 * Write-time seal: encrypts pin_hash and pin_salt via safeStorage (DPAPI on
 * Windows) before the caller persists them to cashier_pin_records.
 * Immutable — raw is not mutated.
 */
export function sealPinMaterial(raw: RawPinMaterial, ss: SafeStorageLike): SealedPinMaterial {
  return {
    pin_hash: ss.encryptString(raw.pin_hash.toString('utf8')),
    pin_salt: ss.encryptString(raw.pin_salt.toString('base64')),
  };
}

/**
 * Read-time unseal: decrypts pin_hash and pin_salt from sealed DB buffers back
 * to the raw form expected by verifyPin / verifyPinWithWindow.
 * Immutable — sealed is not mutated.
 * Throws (from safeStorage) if ciphertext is tampered or corrupt.
 */
export function unsealPinMaterial(sealed: SealedPinMaterial, ss: SafeStorageLike): RawPinMaterial {
  return {
    pin_hash: Buffer.from(ss.decryptString(sealed.pin_hash), 'utf8'),
    pin_salt: Buffer.from(ss.decryptString(sealed.pin_salt), 'base64'),
  };
}
