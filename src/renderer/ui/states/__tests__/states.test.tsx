import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { LoadingState, EmptyState, ErrorState } from '../index';

afterEach(cleanup);

describe('LoadingState (T012)', () => {
  it('has role="status"', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible text for screen readers', () => {
    render(<LoadingState message="Loading data…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading data…');
  });

  it('does not use hard-coded color styles', () => {
    const { container } = render(<LoadingState />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('');
    expect(el.style.backgroundColor).toBe('');
  });
});

describe('EmptyState (T012)', () => {
  it('renders a heading', () => {
    render(<EmptyState heading="No results" description="Try a different search." />);
    expect(screen.getByRole('heading', { name: 'No results' })).toBeInTheDocument();
  });

  it('renders a description', () => {
    render(<EmptyState heading="No results" description="Try a different search." />);
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
  });

  it('renders a keyboard-reachable call-to-action when provided', () => {
    render(
      <EmptyState
        heading="No results"
        description="Try again."
        action={{ label: 'Retry', onClick: () => {} }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Retry' });
    expect(btn).toBeInTheDocument();
    // Not disabled — must be reachable
    expect(btn).not.toHaveAttribute('disabled');
  });
});

describe('ErrorState (T012)', () => {
  it('renders a heading', () => {
    render(<ErrorState heading="Something went wrong" description="Please try again." />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  });

  it('renders a description', () => {
    render(<ErrorState heading="Something went wrong" description="Please try again." />);
    expect(screen.getByText('Please try again.')).toBeInTheDocument();
  });

  it('renders a keyboard-reachable call-to-action when provided', () => {
    render(
      <ErrorState
        heading="Something went wrong"
        description="Please try again."
        action={{ label: 'Try again', onClick: () => {} }}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Try again' });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toHaveAttribute('disabled');
  });

  it('does not use hard-coded color styles', () => {
    const { container } = render(<ErrorState heading="Error" description="An error occurred." />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('');
  });
});
