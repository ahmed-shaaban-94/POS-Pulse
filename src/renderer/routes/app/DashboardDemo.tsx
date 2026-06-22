/**
 * POS v3.5 Slice 5 — DashboardDemo (dev-only, lazy-loaded).
 *
 * ⚠️ NON-PRODUCTION. Wraps <DashboardView> with the obviously-fake
 * DASHBOARD_DEMO_MODEL behind the loud "DEMO DATA (not real)" banner. This
 * module — and the sample-data it imports — is loaded ONLY via a dynamic
 * `import()` inside the `?demo=1` dev branch of DashboardPlaceholder, so the
 * bundler emits it as a SEPARATE chunk that a production/pilot build never
 * fetches. Verified by the empirical bundle grep in the Slice 5 PR (the demo
 * strings must be absent from the main production JS).
 *
 * Default export so it composes with React.lazy().
 */
import type { JSX } from 'react';

import { Workspace } from '../../shell/regions/Workspace';
import { DashboardView } from './DashboardView';
import { DASHBOARD_DEMO_MODEL } from './dashboard-demo-data';

export default function DashboardDemo(): JSX.Element {
  const banner = (
    <div className="dashboard-demo-banner" data-testid="dashboard-demo-banner" role="note">
      ⚠ بيانات تجريبية — غير حقيقية · DEMO DATA (not real)
    </div>
  );

  return (
    <Workspace banner={banner}>
      <DashboardView model={DASHBOARD_DEMO_MODEL} />
    </Workspace>
  );
}
