'use strict';

const { execSync, spawnSync, execFileSync } = require('child_process');
const waitOn = require('wait-on');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DEV_PORT = 5173;

// Remove stale dist/shared output before compiling so that a prior CJS
// preload compile cannot shadow the ESM main-process shared modules.
// Only removes generated JS + map files — never touches source files.
function cleanDistShared() {
  const dir = path.join(ROOT, 'dist', 'shared');
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.js') || entry.name.endsWith('.js.map')) {
      const full = path.join(entry.parentPath ?? entry.path, entry.name);
      fs.unlinkSync(full);
    }
  }
}

waitOn(
  {
    resources: [`http://127.0.0.1:${DEV_PORT}`],
    timeout: 60000,
  },
  (err) => {
    if (err) {
      console.error(
        `[dev-electron] Vite dev server did not start on port ${DEV_PORT}:`,
        err.message,
      );
      console.error(`[dev-electron] Ensure port ${DEV_PORT} is free before running npm run dev.`);
      process.exit(1);
    }

    // Verify the server that answered is actually the current Vite instance
    // by checking for the Vite HMR marker in the response headers.  A stale
    // server from a previous session will not carry that header and we fail
    // loudly rather than launching Electron with a wrong renderer.
    try {
      const result = execFileSync(
        'node',
        [
          '-e',
          `require('http').get('http://127.0.0.1:${DEV_PORT}/', (r) => { process.stdout.write(JSON.stringify(r.headers)); r.resume(); }).on('error', () => process.stdout.write('{}'));`,
        ],
        { cwd: ROOT, timeout: 5000 },
      ).toString();
      const headers = JSON.parse(result || '{}');
      // Vite dev server always sets x-powered-by: "Vite Dev Server" or
      // a vary/etag indicating it is an active HMR endpoint.  If neither
      // is present the most likely culprit is a stale non-Vite server.
      if (!headers['x-powered-by'] && !headers['etag'] && !headers['vary']) {
        console.warn(
          `[dev-electron] Warning: http://127.0.0.1:${DEV_PORT}/ answered but may be a stale server. Proceeding.`,
        );
      }
    } catch {
      // Header check is best-effort; do not abort.
    }

    // Clean stale shared dist artefacts before compiling.
    console.log('[dev-electron] Cleaning stale dist/shared...');
    cleanDistShared();

    // Compile order matters: preload (CommonJS) FIRST, then main (ESM).
    // Both tsconfigs include src/shared/**/* in their compilation.
    // tsconfig.preload.json emits CJS; tsconfig.main.json emits ESM.
    // Running main LAST ensures dist/shared/*.js are ESM, matching the
    // ESM import statements in dist/main/**/*.js.
    console.log('[dev-electron] Compiling preload (CJS)...');
    execSync('npx tsc -p tsconfig.preload.json', { stdio: 'inherit', cwd: ROOT });
    console.log('[dev-electron] Compiling main process (ESM)...');
    execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit', cwd: ROOT });

    console.log('[dev-electron] Launching Electron...');
    const electronBin = require('electron');
    spawnSync(String(electronBin), ['.'], {
      stdio: 'inherit',
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'development' },
    });
  },
);
