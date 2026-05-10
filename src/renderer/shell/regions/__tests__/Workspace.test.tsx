/**
 * T055 / T057 [S3] — Workspace tests (TEST-FIRST).
 *
 * Workspace is a layout primitive used by every signed-in route.
 * Public prop interface: { title?: string; banner?: ReactNode; children: ReactNode }
 *
 * Visual behavior (verified via BEM class):
 *   .workspace          → max-inline-size: 1280px, padded 32–40px,
 *                         single scroll surface
 *   .workspace__header  → optional page header area
 *   .workspace__banner  → optional banner slot
 *   .workspace__body    → body/children slot
 *
 * happy-dom limitation: layout geometry not computed. We assert
 * BEM classes that map to CSS rules in tailwind.css.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Workspace } from '../Workspace';
import { expectNoAxeViolations } from '../../../ui/primitives/__tests__/axe-config';

afterEach(cleanup);

describe('Workspace (T055 / T057)', () => {
  it('renders children', () => {
    render(
      <Workspace>
        <div data-testid="body-content">Body</div>
      </Workspace>,
    );
    expect(screen.getByTestId('body-content')).toBeInTheDocument();
  });

  it('carries .workspace class (maps to max-inline-size: 1280px + padding in CSS)', () => {
    const { container } = render(
      <Workspace>
        <div>Content</div>
      </Workspace>,
    );
    expect(container.firstElementChild).toHaveClass('workspace');
  });

  it('has data-testid="workspace" for layout tests', () => {
    render(
      <Workspace>
        <div>Content</div>
      </Workspace>,
    );
    expect(screen.getByTestId('workspace')).toBeInTheDocument();
  });

  it('renders title in a heading when title prop is provided', () => {
    render(
      <Workspace title="Dashboard">
        <div>Body</div>
      </Workspace>,
    );
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('does not render a heading when title is absent', () => {
    render(
      <Workspace>
        <div>Body</div>
      </Workspace>,
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('renders banner content when banner prop is provided', () => {
    render(
      <Workspace banner={<div data-testid="the-banner">Alert</div>}>
        <div>Body</div>
      </Workspace>,
    );
    expect(screen.getByTestId('the-banner')).toBeInTheDocument();
  });

  it('does not render banner slot when banner prop is absent', () => {
    const { container } = render(
      <Workspace>
        <div>Body</div>
      </Workspace>,
    );
    // No .workspace__banner element in DOM when no banner provided
    expect(container.querySelector('.workspace__banner')).not.toBeInTheDocument();
  });

  it('renders body slot with .workspace__body class', () => {
    const { container } = render(
      <Workspace>
        <div data-testid="body">Content</div>
      </Workspace>,
    );
    expect(container.querySelector('.workspace__body')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  it('title + banner + children all render together', () => {
    render(
      <Workspace title="Sales" banner={<span data-testid="banner">Offline</span>}>
        <div data-testid="content">Cart</div>
      </Workspace>,
    );
    expect(screen.getByRole('heading', { name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByTestId('banner')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('no axe violations — no title, no banner', async () => {
    const { container } = render(
      <Workspace>
        <p>Accessible content</p>
      </Workspace>,
    );
    await expectNoAxeViolations(container);
  });

  it('no axe violations — with title', async () => {
    const { container } = render(
      <Workspace title="Dashboard">
        <p>Content</p>
      </Workspace>,
    );
    await expectNoAxeViolations(container);
  });

  it('no axe violations — with title and banner', async () => {
    const { container } = render(
      <Workspace title="Sales" banner={<div role="status">Syncing</div>}>
        <p>Content</p>
      </Workspace>,
    );
    await expectNoAxeViolations(container);
  });
});
