import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';

import { NavRail } from '../NavRail';
import { shellNavEntries } from '../../../../../specs/003-pos-ui-shell/contracts/shell-routes';

afterEach(cleanup);

function mockMatchMedia(width: number): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      // happy-dom has no real MediaQueryList constructor; cast is required in tests.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      return {
        matches: query.includes('min-width: 1280px')
          ? width >= 1280
          : query.includes('min-width: 1024px')
            ? width >= 1024
            : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    }),
  );
}

beforeEach(() => {
  mockMatchMedia(1920);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * T036 — NavRail: 7 entries (POS v3.5), Arabic-first visible labels +
 * stable English accessible names, active state, no hamburger.
 *
 * POS v3.5 Slice 1: the rail renders the Arabic `label` as visible text and
 * uses the English `labelEn` as the link's accessible name (in BOTH expanded
 * and icon-only modes) so screen-reader and test queries stay language-stable
 * while the operator sees Arabic-first copy.
 */
describe('NavRail (T036)', () => {
  it('renders exactly 7 nav entries', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(7);
  });

  it('each entry renders its Arabic label as visible text (expanded mode)', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    for (const entry of shellNavEntries) {
      expect(screen.getByText(entry.label)).toBeInTheDocument();
    }
  });

  it('each entry exposes its English name as the link accessible name (expanded mode)', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    for (const entry of shellNavEntries) {
      expect(screen.getByRole('link', { name: entry.labelEn })).toBeInTheDocument();
    }
  });

  it('includes the new POS v3.5 returns + audit entries with Arabic labels', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    expect(screen.getByText('المرتجعات')).toBeInTheDocument();
    expect(screen.getByText('سجل المراجعة')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Returns' })).toHaveAttribute('href', '/app/returns');
    expect(screen.getByRole('link', { name: 'Audit' })).toHaveAttribute('href', '/app/audit');
  });

  it('nav has aria-label="Primary"', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('no data-testid="hamburger" rendered at expanded width', () => {
    const { container } = render(
      <MemoryRouter>
        <NavRail />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="hamburger"]')).not.toBeInTheDocument();
  });

  it('icon-only mode: English name stays the link accessible name (at 1024–1279px)', () => {
    mockMatchMedia(1024);
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    for (const entry of shellNavEntries) {
      const link = screen.getByRole('link', { name: entry.labelEn });
      expect(link).toHaveAttribute('aria-label', entry.labelEn);
    }
  });

  it('returns null at < 1024px (too-small)', () => {
    mockMatchMedia(1023);
    const { container } = render(
      <MemoryRouter>
        <NavRail />
      </MemoryRouter>,
    );
    expect(container.querySelector('nav')).not.toBeInTheDocument();
  });

  it('no data-testid="hamburger" at < 1024px', () => {
    mockMatchMedia(1023);
    const { container } = render(
      <MemoryRouter>
        <NavRail />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-testid="hamburger"]')).not.toBeInTheDocument();
  });
});
