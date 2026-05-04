import type { JSX } from 'react';

export function InventoryPlaceholder(): JSX.Element {
  return (
    <section>
      <h1>Inventory</h1>
      <p>Navigation only — inventory management is not available at this terminal.</p>
    </section>
  );
}
