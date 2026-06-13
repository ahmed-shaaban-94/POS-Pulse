/**
 * main.tsx — standalone entry for the insurance co-pay VISUAL SPIKE.
 * Served by Vite for design review; NOT part of the app build.
 *
 *   npx vite specs/0xx-insurance-copay/visual-spike
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { InsuranceTenderSpike } from './InsuranceTenderSpike.js';

const el = document.getElementById('spike-root');
if (el === null) throw new Error('spike-root missing');
createRoot(el).render(
  <StrictMode>
    <InsuranceTenderSpike />
  </StrictMode>,
);
