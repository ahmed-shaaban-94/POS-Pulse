/**
 * T057 [S3] — TopBar S3 restyle assertions.
 *
 * Covers:
 * - SmartDataPulse wordmark present in left cluster
 * - Left cluster (.top-bar__left) and right cluster (.top-bar__right)
 * - IdentityStrip inside left cluster
 * - ConnectionIndicator + OperatorSlot in right cluster
 * - StatusBanner outside <header> for non-online states
 * - No device token, no sensitive identifiers in rendered DOM
 * - axe baseline smoke across all connection states
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { TopBar } from '../TopBar';
import { expectNoAxeViolations } from '../../../ui/primitives/__tests__/axe-config';
import type { ConnectionState } from '../../../ui/tokens/connection-state';

afterEach(cleanup);

function renderTopBar(connectionState: ConnectionState = 'online') {
  return render(
    <MemoryRouter>
      <TopBar
        tenantId="Acme Pharmacy"
        branchId="Main St"
        terminalLabel="Counter 1"
        connectionState={connectionState}
      />
    </MemoryRouter>,
  );
}

describe('TopBar S3 restyle (T057)', () => {
  it('renders SmartDataPulse wordmark in left cluster', () => {
    const { container } = renderTopBar();
    const left = container.querySelector('.top-bar__left');
    expect(left).toBeInTheDocument();
    expect(left?.querySelector('.top-bar__wordmark')).toBeInTheDocument();
    expect(screen.getByText('SmartDataPulse')).toBeInTheDocument();
  });

  it('renders IdentityStrip inside left cluster', () => {
    const { container } = renderTopBar();
    const left = container.querySelector('.top-bar__left');
    const strip = left?.querySelector('.identity-strip');
    expect(strip).toBeInTheDocument();
  });

  it('renders ConnectionIndicator inside right cluster', () => {
    const { container } = renderTopBar();
    const right = container.querySelector('.top-bar__right');
    const conn = right?.querySelector('[data-connection-state]');
    expect(conn).toBeInTheDocument();
  });

  it('renders OperatorSlot inside right cluster', () => {
    const { container } = renderTopBar();
    const right = container.querySelector('.top-bar__right');
    const slot = right?.querySelector('.operator-slot');
    expect(slot).toBeInTheDocument();
  });

  it('StatusBanner is rendered outside <header> when connection is non-online', () => {
    const { container } = renderTopBar('degraded');
    const header = container.querySelector('header[role="banner"]');
    // Banner is rendered as a sibling, not inside the header
    const bannerInsideHeader = header?.querySelector('[data-state]');
    expect(bannerInsideHeader).not.toBeInTheDocument();
    // But banner exists in the overall DOM
    expect(container.querySelector('[data-state="degraded"]')).toBeInTheDocument();
  });

  it('no device_token visible in DOM', () => {
    const { container } = renderTopBar();
    const text = container.textContent;
    expect(text).not.toMatch(/device_token/i);
    expect(text).not.toMatch(/tok_/);
  });

  it('wordmark has accessible label', () => {
    renderTopBar();
    const wordmark = screen.getByLabelText('SmartDataPulse');
    expect(wordmark).toBeInTheDocument();
  });

  it.each(['online', 'degraded', 'offline', 'syncing'] as ConnectionState[])(
    'no axe violations for connection state=%s',
    async (state) => {
      const { container } = renderTopBar(state);
      await expectNoAxeViolations(container);
    },
  );
});
