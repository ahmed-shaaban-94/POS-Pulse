import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Badge } from './Badge';

afterEach(cleanup);

describe('Badge (T015)', () => {
  const intents = ['info', 'success', 'warning', 'danger', 'neutral'] as const;

  it.each(intents)('renders with intent=%s', (intent) => {
    render(<Badge intent={intent}>{intent}</Badge>);
    expect(screen.getByText(intent)).toBeInTheDocument();
  });

  it('carries accessible name when icon-only via aria-label', () => {
    render(
      <Badge intent="info" aria-label="Info status">
        ℹ
      </Badge>,
    );
    expect(screen.getByLabelText('Info status')).toBeInTheDocument();
  });

  it('renders children as text', () => {
    render(<Badge intent="success">Verified</Badge>);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });
});
