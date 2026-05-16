/**
 * T072 — ManagerAttributionPrompt dialog (S3 sensitive action).
 *
 * Generic copy per S0 contact sheet Surface 6 (FR-033 gate).
 * Manager identity is NEVER shown to cashier.
 * Credential field is a layout placeholder — no auth wiring.
 */

import { useState, type JSX } from 'react';

export interface ManagerAttributionPromptProps {
  onApprove: (managerId: string) => void;
  onCancel: () => void;
}

export function ManagerAttributionPrompt({
  onApprove,
  onCancel,
}: ManagerAttributionPromptProps): JSX.Element {
  const [managerId, setManagerId] = useState('');
  const [credential, setCredential] = useState('');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="mgr-attr-title">
      <h2 id="mgr-attr-title">Manager approval required</h2>
      <p>This action needs a manager.</p>
      <div>
        <label htmlFor="mgr-attr-id">Manager ID</label>
        <input
          id="mgr-attr-id"
          type="text"
          value={managerId}
          onChange={(e) => {
            setManagerId(e.target.value);
          }}
        />
      </div>
      <div>
        <label htmlFor="mgr-attr-cred">Credential</label>
        <input
          id="mgr-attr-cred"
          type="text"
          value={credential}
          onChange={(e) => {
            setCredential(e.target.value);
          }}
        />
      </div>
      <div>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          data-variant="primary"
          onClick={() => {
            onApprove(managerId);
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
