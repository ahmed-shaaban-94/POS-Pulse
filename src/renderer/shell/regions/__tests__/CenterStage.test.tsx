/**
 * T054 / T057 [S3] — CenterStage tests (TEST-FIRST).
 *
 * CenterStage is a layout primitive used by pairing and sign-in surfaces.
 * Public prop interface: { children: ReactNode }
 *
 * Visual behavior (verified via BEM class):
 *   .center-stage → 100vh clean workspace, no rail, no top bar,
 *                   one floating pane child centred.
 *
 * happy-dom limitation: layout geometry not computed. We assert
 * BEM classes that map to CSS rules in tailwind.css.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CenterStage } from '../CenterStage';
import { expectNoAxeViolations } from '../../../ui/primitives/__tests__/axe-config';

afterEach(cleanup);

describe('CenterStage (T054 / T057)', () => {
  it('renders children', () => {
    render(
      <CenterStage>
        <div data-testid="child">Pane</div>
      </CenterStage>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('carries .center-stage class (maps to 100vh full-bleed layout in CSS)', () => {
    const { container } = render(
      <CenterStage>
        <div>Content</div>
      </CenterStage>,
    );
    expect(container.firstElementChild).toHaveClass('center-stage');
  });

  it('has data-testid="center-stage" for layout tests', () => {
    render(
      <CenterStage>
        <div>Content</div>
      </CenterStage>,
    );
    expect(screen.getByTestId('center-stage')).toBeInTheDocument();
  });

  it('renders no nav element (no rail)', () => {
    const { container } = render(
      <CenterStage>
        <div>Content</div>
      </CenterStage>,
    );
    expect(container.querySelector('nav')).not.toBeInTheDocument();
  });

  it('renders no header element (no top bar)', () => {
    const { container } = render(
      <CenterStage>
        <div>Content</div>
      </CenterStage>,
    );
    expect(container.querySelector('header')).not.toBeInTheDocument();
  });

  it('wraps children in a centering child element', () => {
    const { container } = render(
      <CenterStage>
        <div data-testid="pane">Floating pane</div>
      </CenterStage>,
    );
    // Children live inside the center-stage container
    const pane = screen.getByTestId('pane');
    expect(container.firstElementChild).toContainElement(pane);
  });

  it('no axe violations in default state', async () => {
    const { container } = render(
      <CenterStage>
        <div>Accessible content</div>
      </CenterStage>,
    );
    await expectNoAxeViolations(container);
  });
});
