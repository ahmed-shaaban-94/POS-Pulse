/**
 * T043 — validateExternalReference regex test.
 *
 * Normative contract per spec FR-009 (resolved by /speckit-plan v1.0 AD-5 /
 * research §R-5):
 *
 *   - regex EXACTLY ^[A-Z0-9]{0,6}$
 *   - case-sensitive (rejects lowercase)
 *   - max 6 characters
 *   - empty string is valid (optional field; absence is allowed)
 *   - PAN-shaped input rejected by construction (≥ 7 chars, lowercase, or
 *     special chars)
 *
 * Security boundary: spec FR-008 / Constitution §P6 — POS-Pulse MUST NOT
 * capture cardholder data. The regex's role is structural: it makes a
 * PAN literally unrepresentable in this field.
 */

import { describe, expect, it } from 'vitest';

import { validateExternalReference } from '../../../../src/shared/payments/external-reference-format.js';

describe('validateExternalReference — accepts valid input', () => {
  it('accepts empty string (optional field)', () => {
    expect(validateExternalReference('')).toBe(true);
  });

  it('accepts a single uppercase letter', () => {
    expect(validateExternalReference('A')).toBe(true);
  });

  it('accepts a single digit', () => {
    expect(validateExternalReference('0')).toBe(true);
  });

  it('accepts a six-character uppercase alphanumeric string', () => {
    expect(validateExternalReference('T1A2B3')).toBe(true);
  });

  it('accepts six digits', () => {
    expect(validateExternalReference('123456')).toBe(true);
  });

  it('accepts six uppercase letters', () => {
    expect(validateExternalReference('ABCDEF')).toBe(true);
  });
});

describe('validateExternalReference — rejects PAN-shaped input', () => {
  it('rejects seven characters (length cap is 6)', () => {
    expect(validateExternalReference('ABCDEFG')).toBe(false);
  });

  it('rejects a full 16-digit PAN', () => {
    expect(validateExternalReference('4111111111111111')).toBe(false);
  });

  it('rejects a 13-digit PAN', () => {
    expect(validateExternalReference('4111111111111')).toBe(false);
  });

  it('rejects an 8-digit numeric value', () => {
    expect(validateExternalReference('12345678')).toBe(false);
  });
});

describe('validateExternalReference — rejects lowercase', () => {
  it('rejects a single lowercase letter', () => {
    expect(validateExternalReference('a')).toBe(false);
  });

  it('rejects mixed-case input', () => {
    expect(validateExternalReference('Ab1234')).toBe(false);
  });

  it('rejects a full lowercase six-letter string', () => {
    expect(validateExternalReference('abcdef')).toBe(false);
  });
});

describe('validateExternalReference — rejects special characters', () => {
  it('rejects whitespace', () => {
    expect(validateExternalReference('AB CD')).toBe(false);
  });

  it('rejects punctuation', () => {
    expect(validateExternalReference('AB-CD')).toBe(false);
  });

  it('rejects underscore', () => {
    expect(validateExternalReference('AB_CD')).toBe(false);
  });

  it('rejects forward slash', () => {
    expect(validateExternalReference('AB/CD')).toBe(false);
  });

  it('rejects unicode letters', () => {
    expect(validateExternalReference('Ä')).toBe(false);
  });

  it('rejects emoji', () => {
    expect(validateExternalReference('😀')).toBe(false);
  });
});
