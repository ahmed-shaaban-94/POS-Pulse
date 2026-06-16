import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { InventoryPlaceholder } from '../InventoryPlaceholder';

/**
 * 010 diagnostics — the Inventory pane exposes a link to the read-only
 * Catalogue Diagnostics screen. The screen lives at /app/inventory/diagnostics;
 * the primary NavRail is a frozen 6-entry contract, so the screen is reached
 * from WITHIN Inventory (not as a 7th top-level nav item).
 */

afterEach(() => {
  cleanup();
});

describe('InventoryPlaceholder — Catalogue Diagnostics link', () => {
  it('renders a link to the diagnostics route', () => {
    render(
      <MemoryRouter>
        <InventoryPlaceholder />
      </MemoryRouter>,
    );
    const link = screen.getByTestId('inventory-diagnostics-link');
    expect(link).toHaveAttribute('href', '/app/inventory/diagnostics');
  });
});
