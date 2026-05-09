import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'src/renderer',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly if port 5173 is occupied instead of silently using 5174+.
    // dev-electron.cjs waits on exactly port 5173; a port mismatch would
    // attach Electron to a stale server from a previous dev session.
    strictPort: true,
    host: '127.0.0.1',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
