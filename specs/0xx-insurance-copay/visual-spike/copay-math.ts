/**
 * copay-math.ts — Insurance / co-pay split arithmetic (VISUAL SPIKE).
 *
 * ⚠️ SPIKE-ONLY. This is the contract-FREE, provably-correct core of the
 * insurance tender design (`design_handoff_insurance_copay`). It is NOT wired
 * into the real payment flow and depends on NO backend contract. It exists so
 * the arithmetic is proven portable regardless of where the cart/VAT data
 * eventually comes from (DP-2 / 008-v2). See ../README.md for why the full
 * feature is BLOCKED.
 *
 * Money discipline (Constitution §II): integer MINOR UNITS (piasters) only.
 * Round EXACTLY ONCE — on `covered`. Derive `patientDue` by subtraction so
 * `covered + patientDue === total` is an identity, never a rounding hope.
 */

/** A demo insurance plan. STUB — production would source these from DP-2. */
export interface InsurancePlan {
  readonly id: string;
  /** Arabic display name (operator-facing). */
  readonly ar: string;
  /** English secondary label. */
  readonly en: string;
  /** Reimbursed percentage of the eligible basket, 0–100 integer. */
  readonly coverPct: number;
  /** Member-card prefix, for the input placeholder. */
  readonly prefix: string;
}

/**
 * A cart line, reduced to only what the co-pay math needs.
 *
 * `eligible` here is the spike's stubbed eligibility signal. The real cart
 * model (`PaymentIntentEnvelope.LineSnapshot`) carries NO such flag and no VAT
 * concept — that absence is one of the reasons the feature is blocked. In the
 * spike we make eligibility an explicit per-line boolean so the rule is a
 * single, honest source of truth (mirrors `CLAUDE.md §2.5`).
 */
export interface SpikeCartLine {
  readonly display_name: string;
  readonly quantity: number;
  /** Unit price in minor units (piasters). */
  readonly unit_price_minor: number;
  /**
   * Whether this line is reimbursable by insurance. In the handoff's proxy
   * this maps to "medicine = VAT-exempt line". Stubbed explicitly here.
   */
  readonly eligible: boolean;
}

/** The 4 static demo plans from the handoff. STUB data. */
export const DEMO_PLANS: readonly InsurancePlan[] = [
  { id: 'ins1', ar: 'الهيئة العامة للتأمين الصحي', en: 'Universal Health Insurance', coverPct: 100, prefix: 'UHI' },
  { id: 'ins2', ar: 'مصر للتأمين الصحي', en: 'Misr Health', coverPct: 80, prefix: 'MHI' },
  { id: 'ins3', ar: 'بوبا — الرعاية الذهبية', en: 'Bupa Gold Care', coverPct: 90, prefix: 'BUP' },
  { id: 'ins4', ar: 'تكافل الشركات', en: 'Corporate Takaful', coverPct: 70, prefix: 'TKF' },
];

/** Σ of all line totals (minor units). The basket grand total in the spike. */
export function basketTotalMinor(cart: readonly SpikeCartLine[]): number {
  return cart.reduce((sum, l) => sum + l.unit_price_minor * l.quantity, 0);
}

/** Σ of eligible (reimbursable) line totals (minor units). */
export function eligibleMinor(cart: readonly SpikeCartLine[]): number {
  return cart.reduce((sum, l) => sum + (l.eligible ? l.unit_price_minor * l.quantity : 0), 0);
}

/**
 * The full co-pay breakdown for a given cart + plan + cash tendered.
 *
 * All fields are integer minor units. `covered` is the single rounded value;
 * everything else is derived by subtraction so nothing drifts.
 */
export interface CoPayBreakdown {
  readonly total: number;
  readonly eligible: number;
  readonly nonEligible: number;
  readonly covered: number;
  readonly patientDue: number;
  readonly change: number;
  readonly fullyCovered: boolean;
}

/**
 * Compute the co-pay breakdown.
 *
 * @param cart      stubbed cart lines
 * @param coverPct  plan coverage percentage (null = no plan selected)
 * @param tendered  cash received for the co-pay in minor units (null = none yet)
 */
export function computeCoPay(
  cart: readonly SpikeCartLine[],
  coverPct: number | null,
  tendered: number | null,
): CoPayBreakdown {
  const total = basketTotalMinor(cart);
  const eligible = eligibleMinor(cart);
  const nonEligible = total - eligible;
  // Round ONCE, here, and nowhere else.
  const covered = coverPct === null ? 0 : Math.round((eligible * coverPct) / 100);
  const patientDue = total - covered; // by subtraction — never rounded again
  const change = tendered === null ? 0 : Math.max(0, tendered - patientDue);
  return {
    total,
    eligible,
    nonEligible,
    covered,
    patientDue,
    change,
    fullyCovered: patientDue <= 0,
  };
}

/** Member-id format check (UI-only): trimmed length ≥ 4. */
export function memberIdValid(memberId: string): boolean {
  return memberId.trim().length >= 4;
}

/**
 * Confirm gating — plan + valid member + (co-pay sufficient when due).
 * Pure boolean; the spike's confirm button reads this.
 */
export function canConfirm(
  hasPlan: boolean,
  memberId: string,
  breakdown: CoPayBreakdown,
  tendered: number | null,
): boolean {
  if (!hasPlan || !memberIdValid(memberId)) return false;
  if (breakdown.patientDue <= 0) return true;
  return tendered !== null && tendered >= breakdown.patientDue;
}

/** methodLabel — 'تأمين + نقدي' when a co-pay was collected, else 'تأمين'. */
export function methodLabel(breakdown: CoPayBreakdown): string {
  return breakdown.covered > 0 ? 'تأمين + نقدي' : 'تأمين';
}

/**
 * Format minor units as `EGP 1,234.50` — Latin numerals, two fractional
 * digits, for `dir="ltr"` isolation inside RTL copy. (Spike formatter; the
 * real app has its own Money helper which this deliberately does NOT import,
 * to keep the spike standalone.)
 */
export function formatMinor(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.trunc(abs / 100);
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '−' : ''}EGP ${whole.toLocaleString('en-US')}.${frac}`;
}
