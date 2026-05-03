import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PreloadBridgeAPI } from '../../shared/bridge-api';
import { PAIRING_IPC_CHANNELS, type PairingStatus } from '../../shared/pairing-types';

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

  /**
   * 002-terminal-pairing T014: pairing.getStatus() is now wired to
   * ipcRenderer.invoke(PAIRING_IPC_CHANNELS.GET_STATUS). pairing.submit
   * REMAINS a "not implemented" placeholder until US2 (T026) lands the
   * matching IPC handler.
   */
  it('pairing.getStatus() invokes ipcRenderer with PAIRING_IPC_CHANNELS.GET_STATUS and forwards the result', async () => {
    const expected: PairingStatus = { kind: 'unpaired' };
    ipcRendererInvoke.mockResolvedValueOnce(expected);
    await import('../index');

    const call = exposeInMainWorld.mock.calls[0];
    expect(call).toBeDefined();
    const [, api] = call as [string, PreloadBridgeAPI];

    expect(typeof api.pairing.getStatus).toBe('function');
    const result = await api.pairing.getStatus();
    expect(ipcRendererInvoke).toHaveBeenCalledWith(PAIRING_IPC_CHANNELS.GET_STATUS);
    expect(PAIRING_IPC_CHANNELS.GET_STATUS).toBe('pairing:get-status');
    expect(result).toEqual(expected);
  });

  it('pairing.submit() still rejects with "not implemented" until US2', async () => {
    await import('../index');

    const call = exposeInMainWorld.mock.calls[0];
    expect(call).toBeDefined();
    const [, api] = call as [string, PreloadBridgeAPI];

    expect(typeof api.pairing.submit).toBe('function');
    await expect(api.pairing.submit('any-code')).rejects.toThrow(/not implemented/i);
    // submit MUST NOT call ipcRenderer — there is no handler registered yet
    // for PAIRING_IPC_CHANNELS.SUBMIT, and a leaked invoke would surface as
    // "no handler for channel" in production.
    expect(ipcRendererInvoke).not.toHaveBeenCalled();
  });
});
