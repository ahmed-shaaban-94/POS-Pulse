import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';

import { useOperatorSessionStore } from '../../stores/operator-session-store';
import { ErrorState } from '../../ui/states';
import { Workspace } from '../../shell/regions/Workspace';
import { DashboardPlaceholder } from './DashboardPlaceholder';

export function DashboardRoute(): JSX.Element {
  const state = useOperatorSessionStore((s) => s.state);

  if (state.kind !== 'signedIn') {
    return <Navigate to="/sign-in" replace />;
  }

  if (state.session.role === 'cashier') {
    return (
      <Workspace title="Section unavailable">
        <ErrorState
          heading="Section unavailable"
          description="This section is not available for your role."
        />
      </Workspace>
    );
  }

  return <DashboardPlaceholder />;
}
