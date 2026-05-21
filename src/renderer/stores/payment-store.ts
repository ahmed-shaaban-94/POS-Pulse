import { create } from 'zustand';

import type { PaymentIntentEnvelope } from '../../shared/cart/handoff-envelope.js';
import { freezeEnvelope } from '../../shared/cart/handoff-envelope.js';

/**
 * 006-payments-tender S1 — payment store.
 *
 * Holds the frozen PaymentIntentEnvelope received from CartPane after a
 * successful handoff. This store is renderer-only: no bridge calls, no FSM.
 * Main process owns all payment FSM transitions (AD-1).
 *
 * SECURITY: the envelope reference is frozen on mount. No sensitive fields
 * are written to logs or exposed beyond what the renderer already received
 * from the preload bridge via CartPane.
 */

export interface PaymentState {
  envelope: Readonly<PaymentIntentEnvelope> | null;
}

export interface PaymentStore extends PaymentState {
  /** Freeze and store the envelope. Idempotent: re-mounting with a new envelope replaces the old one. */
  mount(envelope: PaymentIntentEnvelope): void;
  /** Clear the envelope (e.g. on void or new cart). */
  reset(): void;
}

const INITIAL: PaymentState = { envelope: null };

export const usePaymentStore = create<PaymentStore>((set) => ({
  ...INITIAL,
  mount: (envelope) => {
    set({ envelope: freezeEnvelope(envelope) });
  },
  reset: () => {
    set({ ...INITIAL });
  },
}));
