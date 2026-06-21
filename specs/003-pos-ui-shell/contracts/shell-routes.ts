/**
 * Contract — POS UI Shell Routes
 *
 * Feature: 003-pos-ui-shell
 * Plan:    ../plan.md
 *
 * Status: planning-time snapshot. Once `src/renderer/router.tsx` lands the `/app/*` parent route
 * and the six placeholder pane routes, the canonical surface is the code; this file remains a
 * frozen visual + structural contract for the Figma handoff.
 *
 * This file is a TypeScript snippet, NOT a runtime export. Phase 2 will mirror these names into
 * `src/renderer/router.tsx` and `src/renderer/routes/app/*Placeholder.tsx`.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Route map                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The six placeholder routes hang off a single parent `/app/*` route. The parent mounts the
 * `AppShell` layout component; each child is a placeholder pane with `default | loading | empty
 * | error` state variants selectable in dev builds via `?state=…` URL search param.
 *
 * Not modelled here:
 *   - Pairing routes `/pairing` and `/paired` — owned by 002, unchanged by this feature.
 *   - The boot-router gate that decides between `/pairing`, `/paired`, and `/app/*` —
 *     owned by 002, unchanged by this feature.
 */

export type ShellRoutePath =
  | '/app/dashboard'
  | '/app/cart'
  | '/app/sales'
  | '/app/returns'
  | '/app/audit'
  | '/app/inventory'
  | '/app/settings';

export type ShellNavEntryId =
  | 'dashboard'
  | 'cart'
  | 'sales'
  | 'returns'
  | 'audit'
  | 'inventory'
  | 'settings';

export interface ShellNavEntry {
  readonly id: ShellNavEntryId;
  readonly path: ShellRoutePath;
  /**
   * POS v3.5: the Arabic-first VISIBLE label. The rail renders this as the
   * visible `.nav-rail__label` text (Arabic-first terminal copy).
   */
  readonly label: string;
  /**
   * English name. Used as the link's accessible name in BOTH expanded and
   * icon-only rail modes (language-stable for screen readers + tests), while
   * the operator sees the Arabic `label`.
   */
  readonly labelEn: string;
  /** Stable icon identifier — concrete icon component decided in Phase 2. */
  readonly iconKey:
    | 'dashboard'
    | 'cart'
    | 'sales'
    | 'returns'
    | 'audit'
    | 'inventory'
    | 'settings';
}

/**
 * Fixed display order (POS v3.5 `POS_NAV`). NavRail iterates this constant; tests assert array
 * length === 7 and that each `path` is reachable from the router. `returns` is Phase-7 blocked and
 * `audit` is a later display slice — both route to thin "coming soon" placeholders for now.
 */
export const shellNavEntries: ReadonlyArray<ShellNavEntry> = [
  { id: 'dashboard', path: '/app/dashboard', label: 'لوحة المتابعة', labelEn: 'Dashboard', iconKey: 'dashboard' },
  { id: 'cart',      path: '/app/cart',      label: 'نقطة البيع',    labelEn: 'Sale',      iconKey: 'cart'      },
  { id: 'sales',     path: '/app/sales',     label: 'المبيعات',      labelEn: 'Sales',     iconKey: 'sales'     },
  { id: 'returns',   path: '/app/returns',   label: 'المرتجعات',     labelEn: 'Returns',   iconKey: 'returns'   },
  { id: 'audit',     path: '/app/audit',     label: 'سجل المراجعة',  labelEn: 'Audit',     iconKey: 'audit'     },
  { id: 'inventory', path: '/app/inventory', label: 'المخزون',       labelEn: 'Inventory', iconKey: 'inventory' },
  { id: 'settings',  path: '/app/settings',  label: 'الإعدادات',     labelEn: 'Settings',  iconKey: 'settings'  },
] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Placeholder-pane state-variant model                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Each placeholder pane renders one of these four state variants. State is selected via a
 * dev-only `?state=…` URL search param; in production the value defaults to `default`.
 */
export type PaneStateVariant = 'default' | 'loading' | 'empty' | 'error';

export interface PaneState {
  readonly variant: PaneStateVariant;
  /**
   * No fetched data, no IPC call, no persistence read. Placeholders have nothing to load —
   * `loading` exists only as a visual variant.
   */
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Connection-state model (visual-only — see contracts/shell-regions.md)     */
/* ────────────────────────────────────────────────────────────────────────── */

export type ConnectionState = 'online' | 'degraded' | 'offline' | 'syncing';

/**
 * Hard non-implementation list for `syncing`:
 *
 *   MUST NOT trigger any sync queue, backend call, persistence write, IPC message, or preload
 *   bridge change. The state exists only as a visual placeholder for future offline-sync work.
 *
 * Enforced by:
 *   - `useConnectionState` having no side-effect subscriptions (guard test);
 *   - the bridge-non-regression guard test (Plan §"Test Strategy", step 8).
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Viewport tier model                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export type ViewportTier = 'expanded' | 'icon-only' | 'too-small';

/**
 * Width thresholds (CSS px). The hook `useViewportTier` uses `window.matchMedia` and debounces
 * transitions by 100 ms.
 *
 *   width >= 1280              → 'expanded'
 *   1024 <= width < 1280       → 'icon-only'
 *   width < 1024               → 'too-small'
 */
export const viewportBreakpointPx = {
  expanded: 1280,
  iconOnly: 1024,
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payment-tender visual reservation (owned by future 005-checkout-payments) */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Eleven labelled rectangles reserved by the Receipt / Checkout placeholder for the future
 * feature 005-checkout-payments. THIS FEATURE (003) ONLY VISUALLY RESERVES THE SLOTS.
 *
 * Hard non-implementation list (repeated verbatim from spec §"Payment / tender visual
 * reservation"):
 *
 *   003 MUST NOT:
 *     - implement payment logic of any kind (no totals math, no change calculation, no balance
 *       arithmetic);
 *     - introduce or call any payment API, payment provider, payment gateway, or payment SDK;
 *     - introduce or call any card-terminal integration;
 *     - introduce or call any insurance validation;
 *     - introduce or call any voucher / gift-card validation;
 *     - introduce or call any printing logic;
 *     - introduce or persist any sales / cart / line-item / order business logic;
 *     - add a `Money` type, a currency formatter, an exchange-rate hook, or any value-bearing
 *       prop on the slot components;
 *     - introduce a new IPC channel, a new preload-bridge surface, or a new SecretStore key;
 *     - emit any new log line, Sentry breadcrumb, or telemetry tag tied to a tender or amount.
 *
 * The slot ids below are FROZEN. 005-checkout-payments will consume them by name without
 * renaming.
 */

export const reservedSlotIds = [
  'tender.cash',
  'tender.card',
  'tender.bank-transfer',
  'tender.voucher',
  'tender.insurance',
  'tender.split',
  'totals.amount-due',
  'totals.amount-paid',
  'totals.remaining',
  'totals.change-due',
  'receipt.breakdown',
] as const;

export type ReservedSlotId = typeof reservedSlotIds[number];

/**
 * Slot component prop type — deliberately devoid of value-bearing props.
 *
 * Forbidden props (typecheck must reject):
 *   - amount, currency, value, total, paid, due, change
 *   - onSubmit, onChange, onConfirm, onPay
 *   - any callback or money-shaped value
 *
 * The `label` is a display string (e.g. "Cash", "Amount due") — NEVER a formatted amount.
 */
export type ReservedSlotProps = {
  readonly slotId: ReservedSlotId;
  readonly label: string;
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tests this contract drives                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 *  - `placeholders.test.tsx` — for each entry in `shellNavEntries`, the router resolves the
 *    `path` to the matching placeholder component and renders the `default` state.
 *  - `placeholders.test.tsx` (parametrised) — for each entry × each `PaneStateVariant`, the
 *    `?state=…` search param renders the matching state and triggers no fetch / IPC / persistence
 *    call.
 *  - `NavRail.test.tsx` — `shellNavEntries.length === 7` (POS v3.5 `POS_NAV`); the order is the
 *    documented order; the Arabic `label` is the visible text and the English `labelEn` is the
 *    link's accessible name in both expanded and icon-only rail modes.
 *  - `useViewportTier.test.ts` — boundary widths (1024, 1279, 1280, 1920) map to the documented
 *    tier.
 *  - `useConnectionState.test.ts` — `ConnectionState` enum has exactly four members; default
 *    initial value is `'online'`; setter is the only mutation; zero side-effect subscriptions.
 *  - `CheckoutPlaceholder.test.tsx` — renders all eleven `reservedSlotIds` in the documented
 *    order; each slot displays a "Reserved for 005-checkout-payments" body; no value-bearing
 *    props are passed; no money type, no formatter, no input control is rendered.
 *    Lives at `src/renderer/routes/app/checkout/__tests__/CheckoutPlaceholder.test.tsx`.
 *  - `reserved-slot-noop.test.tsx` — for each rendered slot, mounting / hovering (`pointerEnter`)
 *    / focusing / clicking triggers ZERO observable calls to `globalThis.fetch`, `window.api`,
 *    `window.localStorage`, `sessionStorage`, or any payment / printing helper. Spies asserted
 *    at zero.
 */
