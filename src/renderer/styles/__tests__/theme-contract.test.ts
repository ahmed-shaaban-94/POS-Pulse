import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * POS v3.5 Phase 1 — theme-contract guard (ADR-0004).
 *
 * REPLACES the legacy T019 "no-dark-mode" guard. T019 forbade any dark
 * register at all (the terminal was light-only). ADR-0004 reopens that
 * product decision: dark is now the DEFAULT register and light is a
 * token-only toggle target. This guard enforces the NEW contract so the
 * decision cannot silently regress:
 *
 *   1. The dark register exists and is keyed on the document root attribute.
 *   2. Dark is the DEFAULT — baked into index.html and the store default.
 *   3. The toggle flips token VALUES ONLY — every declaration in the dark
 *      block is a `--*` custom property (plus the one allowlisted
 *      `color-scheme`), and the block introduces NO new component-class
 *      selector. This is what actually prevents forked dark components.
 *   4. Selection persists to localStorage and re-hydrates.
 *   5. RTL is systemic at the root (Arabic-first).
 */

const STYLES_DIR = resolve(__dirname, '..');
const RENDERER_DIR = resolve(__dirname, '../..');

const tailwindCss = readFileSync(resolve(STYLES_DIR, 'tailwind.css'), 'utf-8');
const indexHtml = readFileSync(resolve(RENDERER_DIR, 'index.html'), 'utf-8');

/**
 * Extract the body of the dark register block
 * (`:root[data-theme='dark'] { … }`). The selector's specificity (0,2,0)
 * makes it win over :root regardless of order — asserted indirectly by the
 * selector shape below.
 */
function extractDarkBlock(css: string): string {
  const match = css.match(/:root\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/);
  return match?.[1] ?? '';
}

describe('theme contract — dark default + light toggle (ADR-0004, replaces T019)', () => {
  // 1 — dark register present, keyed on the root attribute
  it('defines a dark register on :root[data-theme="dark"]', () => {
    expect(tailwindCss).toMatch(/:root\[data-theme=['"]dark['"]\]\s*\{/);
  });

  it('the dark register overrides the core surface + ink tokens', () => {
    const block = extractDarkBlock(tailwindCss);
    expect(block).toMatch(/--color-background:/);
    expect(block).toMatch(/--color-surface:/);
    expect(block).toMatch(/--color-text:/);
    expect(block).toMatch(/--color-primary:/);
  });

  // 2 — dark is the DEFAULT
  it('index.html bakes data-theme="dark" on <html> as the flash-free default', () => {
    expect(indexHtml).toMatch(/<html[^>]*\bdata-theme=['"]dark['"]/);
  });

  // 3 — token-VALUE overrides only: no forked components, no stray properties
  it('every declaration in the dark register is a custom-property override (color-scheme allowlisted)', () => {
    const block = extractDarkBlock(tailwindCss);
    expect(block.length).toBeGreaterThan(0);
    // Strip comments from the WHOLE block first — a comment may contain a `;`
    // (e.g. prose), so splitting on `;` before stripping would leave a stray
    // comment fragment masquerading as a declaration.
    const declarations = block
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.length > 0)
      .filter((d) => d.includes(':'));
    for (const decl of declarations) {
      const property = decl.split(':')[0]?.trim() ?? '';
      const ok = property.startsWith('--') || property === 'color-scheme';
      expect(ok, `dark register has a non-token declaration: "${decl}"`).toBe(true);
    }
  });

  it('the dark register introduces NO component-class selector (no forked dark components)', () => {
    const match = tailwindCss.match(/:root\[data-theme=['"]dark['"]\]\s*\{([\s\S]*?)\n\}/);
    const block = match?.[1] ?? '';
    // A nested selector inside the block would show a `{` — token overrides never do.
    expect(block).not.toContain('{');
    // And there is exactly one dark-register selector (no `.dark .foo`-style forks).
    const forkedSelectors = tailwindCss.match(/\[data-theme=['"]dark['"]\]\s+\.[a-z]/gi);
    expect(forkedSelectors).toBeNull();
  });

  // 5 — RTL systemic at the root
  it('index.html sets dir="rtl" lang="ar" at the root (Arabic-first, systemic RTL)', () => {
    expect(indexHtml).toMatch(/<html[^>]*\bdir=['"]rtl['"]/);
    expect(indexHtml).toMatch(/<html[^>]*\blang=['"]ar['"]/);
  });
});

describe('theme store — default, toggle, persistence (ADR-0004)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to dark when nothing is persisted', async () => {
    const { readPersistedTheme, DEFAULT_THEME } = await import('../../stores/theme-store');
    expect(DEFAULT_THEME).toBe('dark');
    expect(readPersistedTheme()).toBe('dark');
  });

  it('initTheme applies the default and sets the root attribute', async () => {
    const { initTheme, useThemeStore } = await import('../../stores/theme-store');
    initTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggling flips dark → light, persists, and repaints the root', async () => {
    const { initTheme, useThemeStore, THEME_STORAGE_KEY } =
      await import('../../stores/theme-store');
    initTheme();
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('re-hydrates the persisted light choice on next boot', async () => {
    const { initTheme, useThemeStore, THEME_STORAGE_KEY } =
      await import('../../stores/theme-store');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const applied = initTheme();
    expect(applied).toBe('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to dark on a corrupt persisted value', async () => {
    const { readPersistedTheme, THEME_STORAGE_KEY } = await import('../../stores/theme-store');
    localStorage.setItem(THEME_STORAGE_KEY, 'midnight');
    expect(readPersistedTheme()).toBe('dark');
  });
});
