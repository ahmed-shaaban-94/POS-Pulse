'use strict';

const { execSync, spawnSync } = require('child_process');
const waitOn = require('wait-on');
const path = require('path');

const ROOT = path.join(__dirname, '..');

waitOn({ resources: ['http://localhost:5173'], timeout: 60000 }, (err) => {
  if (err) {
    console.error('[dev-electron] Vite dev server did not start:', err.message);
    process.exit(1);
  }

  console.log('[dev-electron] Vite ready — compiling main process (ESM) + preload (CJS)...');
  execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit', cwd: ROOT });
  execSync('npx tsc -p tsconfig.preload.json', { stdio: 'inherit', cwd: ROOT });

  console.log('[dev-electron] Launching Electron...');
  // electron package exports the path to the Electron binary
  const electronBin = require('electron');
  spawnSync(String(electronBin), ['.'], {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'development' },
  });
});
