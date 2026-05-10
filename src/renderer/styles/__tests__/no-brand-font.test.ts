import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, it, expect } from 'vitest';

const STYLES_DIR = resolve(__dirname, '..');

function collectCssFiles(rootDir: string): string {
  const chunks: string[] = [];
  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      const fullPath = join(currentDir, name);
      if (entry.isDirectory() && name !== '__tests__') {
        walk(fullPath);
      } else if (entry.isFile() && name.endsWith('.css')) {
        chunks.push(readFileSync(fullPath, 'utf-8'));
      }
    }
  }
  walk(rootDir);
  return chunks.join('\n');
}

const styleContents = collectCssFiles(STYLES_DIR);

describe('no-proprietary-brand-font guard (T018)', () => {
  it('no @font-face under src/renderer/styles references Inter Tight', () => {
    const fontFaceBlocks = [...styleContents.matchAll(/@font-face\s*\{[^}]*\}/gs)].map((m) =>
      m[0],
    );
    for (const block of fontFaceBlocks) {
      expect(block).not.toMatch(/Inter Tight/i);
    }
  });

  it('JetBrains Mono is not a primary font face (must only appear in --font-family-mono fallback chain)', () => {
    const fontFaceBlocks = [...styleContents.matchAll(/@font-face\s*\{[^}]*\}/gs)].map((m) =>
      m[0],
    );
    for (const block of fontFaceBlocks) {
      expect(block).not.toMatch(/JetBrains Mono/i);
    }
  });

  it('no proprietary brand font introduced via @font-face', () => {
    const match = styleContents.match(/@font-face[^}]*Inter Tight[^}]*\}/s);
    expect(match).toBeNull();
  });

  it('--font-family-sans begins with Inter Variable, Inter, Segoe UI, system-ui', () => {
    const match = styleContents.match(/--font-family-sans\s*:\s*([^;]+);/);
    expect(match).not.toBeNull();
    const value = (match?.[1] ?? '').trim();
    expect(value).toMatch(/^'Inter Variable',\s*Inter,\s*'Segoe UI',\s*system-ui/);
  });

  it('--font-family-mono begins with ui-monospace', () => {
    const match = styleContents.match(/--font-family-mono\s*:\s*([^;]+);/);
    expect(match).not.toBeNull();
    const value = (match?.[1] ?? '').trim();
    expect(value).toMatch(/^ui-monospace/);
  });
});
