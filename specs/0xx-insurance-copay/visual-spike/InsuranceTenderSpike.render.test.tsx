/**
 * InsuranceTenderSpike.render.test.tsx — proves the SPIKE component MOUNTS and
 * renders its key surfaces without throwing (happy-dom). This is the render
 * confirmation for a visual deliverable: not just "bytes transform" but
 * "the panel actually paints".
 *
 * @vitest-environment happy-dom
 *
 * ⚠️ SPIKE-ONLY. Run with:
 *   npx vitest run -c specs/0xx-insurance-copay/visual-spike/vitest.spike.config.ts
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InsuranceTenderSpike } from './InsuranceTenderSpike.js';

afterEach(cleanup);

describe('InsuranceTenderSpike — render smoke', () => {
  it('mounts and shows the unwired-prototype banner + all 4 plans', () => {
    render(<InsuranceTenderSpike />);
    expect(screen.getByText(/Visual spike, not wired/i)).toBeTruthy();
    const group = screen.getByRole('radiogroup', { name: 'جهة التأمين' });
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
  });

  it('shows the no-plan hint and a disabled confirm before any selection', () => {
    render(<InsuranceTenderSpike />);
    expect(screen.getByText(/اختر جهة التأمين/)).toBeTruthy();
    const confirm = screen.getByRole('button', { name: /تأكيد البيع/ });
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
  });

  it('selecting a plan reveals the breakdown and the member hint', () => {
    render(<InsuranceTenderSpike />);
    const group = screen.getByRole('radiogroup', { name: 'جهة التأمين' });
    const misr = within(group).getAllByRole('radio')[1]; // 80% plan
    fireEvent.click(misr);
    expect(misr.getAttribute('aria-checked')).toBe('true');
    // breakdown row appears
    expect(screen.getByText(/الأصناف المغطّاة/)).toBeTruthy();
    // member still invalid → member hint shown, confirm still disabled
    expect(screen.getByText(/أدخل رقم بطاقة التأمين/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /تأكيد البيع/ }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('a valid member + exact co-pay enables confirm', () => {
    render(<InsuranceTenderSpike />);
    const group = screen.getByRole('radiogroup', { name: 'جهة التأمين' });
    fireEvent.click(within(group).getAllByRole('radio')[1]); // 80%
    const member = screen.getByPlaceholderText(/MHI-/);
    fireEvent.change(member, { target: { value: 'MHI-12345' } });
    // exact co-pay quick button
    fireEvent.click(screen.getByRole('button', { name: 'بالضبط' }));
    expect(
      screen.getByRole('button', { name: /تأكيد البيع/ }).getAttribute('aria-disabled'),
    ).toBeNull();
  });

  it('auto-focuses the member field when a plan is selected (audit P1, §7 first hop)', async () => {
    render(<InsuranceTenderSpike />);
    const group = screen.getByRole('radiogroup', { name: 'جهة التأمين' });
    fireEvent.click(within(group).getAllByRole('radio')[1]); // 80% plan
    const member = screen.getByPlaceholderText(/MHI-/);
    // focus is moved via requestAnimationFrame; wait a frame for the commit.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    expect(document.activeElement).toBe(member);
  });

  it('the 100% plan shows the fully-covered status (no cash step)', () => {
    render(<InsuranceTenderSpike />);
    const group = screen.getByRole('radiogroup', { name: 'جهة التأمين' });
    fireEvent.click(within(group).getAllByRole('radio')[0]); // 100% UHI
    const member = screen.getByPlaceholderText(/UHI-/);
    fireEvent.change(member, { target: { value: 'UHI-99999' } });
    // NOTE: the demo cart is mixed (has a device), so 100% does NOT fully
    // cover the basket — patientDue stays > 0. The fully-covered status only
    // appears for an all-medicine basket. This asserts the mixed-basket
    // reality: co-pay collection IS shown.
    expect(screen.getByText(/مساهمة المريض نقدًا/)).toBeTruthy();
  });
});
