import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { Table } from './Table';
import type { ColumnDef } from './Table';

afterEach(cleanup);

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
}

const columns: ReadonlyArray<ColumnDef<Row>> = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
];

const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

describe('Table (T021)', () => {
  it('renders native <table> semantics', () => {
    const { container } = render(<Table rows={rows} columns={columns} state="data" />);
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('thead')).toBeInTheDocument();
    expect(container.querySelector('tbody')).toBeInTheDocument();
  });

  it('renders <th scope="col"> headers', () => {
    const { container } = render(<Table rows={rows} columns={columns} state="data" />);
    const headers = container.querySelectorAll('th[scope="col"]');
    expect(headers).toHaveLength(2);
  });

  it('renders data rows', () => {
    render(<Table rows={rows} columns={columns} state="data" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('empty state shows emptyMessage in tbody', () => {
    render(<Table rows={[]} columns={columns} state="empty" emptyMessage="No data found" />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('loading state has role="status"', () => {
    render(<Table rows={[]} columns={columns} state="loading" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('error state shows errorMessage', () => {
    render(<Table rows={[]} columns={columns} state="error" errorMessage="Failed to load" />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});
