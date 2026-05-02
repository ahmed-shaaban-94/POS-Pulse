import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron';
import * as Sentry from '@sentry/electron/main';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { registerPingHandler } from './ipc/ping.js';
import { registerAppVersionHandler } from './ipc/app-version.js';
import { registerLogHandler } from './ipc/log.js';
import { registerAppConfigHandler } from './ipc/app-config.js';
import { openDatabase, type DatabaseHandle } from './db/client.js';
import { bindMigrationsDb, readMigrationsFromDisk, runMigrations } from './db/migrate.js';
import { createSecretStore } from './secrets/index.js';
import { createLogger } from './logging/logger.js';
import { initSentryMain } from './observability/sentry-main.js';
import type { AppConfig } from '../shared/app-config.js';

// __dirname is a CJS global; ESM (NodeNext output) requires this polyfill.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env['NODE_ENV'] === 'development';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // Renderer origin allow-list. Dev = Vite server; prod = packaged renderer dir on disk.
  // pathToFileURL produces a normalized file:// URL with forward slashes on Windows.
  const rendererOrigin = isDev
    ? 'http://localhost:5173'
    : pathToFileURL(path.join(__dirname, '../renderer/')).toString();

  // Deny navigation to any URL outside the renderer origin (defense-in-depth against
  // injected redirects, drag-drop URLs, file:// traversal).
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(rendererOrigin)) event.preventDefault();
  });

  // Deny all new-window requests. POS terminals have no pop-out windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Second CSP layer — Electron session headers (first layer is the HTML meta tag).
  // Dev mode allows localhost:5173 so Vite assets and HMR socket are reachable.
  const csp = isDev
    ? [
        "default-src 'self' http://localhost:5173;",
        "script-src 'self' http://localhost:5173;",
        "style-src 'self' 'unsafe-inline' http://localhost:5173;",
        "img-src 'self' data:;",
        "connect-src 'self' ws://localhost:5173 http://localhost:5173;",
      ].join(' ')
    : [
        "default-src 'self';",
        "script-src 'self';",
        "style-src 'self' 'unsafe-inline';",
        "img-src 'self' data:;",
        "connect-src 'self';",
      ].join(' ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

/**
 * Resolve the directory where migration *.sql files live.
 *   - Dev (`npm run dev`): repo-root `./migrations` (cwd is the repo root).
 *   - Packaged: electron-builder ships them via `extraResources` (wiring
 *     deferred — see PR description). For 001 the dev path is the gating
 *     surface for T041's manual smoke.
 */
function resolveMigrationsDir(): string {
  return path.join(process.cwd(), 'migrations');
}

/**
 * Process-lifetime DB handle. Opened once in `app.whenReady()`, used by
 * the migration runner and the SecretStore, closed on app quit (R9).
 * Accessed only from the main process — never exposed to the renderer.
 */
let dbHandle: DatabaseHandle | null = null;

app
  .whenReady()
  .then(async () => {
    // T062 — initialize loggers FIRST inside whenReady, before any
    // other subsystem. `app.getPath('logs')` is only available after
    // `whenReady` fires, so this is the earliest possible site.
    // Two pino instances: one tagged `process: 'main'` writes to
    // main-YYYYMMDD.log; one tagged `process: 'renderer'` writes to
    // renderer-YYYYMMDD.log (records arrive via the app:log IPC).
    const logsDir = app.getPath('logs');
    const appVersion = app.getVersion();
    const mainLogger = await createLogger({
      process: 'main',
      appVersion,
      logsDir,
    });
    const rendererLogger = await createLogger({
      process: 'renderer',
      appVersion,
      logsDir,
    });
    mainLogger.info({ logsDir, appVersion }, 'app:logger-ready');

    // T068 — initialise Sentry AFTER the main logger is up but BEFORE
    // migrations / window creation. Sentry's `init` is wrapped in
    // try/catch inside `initSentryMain`; a thrown init logs one warn
    // line via `mainLogger` and the app continues. With `SENTRY_DSN`
    // unset (the default in `.env.example`), Sentry stays inert — no
    // network calls, no crashes (AS-8).
    initSentryMain({
      sentryInit: Sentry.init,
      logger: mainLogger,
      env: process.env,
      appVersion,
    });

    // T040 + R9 — open ONE shared DB handle, run migrations, then keep
    // the handle alive for the SecretStore. Failure during migrations
    // rethrows into the .catch below, which calls app.exit(1).
    const dbPath = path.join(app.getPath('userData'), 'pos-pulse.db');
    dbHandle = openDatabase(dbPath);
    mainLogger.info({ dbPath }, 'db:opened');

    const files = readMigrationsFromDisk(resolveMigrationsDir());
    runMigrations({ db: bindMigrationsDb(dbHandle), files });
    mainLogger.info({ count: files.length }, 'db:migrations-applied');

    // T048 wire-in: construct the SecretStore on the same long-lived
    // handle to validate factory wiring (production refusal will throw
    // into .catch below per R8). The reference is discarded — feature
    // 002+ will retain it when an actual caller exists. Not exposed to
    // the renderer in 001 (no IPC surface for secrets yet).
    createSecretStore({
      handle: dbHandle,
      safeStorage,
      isPackaged: app.isPackaged,
    });
    // Note (Phase 5 R8): SecretStore still uses console.warn/error
    // placeholders. Swap to mainLogger is a deferred follow-up — out
    // of Phase 8 scope.

    // Register IPC handlers BEFORE the first window loads so the renderer's
    // first call cannot race the registration.
    registerPingHandler(ipcMain);
    registerAppVersionHandler(ipcMain);
    registerLogHandler(ipcMain, rendererLogger);
    // T067 + D3 — renderer pulls its DSN over the bridge; never via
    // `import.meta.env.VITE_*` (which would inline it into the
    // renderer bundle at build time). The closure resolves the DSN
    // per-call, so a future restart-free DSN rotation works without
    // re-architecting the handler.
    const getAppConfig = (): AppConfig => {
      const dsn = process.env['SENTRY_DSN'];
      if (typeof dsn === 'string' && dsn.trim().length > 0) {
        return { sentryDsn: dsn };
      }
      return {};
    };
    registerAppConfigHandler(ipcMain, getAppConfig);

    createWindow();
    mainLogger.info('app:ready');
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((err: unknown) => {
    // R3 + R4: any failure here (logger init, migrations, or
    // SecretStore production refusal) halts launch. We deliberately
    // keep `console.error` here rather than the logger because the
    // logger itself may have failed to initialize.
    console.error('[pos-pulse] fatal startup error:', err);
    closeDbHandle();
    app.exit(1);
  });

function closeDbHandle(): void {
  if (dbHandle !== null) {
    try {
      dbHandle.close();
    } catch (err) {
      console.error('[pos-pulse] failed to close DB handle:', err);
    }
    dbHandle = null;
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDbHandle();
    app.quit();
  }
});

// Defensive cleanup on quit for the macOS path (no-op on Windows but
// keeps invariants symmetric: handle never outlives the app process).
app.on('quit', () => {
  closeDbHandle();
});
