import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, it, expect } from 'vitest';

const STYLES_DIR = resolve(__dirname, '..');
const UI_DIR = resolve(__dirname, '../../ui');

const SKIP_DIRS = new Set(['node_modules', '__tests__', 'dist', '.vite']);

function collectFiles(rootDir: string, exts: string[]): string {
  const chunks: string[] = [];
  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      if (SKIP_DIRS.has(name)) continue;
      const fullPath = join(currentDir, name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && exts.some((ext) => name.endsWith(ext))) {
        chunks.push(readFileSync(fullPath, 'utf-8'));
      }
    }
  }
  try {
    walk(rootDir);
  } catch {
    // dir may not exist — tests remain valid (empty content)
  }
  return chunks.join('\n');
}

const stylesContent = collectFiles(STYLES_DIR, ['.css']);
const uiContent = collectFiles(UI_DIR, ['.css', '.ts', '.tsx']);
const allContent = stylesContent + '\n' + uiContent;

describe('no-prefers-color-scheme-follower guard (T019)', () => {
  it('no prefers-color-scheme reference in src/renderer/styles/', () => {
    expect(stylesContent).not.toMatch(/prefers-color-scheme/);
  });

  it('no prefers-color-scheme reference in src/renderer/ui/', () => {
    expect(uiContent).not.toMatch(/prefers-color-scheme/);
  });

  it('no .dark selector in src/renderer/styles/', () => {
    expect(stylesContent).not.toMatch(/\.dark\s*\{/);
  });

  it('one polished light theme only — no dark block anywhere in renderer styles or UI tokens', () => {
    expect(allContent).not.toMatch(/prefers-color-scheme:\s*dark/);
    expect(allContent).not.toMatch(/color-scheme:\s*dark/);
  });
});
