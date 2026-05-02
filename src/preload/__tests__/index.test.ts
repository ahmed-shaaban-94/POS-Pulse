import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PreloadBridgeAPI } from '../../shared/bridge-api';

const exposeInMainWorld = vi.fn<(name: string, api: unknown) => void>();
const ipcRendererInvoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke: ipcRendererInvoke },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

/**
 * D2 / preload coverage — verifies that the preload script:
 *   - exposes exactly one bridge object on `window.api`,
 *   - routes `ping()` to `ipcRenderer.invoke('app:ping')`,
 *   - routes `appVersion()` to `ipcRenderer.invoke('app:version')`.
 *
 * `contextBridge` and `ipcRenderer` are runtime-mocked so the preload module
 * can be imported in Vitest without a live Electron runtime.
 */
describe('preload bridge', () => {
  it('exposes window.api with ping and appVersion methods', async () => {
    await import('../index');

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const call = exposeInMainWorld.mock.calls[0];
    expect(call).toBeDefined();
    const [name, api] = call as [string, PreloadBridgeAPI];
    expect(name).toBe('api');
    expect(typeof api.ping).toBe('function');
    expect(typeof api.appVersion).toBe('function');
  });

  it('ping() invokes ipcRenderer with channel app:ping and resolves to "pong"', async () => {
    ipcRendererInvoke.mockResolvedValueOnce('pong');
    await import('../index');

    const call = exposeInMainWorld.mock.calls[0];
    expect(call).toBeDefined();
    const [, api] = call as [string, PreloadBridgeAPI];

    const result = await api.ping();
    expect(ipcRendererInvoke).toHaveBeenCalledWith('app:ping');
    expect(result).toBe('pong');
  });

  it('appVersion() invokes ipcRenderer with channel app:version and resolves to a version string', async () => {
    ipcRendererInvoke.mockResolvedValueOnce('0.1.0');
    await import('../index');

    const call = exposeInMainWorld.mock.calls[0];
    expect(call).toBeDefined();
    const [, api] = call as [string, PreloadBridgeAPI];

    const result = await api.appVersion();
    expect(ipcRendererInvoke).toHaveBeenCalledWith('app:version');
    expect(result).toBe('0.1.0');
  });
});
