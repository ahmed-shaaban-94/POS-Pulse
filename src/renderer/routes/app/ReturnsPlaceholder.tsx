/**
 * POS v3.5 Slice 1 — ReturnsPlaceholder (thin "coming soon" pane).
 *
 * The Returns surface is Phase-7 blocked (look-up a prior sale, refund
 * selected lines, produce a negative receipt — see prototype README §7).
 * Until that slice lands, the nav entry routes here to a thin placeholder so
 * the 7-entry rail is fully reachable without implying functionality.
 *
 * Navigation-only: no fetch, no IPC, no persistence, no refund/sale logic.
 */
import type { JSX } from 'react';
import { Workspace } from '../../shell/regions/Workspace';

export function ReturnsPlaceholder(): JSX.Element {
  return (
    <Workspace title="Returns">
      <section className="placeholder-pane">
        <p>Returns are not yet available at this terminal. Coming soon.</p>
      </section>
    </Workspace>
  );
}
