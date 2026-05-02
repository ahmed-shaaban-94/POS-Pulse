import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { registerPingHandler } from './ipc/ping.js';
import { registerAppVersionHandler } from './ipc/app-version.js';

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

app
  .whenReady()
  .then(() => {
    // Register IPC handlers BEFORE the first window loads so the renderer's
    // first call cannot race the registration.
    registerPingHandler(ipcMain);
    registerAppVersionHandler(ipcMain);

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch(console.error);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
