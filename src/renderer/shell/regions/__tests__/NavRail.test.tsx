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
 * T036 — NavRail: 6 entries, accessible names, active state, no hamburger.
 */
describe('NavRail (T036)', () => {
  it('renders exactly 6 nav entries', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });

  it('each entry accessible name matches its label (expanded mode)', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    for (const entry of shellNavEntries) {
      expect(screen.getByText(entry.label)).toBeInTheDocument();
    }
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

  it('icon-only mode: labels become aria-label on links (at 1024–1279px)', () => {
    mockMatchMedia(1024);
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <NavRail />
      </MemoryRouter>,
    );
    for (const entry of shellNavEntries) {
      const link = screen.getByRole('link', { name: entry.label });
      expect(link).toHaveAttribute('aria-label', entry.label);
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
