import { type JSX, useEffect, useState } from 'react';

import type {
  OperatorBridgeAPI,
  BranchRosterCashier,
  ResetCashierPinRequest,
  UnlockCashierRequest,
} from '../../../../shared/bridge-api.js';
import { Workspace } from '../../../shell/regions/Workspace.js';

/**
 * T078 — Manager/admin cashier management surface.
 *
 * Route: /app/manager/cashiers  — manager and admin only (AD-1 primary
 * enforced by requireRole in main-process bridge; OperatorRouteGuard is
 * the secondary UX layer here).
 *
 * PR-1 / FR-006 compliance:
 *   - Cashier ids never render in the DOM (minimum disclosure).
 *   - PIN is collected in type="password" input, consumed once, never stored.
 *   - Error messages are generic; refusal categories never reach the DOM.
 *   - unlockCashier request carries no PIN field.
 */

interface Props {
  operator: Pick<OperatorBridgeAPI, 'listBranchRoster' | 'resetCashierPin' | 'unlockCashier'>;
}

type ActionState =
  | { kind: 'idle' }
  | { kind: 'resetPin'; cashier: BranchRosterCashier; pin: string }
  | { kind: 'success'; message: string }
  | { kind: 'error' };

export function CashierManagement({ operator }: Props): JSX.Element {
  const [cashiers, setCashiers] = useState<BranchRosterCashier[] | null>(null);
  const [rosterError, setRosterError] = useState(false);
  const [action, setAction] = useState<ActionState>({ kind: 'idle' });

  useEffect(() => {
    void operator.listBranchRoster().then((res) => {
      if (res.kind === 'roster') {
        setCashiers(res.cashiers);
      } else {
        setRosterError(true);
      }
    });
  }, [operator]);

  async function handleUnlock(cashier: BranchRosterCashier): Promise<void> {
    const req: UnlockCashierRequest = {
      event_id: crypto.randomUUID(),
      target_cashier_id: cashier.id,
    };
    const res = await operator.unlockCashier(req);
    const isSuccessOrNoOp = res.kind === 'unlocked' || res.category === 'state_invalid';
    if (isSuccessOrNoOp) {
      setAction({ kind: 'success', message: 'Cashier unlocked.' });
    } else {
      setAction({ kind: 'error' });
    }
  }

  async function handleResetPinConfirm(): Promise<void> {
    if (action.kind !== 'resetPin') return;
    const req: ResetCashierPinRequest = {
      event_id: crypto.randomUUID(),
      target_cashier_id: action.cashier.id,
      new_pin: action.pin,
    };
    const res = await operator.resetCashierPin(req);
    if (res.kind === 'pin_reset') {
      setAction({ kind: 'success', message: 'PIN reset.' });
    } else {
      setAction({ kind: 'error' });
    }
  }

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (action.kind === 'resetPin') {
      setAction({ ...action, pin: e.target.value });
    }
  }

  return (
    <Workspace title="Cashier Management">
      <div data-testid="cashier-management">
        {rosterError && (
          <p data-testid="cashier-management-error" role="alert">
            Unable to load cashier list. Please try again.
          </p>
        )}

        {cashiers !== null && cashiers.length === 0 && <p>No cashiers on this branch.</p>}

        {cashiers !== null && cashiers.length > 0 && (
          <ul aria-label="Cashier list">
            {cashiers.map((c) => (
              <li key={c.id}>
                <span>{c.display_name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAction({ kind: 'resetPin', cashier: c, pin: '' });
                  }}
                >
                  Reset PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleUnlock(c);
                  }}
                >
                  Unlock
                </button>
              </li>
            ))}
          </ul>
        )}

        {action.kind === 'resetPin' && (
          <div role="dialog" aria-label="Reset PIN">
            <label htmlFor="new-pin-input">New PIN</label>
            <input
              id="new-pin-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={action.pin}
              onChange={handlePinChange}
            />
            <button
              type="button"
              onClick={() => {
                void handleResetPinConfirm();
              }}
            >
              Confirm Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setAction({ kind: 'idle' });
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {action.kind === 'success' && (
          <p data-testid="action-success" role="status">
            {action.message}
          </p>
        )}

        {action.kind === 'error' && (
          <p data-testid="action-error" role="alert">
            Action could not be completed. Please try again.
          </p>
        )}
      </div>
    </Workspace>
  );
}
