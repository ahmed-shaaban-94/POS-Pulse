/**
 * POS v3.5 Slice 5 — <DashboardView> (presentational, data-agnostic).
 *
 * The rich v3.5 dashboard LAYOUT recomposed against POS-Pulse tokens from the
 * v3.5 design reference (`docs/design/pos-v3.5/design-reference/pos-app.jsx`):
 * a `ws-head` header, a `stat-strip` KPI row, a `sales-by-hour` sparkline, a
 * `top-items` panel, and a `by-method` breakdown. It renders PURELY from the
 * `DashboardViewModel` prop — NO fetch, NO IPC, NO store access, NO
 * `import.meta.env` branch. Honesty (real data vs sample) is the CALLER's
 * concern.
 *
 * This is deliberately the DURABLE shell: today the dev-only DashboardPlaceholder
 * feeds it sample data behind a DEMO banner; when the DP-2 POS-013 dashboard-
 * metrics contract lands, real data binds to this same component unchanged.
 */
import type { JSX } from 'react';

export interface DashboardStat {
  key: string;
  label: string;
  value: string;
  tone?: 'default' | 'gold';
}

export interface DashboardHourBucket {
  hour: string;
  count: number;
}

export interface DashboardTopItem {
  name: string;
  count: number;
}

export interface DashboardMethodRow {
  label: string;
  count: number;
  tone?: 'default' | 'gold';
}

export interface DashboardViewModel {
  operatorName: string;
  terminalLabel: string;
  shiftOpenedAt: string;
  stats: readonly DashboardStat[];
  hourly: readonly DashboardHourBucket[];
  topItems: readonly DashboardTopItem[];
  byMethod: readonly DashboardMethodRow[];
}

export interface DashboardViewProps {
  model: DashboardViewModel;
  /** Optional banner slot (the DEMO marker is injected here by the dev caller). */
  banner?: JSX.Element;
}

export function DashboardView({ model, banner }: DashboardViewProps): JSX.Element {
  const peak = Math.max(1, ...model.hourly.map((b) => b.count));
  const maxTop = Math.max(1, ...model.topItems.map((t) => t.count));

  return (
    <div className="workspace-pad" data-screen-label="Dashboard" data-testid="dashboard-view">
      {banner}

      <div className="ws-head">
        <div className="ws-head__titles">
          <h1 className="ws-head__title">
            لوحة المتابعة <small>Dashboard</small>
          </h1>
          <p className="ws-head__sub">
            وردية مفتوحة منذ{' '}
            <span className="mono" dir="ltr">
              {model.shiftOpenedAt}
            </span>{' '}
            · {model.operatorName} · <span dir="ltr">{model.terminalLabel}</span>
          </p>
        </div>
      </div>

      <div className="stat-strip">
        {model.stats.map((s) => (
          <div
            key={s.key}
            className={s.tone === 'gold' ? 'stat-cell stat-cell--gold' : 'stat-cell'}
            data-testid={`dashboard-stat-${s.key}`}
          >
            <span className="stat-cell__k">{s.label}</span>
            <span className="stat-cell__v" dir="ltr">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      <div className="ws-grid-2">
        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">
              المبيعات بالساعة <small>Sales by hour</small>
            </h2>
          </div>
          <div className="spark">
            {model.hourly.map((b) => (
              <div className="spark__col" key={b.hour} data-testid="dashboard-spark-col">
                <span
                  className={
                    b.count === peak && b.count > 0 ? 'spark__bar spark__bar--peak' : 'spark__bar'
                  }
                  style={{ height: `${String(Math.round((b.count / peak) * 100))}%` }}
                />
                <span className="spark__t" dir="ltr">
                  {b.hour}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">
              الأكثر مبيعًا <small>Top items</small>
            </h2>
          </div>
          {model.topItems.length === 0 ? (
            <p className="ws-head__sub" style={{ margin: 0 }}>
              لا مبيعات بعد · No sales yet
            </p>
          ) : (
            model.topItems.map((t, i) => (
              <div className="top-item-row" key={t.name}>
                <span className="top-item-row__rank" dir="ltr">
                  {i + 1}
                </span>
                <span className="top-item-row__name">{t.name}</span>
                <span
                  className="top-item-row__bar"
                  style={{ width: `${String(Math.round((t.count / maxTop) * 80) + 8)}px` }}
                />
                <span className="top-item-row__n" dir="ltr">
                  ×{t.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="ws-grid-3">
        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">
              المبيعات حسب الوسيلة <small>By method</small>
            </h2>
          </div>
          <div className="def-rows">
            {model.byMethod.map((r) => (
              <div
                key={r.label}
                className={r.tone === 'gold' ? 'def-row def-row--gold' : 'def-row'}
              >
                <span className="def-row__k">{r.label}</span>
                <span className="def-row__v mono" dir="ltr">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
