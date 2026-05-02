import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

/**
 * Minimal coverage gate for the Phase 2 App stub.
 *
 * `renderToString` is used instead of a DOM-mounting test runner to avoid
 * adding a new dev dependency (e.g. @testing-library/react) just to smoke-test
 * a one-line component. The next phase that adds real UI surface should
 * graduate to a full DOM-based test setup.
 */
describe('App', () => {
  it('renders a <main> element', () => {
    const html = renderToString(<App />);
    expect(html).toContain('<main');
  });
});
