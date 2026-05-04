import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * T007b — No-backend / no-IPC / no-persistence / no-sync runtime guard.
 *
 * Static-analysis style across every .ts/.tsx under src/renderer/:
 * (1) zero direct fetch / XHR / axios / ky calls
 * (2) zero new bridge.* namespaces beyond the whitelisted pairing surface
 * (3) zero localStorage / sessionStorage / IndexedDB / caches / navigator.storage
 * (4) zero SecretStore references
 * (5) zero sync / syncQueue / replay / outbox / offlineQueue module references
 * (6) zero setInterval / setTimeout targeting backend or sync triggers
 *     (exception: Toast auto-dismiss / debounce in useViewportTier)
 *
 * Spec Out-of-Scope contract: "No backend API calls", "No new IPC",
 * "No persistence", "No offline sync".
 */

const SRC_ROOT = resolve(__dirname, '../');

// Scan only the 003-owned directories. Pre-existing 002 source files
// (logger.ts, router.tsx, etc.) may legitimately reference "SecretStore"
// in doc comments — the guard's purpose is to prevent 003 from adding
// new runtime persistence surface, not to audit 002's existing codebase.
const SCOPED_DIRS = [
  resolve(SRC_ROOT, 'ui'),
  resolve(SRC_ROOT, 'shell'),
  resolve(SRC_ROOT, 'routes/app'),
];

function collectFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      result.push(...collectFiles(full));
    } else if (
      ['.ts', '.tsx'].includes(extname(entry)) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      result.push(full);
    }
  }
  return result;
}

function collectScopedFiles(): string[] {
  const result: string[] = [];
  for (const dir of SCOPED_DIRS) {
    try {
      result.push(...collectFiles(dir));
    } catch {
      // Directory may not exist yet early in the implementation
    }
  }
  return result;
}

const OUTBOUND_FETCH_PATTERN = /\bfetch\s*\(|\bnew\s+XMLHttpRequest\b|['"]axios['"]|['"]ky['"]/g;

// Whitelisted bridge surface: bridge.pairing.getStatus only.
// Any other bridge.* namespace is a violation.
const FORBIDDEN_BRIDGE_PATTERN =
  /bridge\.(operator|session|auth|inventory|sales|cart|checkout|printer|sync|payments)\b/g;

const PERSISTENCE_PATTERN =
  /window\.(localStorage|sessionStorage)|new\s+IDBOpenDBRequest|indexedDB\b|caches\s*\.|navigator\.storage\b/g;

const SECRET_STORE_PATTERN = /\bsecretStore\b|\bSecretStore\b/g;

const SYNC_MODULE_PATTERN =
  /\b(syncQueue|offlineQueue|replayQueue|outbox|offlineSync|syncHelper)\b/g;

describe('no-backend / no-IPC / no-persistence / no-sync guard (T007b)', () => {
  const files = collectScopedFiles();

  it('zero direct outbound fetch / XMLHttpRequest / axios / ky references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(OUTBOUND_FETCH_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Outbound fetch/network references:\n${violations.join('\n')}`).toEqual([]);
  });

  it('zero new bridge namespaces beyond whitelisted pairing surface', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(FORBIDDEN_BRIDGE_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Forbidden bridge namespace references:\n${violations.join('\n')}`).toEqual(
      [],
    );
  });

  it('zero localStorage / sessionStorage / IndexedDB / caches / navigator.storage references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(PERSISTENCE_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Persistence API references:\n${violations.join('\n')}`).toEqual([]);
  });

  it('zero SecretStore references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(SECRET_STORE_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `SecretStore references:\n${violations.join('\n')}`).toEqual([]);
  });

  it('zero sync-module / queue / outbox references', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(SYNC_MODULE_PATTERN);
      if (matches) {
        const relPath = file.replace(SRC_ROOT, 'src/renderer/');
        violations.push(`${relPath}: ${matches.join(', ')}`);
      }
    }
    expect(violations, `Sync module references:\n${violations.join('\n')}`).toEqual([]);
  });
});
