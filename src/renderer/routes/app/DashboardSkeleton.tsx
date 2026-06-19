import type { JSX } from 'react';

/**
 * POS v3.5 Phase 4 — Dashboard surface (guarded visual skeleton).
 *
 * Renders the v3.5 dashboard layout (shift-at-a-glance + sales/top-items
 * cards) as honest "coming soon" placeholders. NONE of these have a
 * renderer-facing data source yet:
 *   - Shift state / Z-report → shift behavior is deferred (POS-015 + DP-2
 *     shift contract, gated).
 *   - Today's sales count/total, top items → no dashboard-metrics contract
 *     (deferred to POS-013).
 *
 * HARD RULES (owner directive, Phase 4): do NOT fabricate any metric. Every
 * card is value-free. The skeleton performs no fetch and no storage access
 * (mirrors the existing DashboardPlaceholder contract). Role-gating stays in
 * DashboardRoute (the functional part); this is the signed-in shell body.
 */

interface DashboardCard {
  key: string;
  title: string;
  description: string;
}

const CARDS: readonly DashboardCard[] = [
  {
    key: 'shift',
    title: 'Current shift',
    description: 'Shift open time, float, and close / Z-report.',
  },
  {
    key: 'sales-today',
    title: "Today's sales",
    description: 'Count and total for the current day.',
  },
  {
    key: 'top-items',
    title: 'Top items',
    description: 'Best-selling items for the current shift.',
  },
];

export function DashboardSkeleton(): JSX.Element {
  return (
    <div className="dashboard-skeleton" data-testid="dashboard-skeleton">
      {CARDS.map((card) => (
        <section
          key={card.key}
          className="dashboard-card dashboard-card--coming-soon"
          data-testid={`dashboard-card-${card.key}`}
          data-functional="false"
          aria-label={card.title}
        >
          <div className="dashboard-card__head">
            <h2 className="dashboard-card__title">{card.title}</h2>
            <span className="dashboard-card__badge">Coming soon</span>
          </div>
          <p className="dashboard-card__hint">{card.description}</p>
        </section>
      ))}
    </div>
  );
}
