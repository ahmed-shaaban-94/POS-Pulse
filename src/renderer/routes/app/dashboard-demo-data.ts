/**
 * POS v3.5 Slice 5 — DEMO sample data for the dashboard preview.
 *
 * ⚠️ NON-PRODUCTION. This module exists ONLY to populate the dev-only demo
 * dashboard behind the "DEMO DATA (not real)" banner. It is imported strictly
 * INSIDE the `import.meta.env.DEV` branch of DashboardPlaceholder so the
 * production bundle tree-shakes it out entirely — verified by an empirical
 * bundle grep in the Slice 5 PR. No fabricated figure ever ships to a pilot.
 *
 * Real data will arrive via the DP-2 POS-013 dashboard-metrics contract
 * (deferred); it will bind to the SAME DashboardView with no change here.
 */
import type { DashboardViewModel } from './DashboardView';

export const DASHBOARD_DEMO_MODEL: DashboardViewModel = {
  operatorName: 'عرض تجريبي · Demo',
  terminalLabel: 'TERM-DEMO',
  shiftOpenedAt: '08:00',
  stats: [
    { key: 'sales', label: 'عدد المبيعات · Sales', value: '23' },
    { key: 'gross', label: 'الإجمالي · Gross', value: '¤1,240.00', tone: 'gold' },
    { key: 'drawer', label: 'الدرج · Drawer', value: '¤1,790.00' },
    { key: 'credit', label: 'آجل · Credit', value: '¤120.00' },
  ],
  hourly: [
    { hour: '08', count: 1 },
    { hour: '09', count: 4 },
    { hour: '10', count: 6 },
    { hour: '11', count: 5 },
    { hour: '12', count: 3 },
    { hour: '13', count: 2 },
    { hour: '14', count: 2 },
  ],
  topItems: [
    { name: 'باراسيتامول · Paracetamol', count: 12 },
    { name: 'أموكسيسيلين · Amoxicillin', count: 8 },
    { name: 'فيتامين سي · Vitamin C', count: 5 },
  ],
  byMethod: [
    { label: 'نقدي · Cash', count: 14 },
    { label: 'بطاقة · Card', count: 7 },
    { label: 'قسيمة · Voucher', count: 1 },
    { label: 'آجل · Credit', count: 1, tone: 'gold' },
  ],
};
