/**
 * 006-payments-tender Slice 2 — external_card_terminal reference format.
 *
 * Normative regex per spec FR-009 (resolved by /speckit-plan v1.0 AD-5 /
 * research §R-5):
 *
 *   - exactly ^[A-Z0-9]{0,6}$
 *   - case-sensitive (lowercase forbidden)
 *   - max 6 characters
 *   - empty string is valid (optional field)
 *
 * Security boundary: spec FR-008 / Constitution §P6 forbid capturing
 * cardholder data. The length cap + alphabet make a PAN literally
 * unrepresentable in this field; client-side enforcement + (future Slice 3)
 * main-side re-validation refuse non-conforming input as `invalid_input`.
 */

const EXTERNAL_REFERENCE_REGEX = /^[A-Z0-9]{0,6}$/;

export function validateExternalReference(input: string): boolean {
  return EXTERNAL_REFERENCE_REGEX.test(input);
}
