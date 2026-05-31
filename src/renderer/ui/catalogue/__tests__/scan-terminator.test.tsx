import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ScanCaptureField } from '../ScanCaptureField.js';

/**
 * 009 T048 (FR-8 / NFR-6) — scanner Enter-terminator safe submit.
 *
 * A keyboard-wedge scanner types the barcode then sends an Enter terminator.
 * The field must:
 *   - submit the SCANNED value via `onScan` exactly once on Enter (FR-8),
 *   - call `preventDefault` so the Enter does NOT bubble to a surrounding form /
 *     default action (no leak into the cart or an unrelated submit; NFR-6),
 *   - submit nothing for an empty buffer,
 *   - ignore non-Enter keys (the scanner only terminates with Enter).
 * The field stays focus-confined wedge input (`inputMode="none"` — no on-screen
 * keyboard).
 */

afterEach(() => {
  cleanup();
});

describe('ScanCaptureField — Enter-terminator submit (T048)', () => {
  it('submits the buffered value via onScan on Enter, exactly once', () => {
    const onScan = vi.fn();
    render(<ScanCaptureField onScan={onScan} />);
    const input = screen.getByTestId('scan-capture-field');

    fireEvent.change(input, { target: { value: '6221000000001' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('6221000000001');
  });

  it('prevents the default action on Enter (no leak to a surrounding form)', () => {
    const onScan = vi.fn();
    render(<ScanCaptureField onScan={onScan} />);
    const input = screen.getByTestId('scan-capture-field');
    fireEvent.change(input, { target: { value: '6221000000001' } });

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const prevented = !input.dispatchEvent(event);
    expect(prevented).toBe(true); // defaultPrevented → dispatchEvent returns false
  });

  it('clears the buffer after a submit (ready for the next scan)', () => {
    const onScan = vi.fn();
    render(<ScanCaptureField onScan={onScan} />);
    const input = screen.getByTestId('scan-capture-field');

    fireEvent.change(input, { target: { value: 'ABC123' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('');
  });

  it('submits nothing for an empty buffer on Enter', () => {
    const onScan = vi.fn();
    render(<ScanCaptureField onScan={onScan} />);
    const input = screen.getByTestId('scan-capture-field');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores non-Enter keys (no submit mid-scan)', () => {
    const onScan = vi.fn();
    render(<ScanCaptureField onScan={onScan} />);
    const input = screen.getByTestId('scan-capture-field');
    fireEvent.change(input, { target: { value: '622100' } });
    fireEvent.keyDown(input, { key: 'a' });
    expect(onScan).not.toHaveBeenCalled();
  });

  it('is inert (does not throw) when no onScan handler is supplied', () => {
    render(<ScanCaptureField />);
    const input = screen.getByTestId('scan-capture-field');
    fireEvent.change(input, { target: { value: 'X' } });
    expect(() => fireEvent.keyDown(input, { key: 'Enter' })).not.toThrow();
  });

  it('still renders as focus-confined wedge input (inputMode none)', () => {
    render(<ScanCaptureField onScan={vi.fn()} />);
    const input = screen.getByTestId('scan-capture-field');
    expect(input).toHaveAttribute('inputmode', 'none');
  });
});
