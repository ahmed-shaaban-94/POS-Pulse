import { describe, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { expectNoAxeViolations } from './axe-config';
import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
import { Input } from '../Input/Input';
import { Badge } from '../Badge/Badge';
import { Toast } from '../Toast/Toast';
import { Table } from '../Table/Table';
import { StatusBanner } from '../StatusBanner/StatusBanner';
import { LoadingState } from '../../states/LoadingState';
import { EmptyState } from '../../states/EmptyState';
import { ErrorState } from '../../states/ErrorState';

// T042 — axe baseline smoke on all restyled S2 primitives.
// Zero serious or critical violations.

afterEach(cleanup);

describe('axe baseline smoke — S2 primitives (T042)', () => {
  // ── Button ────────────────────────────────────────────────────────────────

  it('Button primary: no axe violations', async () => {
    const { container } = render(<Button intent="primary">Save</Button>);
    await expectNoAxeViolations(container);
  });

  it('Button secondary: no axe violations', async () => {
    const { container } = render(<Button intent="secondary">Cancel</Button>);
    await expectNoAxeViolations(container);
  });

  it('Button ghost: no axe violations', async () => {
    const { container } = render(<Button intent="ghost">Back</Button>);
    await expectNoAxeViolations(container);
  });

  it('Button destructive: no axe violations', async () => {
    const { container } = render(<Button intent="destructive">Delete</Button>);
    await expectNoAxeViolations(container);
  });

  it('Button disabled: no axe violations', async () => {
    const { container } = render(
      <Button intent="primary" disabled>
        Disabled
      </Button>,
    );
    await expectNoAxeViolations(container);
  });

  it('Button loading: no axe violations', async () => {
    const { container } = render(
      <Button intent="primary" loading>
        Loading
      </Button>,
    );
    await expectNoAxeViolations(container);
  });

  it('Button lg: no axe violations', async () => {
    const { container } = render(
      <Button intent="primary" size="lg">
        Large
      </Button>,
    );
    await expectNoAxeViolations(container);
  });

  // ── Card ─────────────────────────────────────────────────────────────────

  it('Card default: no axe violations', async () => {
    const { container } = render(<Card>Card content</Card>);
    await expectNoAxeViolations(container);
  });

  it('Card muted: no axe violations', async () => {
    const { container } = render(<Card variant="muted">Muted</Card>);
    await expectNoAxeViolations(container);
  });

  it('Card elevated: no axe violations', async () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    await expectNoAxeViolations(container);
  });

  it('Card with aria-labelledby: no axe violations', async () => {
    const { container } = render(
      <div>
        <span id="card-label">Card title</span>
        <Card aria-labelledby="card-label">Card content</Card>
      </div>,
    );
    await expectNoAxeViolations(container);
  });

  // ── Input ─────────────────────────────────────────────────────────────────

  it('Input text: no axe violations', async () => {
    const { container } = render(<Input variant="text" label="Name" />);
    await expectNoAxeViolations(container);
  });

  it('Input password: no axe violations', async () => {
    const { container } = render(<Input variant="password" label="Password" />);
    await expectNoAxeViolations(container);
  });

  it('Input with error: no axe violations', async () => {
    const { container } = render(
      <Input variant="text" label="Email" errorMessage="Invalid email" />,
    );
    await expectNoAxeViolations(container);
  });

  it('Input disabled: no axe violations', async () => {
    const { container } = render(<Input variant="text" label="Read-only" disabled />);
    await expectNoAxeViolations(container);
  });

  // ── Badge ─────────────────────────────────────────────────────────────────

  it('Badge info: no axe violations', async () => {
    const { container } = render(<Badge intent="info">Info</Badge>);
    await expectNoAxeViolations(container);
  });

  it('Badge success: no axe violations', async () => {
    const { container } = render(<Badge intent="success">OK</Badge>);
    await expectNoAxeViolations(container);
  });

  it('Badge warning: no axe violations', async () => {
    const { container } = render(<Badge intent="warning">Warn</Badge>);
    await expectNoAxeViolations(container);
  });

  it('Badge danger: no axe violations', async () => {
    const { container } = render(<Badge intent="danger">Error</Badge>);
    await expectNoAxeViolations(container);
  });

  it('Badge neutral: no axe violations', async () => {
    const { container } = render(<Badge intent="neutral">Neutral</Badge>);
    await expectNoAxeViolations(container);
  });

  // ── Toast ─────────────────────────────────────────────────────────────────

  it('Toast info: no axe violations', async () => {
    const { container } = render(<Toast intent="info" title="Signed out" />);
    await expectNoAxeViolations(container);
  });

  it('Toast success: no axe violations', async () => {
    const { container } = render(<Toast intent="success" title="Saved" />);
    await expectNoAxeViolations(container);
  });

  it('Toast warning: no axe violations', async () => {
    const { container } = render(
      <Toast intent="warning" title="Connection degraded" durationMs={0} />,
    );
    await expectNoAxeViolations(container);
  });

  it('Toast danger: no axe violations', async () => {
    const { container } = render(<Toast intent="danger" title="Offline" durationMs={0} />);
    await expectNoAxeViolations(container);
  });

  // ── Table ─────────────────────────────────────────────────────────────────

  it('Table data state: no axe violations', async () => {
    type Row = { name: string; role: string };
    const cols = [
      { key: 'name' as const, header: 'Name' },
      { key: 'role' as const, header: 'Role' },
    ];
    const rows: Row[] = [{ name: 'Alice', role: 'Cashier' }];
    const { container } = render(<Table rows={rows} columns={cols} />);
    await expectNoAxeViolations(container);
  });

  it('Table empty state: no axe violations', async () => {
    const cols = [{ key: 'name' as const, header: 'Name' }];
    const { container } = render(<Table rows={[]} columns={cols} state="empty" />);
    await expectNoAxeViolations(container);
  });

  it('Table loading state: no axe violations', async () => {
    const cols = [{ key: 'name' as const, header: 'Name' }];
    const { container } = render(<Table rows={[]} columns={cols} state="loading" />);
    await expectNoAxeViolations(container);
  });

  // ── StatusBanner ──────────────────────────────────────────────────────────

  it('StatusBanner online (hidden): no axe violations', async () => {
    const { container } = render(<StatusBanner state="online" />);
    await expectNoAxeViolations(container);
  });

  it('StatusBanner degraded: no axe violations', async () => {
    const { container } = render(<StatusBanner state="degraded" message="Connection degraded" />);
    await expectNoAxeViolations(container);
  });

  it('StatusBanner offline: no axe violations', async () => {
    const { container } = render(<StatusBanner state="offline" message="Offline" />);
    await expectNoAxeViolations(container);
  });

  it('StatusBanner syncing: no axe violations', async () => {
    const { container } = render(<StatusBanner state="syncing" message="Syncing..." />);
    await expectNoAxeViolations(container);
  });

  // ── LoadingState ──────────────────────────────────────────────────────────

  it('LoadingState default: no axe violations', async () => {
    const { container } = render(<LoadingState />);
    await expectNoAxeViolations(container);
  });

  it('LoadingState skeleton variant: no axe violations', async () => {
    const { container } = render(<LoadingState variant="skeleton" />);
    await expectNoAxeViolations(container);
  });

  it('LoadingState centerStage variant: no axe violations', async () => {
    const { container } = render(<LoadingState variant="centerStage" message="Connecting..." />);
    await expectNoAxeViolations(container);
  });

  // ── EmptyState ────────────────────────────────────────────────────────────

  it('EmptyState no action: no axe violations', async () => {
    const { container } = render(
      <EmptyState heading="No operators yet" description="Add an operator to get started." />,
    );
    await expectNoAxeViolations(container);
  });

  it('EmptyState with action: no axe violations', async () => {
    const { container } = render(
      <EmptyState
        heading="No operators yet"
        description="Add an operator to get started."
        action={{ label: 'Add operator', onClick: () => undefined }}
      />,
    );
    await expectNoAxeViolations(container);
  });

  // ── ErrorState ────────────────────────────────────────────────────────────

  it('ErrorState no action: no axe violations', async () => {
    const { container } = render(
      <ErrorState heading="Something went wrong" description="Try again in a moment." />,
    );
    await expectNoAxeViolations(container);
  });

  it('ErrorState with action: no axe violations', async () => {
    const { container } = render(
      <ErrorState
        heading="Something went wrong"
        description="Try again in a moment."
        action={{ label: 'Retry', onClick: () => undefined }}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
