import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Card } from './Card';

afterEach(cleanup);

describe('Card (T017)', () => {
  const variants = ['default', 'muted', 'elevated'] as const;

  it.each(variants)('renders variant=%s', (variant) => {
    render(<Card variant={variant}>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders as <div> by default (no aria-labelledby)', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('div')).toBeInTheDocument();
    expect(container.querySelector('section')).not.toBeInTheDocument();
  });

  it('renders as <section> when aria-labelledby is provided', () => {
    const { container } = render(
      <>
        <h2 id="card-title">Title</h2>
        <Card aria-labelledby="card-title">Content</Card>
      </>,
    );
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<Card>Card body text</Card>);
    expect(screen.getByText('Card body text')).toBeInTheDocument();
  });
});
