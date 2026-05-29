import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron';
import * as Sentry from '@sentry/electron/main';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { registerPingHandler } from './ipc/ping.js';
import { registerAppVersionHandler } from './ipc/app-version.js';
import { registerLogHandler } from './ipc/log.js';
import { registerAppConfigHandler } from './ipc/app-config.js';
import { registerPairingHandlers } from './ipc/pairing.js';
import { registerOperatorHandlers } from './ipc/operator.js';
import { registerCartHandlers } from './ipc/cart.js';
import { createCartBridgeHandlers } from './cart/wire-cart-handlers.js';
import { registerPaymentsHandlers } from './ipc/payments.js';
import { bindPaymentAttemptsRepository } from './payments/repositories/payment-attempts.repository.js';
import { bindPaymentTenderLinesRepository } from './payments/repositories/payment-tender-lines.repository.js';
import { bindPaymentActionOutboxRepository } from './payments/repositories/payment-action-outbox.repository.js';
import { createPaymentAttemptFsm } from './payments/fsm/payment-attempt-fsm.js';
import { createTenderLineFsm } from './payments/fsm/tender-line-fsm.js';
import { createIdempotencyHelper } from './payments/idempotency.js';
import { createPaymentAuditEmitter, type PaymentAuditEvent } from './payments/audit-emitter.js';
import { createPaymentsStartHandler } from './payments/handlers/payments-start.js';
import { createPaymentsConfirmHandler } from './payments/handlers/payments-confirm.js';
import { createPaymentsCancelHandler } from './payments/handlers/payments-cancel.js';
import { createPaymentsForceFailHandler } from './payments/handlers/payments-force-fail.js';
import { createPaymentsSubscribeHandler } from './payments/handlers/payments-subscribe.js';
import { createPaymentsReadHandler } from './payments/handlers/payments-read.js';
import { createTenderApplyHandler } from './payments/handlers/tender-apply.js';
import { createTenderReverseHandler } from './payments/handlers/tender-reverse.js';
import { createTenderReadHandler } from './payments/handlers/tender-read.js';
import { createDeferredReversalResolver } from './payments/deferred-reversal-resolver.js';
import {
  reverseVoucher,
  type ReverseVoucherInput,
  type ReverseVoucherOutcome,
} from './payments/voucher-authority/reverse.js';
import type { ActionCategory as Audit004ActionCategory } from '../shared/audit/event-shape.js';
import type { OperatorSessionForPayments } from './payments/require-operator-session.js';
// 008-sale-finalization-and-receipts Slice 1c.3 (T094c) — AD-2 worker + sales.* bridge.
import { registerSalesHandlers } from './ipc/sales.js';
import { bindSalesRepository } from './sales/repositories/sales.repository.js';
import { bindPrintEventsRepository } from './sales/repositories/print-events.repository.js';
import { bindDrawerEventsRepository } from './sales/repositories/drawer-events.repository.js';
import { bindSaleSyncOutboxRepository } from './sync-outbox/sale-sync-outbox.repository.js';
import { bindSaleNumberAllocator } from './sales/sale-number-allocator.js';
import { createSaleAuditEmitter, type SaleAuditEvent } from './sales/audit-emitter.js';
import { bindFinalizeTransaction } from './sales/finalize-transaction.js';
import { buildFinalizeInput } from './sales/finalize-dispatch.js';
import { createFinalizeListener } from './sales/finalize-listener.js';
import { createSalesBridge } from './sales/sales-bridge.js';
import { createReceiptsBridge } from './receipts/receipts-bridge.js';
import { registerReceiptsHandlers } from './ipc/receipts.js';
import { createPrintPipeline } from './receipts/print-pipeline.js';
import { createEscposAdapter } from './receipts/escpos-adapter.js';
import { createOsPrintAdapter } from './receipts/os-print-adapter.js';
import { createPrintDispatcher } from './receipts/print-dispatcher.js';
import { dispatchFirstPrintOnFinalize } from './receipts/dispatch-first-print-on-finalize.js';
import { randomUUID } from 'node:crypto';
import { openDatabase, type DatabaseHandle } from './db/client.js';
import { bindMigrationsDb, readMigrationsFromDisk, runMigrations } from './db/migrate.js';
import { createSecretStore } from './secrets/index.js';
import { createLogger } from './logging/logger.js';
import { initSentryMain } from './observability/sentry-main.js';
import { bindPairingStoreDb, createPairingStore } from './pairing/store.js';
import { applyDevSkipPairingIfRequested } from './pairing/dev-skip-pairing.js';
import { applyDevSkipOperatorSignInIfRequested } from './operator/dev-skip-operator-signin.js';
import { AuditEmitter } from './audit/audit-emitter.js';
import { bindAuditEventsStoreDb } from './audit/audit-events-store.js';
import { createNetwork } from './pairing/network.js';
import { createPairingService } from './pairing/service.js';
import { createPairingLog } from './pairing/log.js';
import {
  createClerkExchanger,
  decodeFrontendApiBaseUrl,
  type ClerkExchanger,
} from './operator/clerk-client.js';
import { createBackendClient } from './operator/backend-client.js';
import { SessionManager } from './operator/session-manager.js';
import { CashierSignInHandler, SignInHandler } from './operator/sign-in-handler.js';
import { SignOutHandler } from './operator/sign-out-handler.js';
import { CheckActiveSessionHandler } from './operator/check-active-session.js';
import { RosterHandler } from './operator/roster-handler.js';
import { InactivityMonitor } from './operator/inactivity-monitor.js';
import { LifecycleCascade } from './operator/lifecycle-cascade.js';
import { createJwtHolder } from './operator/jwt-holder.js';
import { ProtoSessionStore, TakeoverHandler } from './operator/takeover-handler.js';
import { PinManagementHandler } from './operator/pin-management.js';
import { ForcedCloseHandler } from './operator/forced-close-handler.js';
import { StuckShiftsHandler } from './operator/stuck-shifts-handler.js';
import { makeSecretKey } from '../shared/secret-store.js';
import type { AppConfig } from '../shared/app-config.js';

/**
 * 002-terminal-pairing US2: API base URL for the pair endpoint. Reads
 * `VITE_API_BASE_URL` from `process.env` (Vite does NOT prefix-filter
 * the main bundle — main is built with tsc, not Vite). Falls back to
 * the constitution-blessed production host when unset.
 */
const DEFAULT_API_BASE_URL = 'https://api.smartdatapulse.tech';

function resolveApiBaseUrl(): string {
  const fromEnv = process.env['VITE_API_BASE_URL'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv;
  return DEFAULT_API_BASE_URL;
}

/**
 * 002-terminal-pairing US1: SecretStore key under which the device
 * token is held. Single source of truth — re-used by the pairing store
 * here AND any future feature that reads the token to set
 * `X-Terminal-Token` on backend calls.
 */
const DEVICE_TOKEN_KEY = makeSecretKey('terminal.device-token');

/**
 * 004-operator-session — resolve the production `ClerkExchanger`.
 *
 * Decodes the Clerk Frontend API host from `CLERK_PUBLISHABLE_KEY`.
 * When unset or malformed, returns a stub that always refuses so the
 * app still launches in dev without a Clerk tenant configured (the
 * `/sign-in` route renders; submit fails with the generic
 * `invalid_input` refusal). CI / production builds set the key.
 *
 * The publishable key itself is NOT a secret — it identifies the
 * Clerk instance for client-side use.
 */
function resolveClerkExchanger(logger: {
  warn(payload: object, msg: string): void;
}): ClerkExchanger {
  const pk = process.env['CLERK_PUBLISHABLE_KEY'];
  if (typeof pk !== 'string' || pk.length === 0) {
    logger.warn(
      { event: 'operator.clerk.missing_publishable_key' },
      'CLERK_PUBLISHABLE_KEY unset; sign-in will refuse generically until configured.',
    );
    return { exchange: () => Promise.resolve({ kind: 'refused' as const }) };
  }
  const fapi = decodeFrontendApiBaseUrl(pk);
  if (fapi === null) {
    logger.warn(
      { event: 'operator.clerk.malformed_publishable_key' },
      'CLERK_PUBLISHABLE_KEY malformed; sign-in will refuse generically until corrected.',
    );
    return { exchange: () => Promise.resolve({ kind: 'refused' as const }) };
  }
  return createClerkExchanger({
    frontendApiBaseUrl: fapi,
    fetch: globalThis.fetch.bind(globalThis),
  });
}

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
        // 'unsafe-inline' required for @vitejs/plugin-react preamble injection
        // (inline <script type="module"> in <head>) — dev only, never in prod.
        "script-src 'self' 'unsafe-inline' http://localhost:5173;",
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

/**
 * 008 (T094c) — process-lifetime AD-2 finalize worker. Started in
 * `app.whenReady()` behind the `sale_finalization` flag, stopped on quit so
 * the setInterval driver never outlives the process. `null` when the flag
 * is off or before bootstrap.
 */
let finalizeListenerStop: (() => void) | null = null;

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
    // into .catch below per R8). 002 US1 retains the reference because
    // the pairing store now consumes it.
    const secretStore = createSecretStore({
      handle: dbHandle,
      safeStorage,
      isPackaged: app.isPackaged,
    });
    // Note (Phase 5 R8): SecretStore still uses console.warn/error
    // placeholders. Swap to mainLogger is a deferred follow-up — out
    // of Phase 8 scope.

    // 002-terminal-pairing T011/T013 — construct the pairing store on
    // the shared DB handle + SecretStore. The store is the only module
    // that touches both halves of pairing state.
    const pairingStore = createPairingStore({
      secretStore,
      db: bindPairingStoreDb(dbHandle),
      deviceTokenKey: DEVICE_TOKEN_KEY,
    });

    // 002-terminal-pairing dev bypass — seeds fixture pairing state so the
    // renderer routes past /pairing in unpackaged dev builds.
    // SECURITY: isPackaged guard is inside applyDevSkipPairingIfRequested;
    // this call is a no-op in every packaged build regardless of env vars.
    await applyDevSkipPairingIfRequested({
      isPackaged: app.isPackaged,
      env: process.env,
      pairingStore,
      logger: mainLogger,
    });

    // 002-terminal-pairing T021/T023/T025 — construct the pairing
    // service. The service composes network.pair() + pairingStore.persist()
    // + a schema-restricted pairingLog. Resolve-on-reachable, reject-only-
    // on-transport network contract is locked from PR #17. The IPC
    // handler below routes `pairing:submit` here.
    const pairingNetwork = createNetwork({
      fetch: globalThis.fetch.bind(globalThis),
      baseUrl: resolveApiBaseUrl(),
    });
    const pairingService = createPairingService({
      store: pairingStore,
      network: pairingNetwork,
      pairingLog: createPairingLog(mainLogger),
      clock: () => new Date(),
    });

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
      const cfg: AppConfig = {};
      const dsn = process.env['SENTRY_DSN'];
      if (typeof dsn === 'string' && dsn.trim().length > 0) {
        cfg.sentryDsn = dsn;
      }
      // 005-sales-cart T001 — cart feature flag (default false).
      // Truthy values: '1', 'true', 'yes', 'on' (case-insensitive).
      // Anything else, or unset, leaves the flag disabled.
      const cartRaw = process.env['POS_PULSE_FEATURE_CART'];
      const cartEnabled =
        typeof cartRaw === 'string' &&
        ['1', 'true', 'yes', 'on'].includes(cartRaw.trim().toLowerCase());
      // 006-payments-tender S1 — payments feature flag (default false).
      // The type + renderer-store binding shipped with 006; the env-var read was missed
      // at the time. This backfill brings 006 in line with the cart pattern: same truthy-
      // value contract; disabled-by-default is the fail-safe (PaymentSurface stays hidden
      // and 005's cart-handoff slot falls back to its pre-006 behaviour).
      const paymentsRaw = process.env['POS_PULSE_FEATURE_PAYMENTS'];
      const paymentsEnabled =
        typeof paymentsRaw === 'string' &&
        ['1', 'true', 'yes', 'on'].includes(paymentsRaw.trim().toLowerCase());
      // 008-sale-finalization-and-receipts T002 — sale_finalization feature flag (default false).
      // Same truthy-value contract as cart. Disabled-by-default is the fail-safe: 006 still
      // settles payments but 008's finalize listener short-circuits — no receipt prints, no
      // drawer kicks, no audit-event emits. See `docs/runbook/008-sale-finalization-and-receipts.md`
      // (authored at Slice 6 T524 / T525) for the rollback path.
      const saleFinalizationRaw = process.env['POS_PULSE_FEATURE_SALE_FINALIZATION'];
      const saleFinalizationEnabled =
        typeof saleFinalizationRaw === 'string' &&
        ['1', 'true', 'yes', 'on'].includes(saleFinalizationRaw.trim().toLowerCase());
      cfg.features = {
        cart: cartEnabled,
        payments: paymentsEnabled,
        saleFinalization: saleFinalizationEnabled,
      };
      return cfg;
    };
    registerAppConfigHandler(ipcMain, getAppConfig);

    // 002-terminal-pairing T013 + T025 — wire BOTH pairing channels.
    // T025 lands `pairing:submit`; the SUBMIT handler validates the
    // argument shape and forwards the service result unchanged.
    registerPairingHandlers(ipcMain, { store: pairingStore, service: pairingService });

    // 004-operator-session — wire `operator.*` IPC.
    //
    // Clerk credential exchange happens HERE in the main process; the
    // password NEVER reaches Data-Pulse-2 (Wave 1 path b / AD-2 /
    // Constitution v1.5.1). The Clerk Frontend API host is decoded
    // from the publishable key (`CLERK_PUBLISHABLE_KEY` env var). If
    // the key is unset or malformed in dev, we wire a stub exchanger
    // that always refuses — the app still launches and `/sign-in` is
    // reachable, but submit fails with the generic refusal copy. CI
    // and production builds set the key; the stub is dev-only.
    const operatorJwtHolder = createJwtHolder();
    const operatorSessionManager = new SessionManager();
    const apiBaseUrl = resolveApiBaseUrl();
    const operatorBackend = createBackendClient({
      baseUrl: apiBaseUrl,
      fetch: globalThis.fetch.bind(globalThis),
    });
    const operatorProtoStore = new ProtoSessionStore();
    const clerkExchanger = resolveClerkExchanger(mainLogger);
    const deviceTokenAttestation = async (): Promise<string> => {
      const status = await pairingStore.getStatus();
      if (status.kind !== 'paired') return '';
      const token = await secretStore.get(DEVICE_TOKEN_KEY);
      return token ?? '';
    };
    const operatorSignInHandler = new SignInHandler({
      clerk: clerkExchanger,
      backend: operatorBackend,
      sessionManager: operatorSessionManager,
      jwtHolder: operatorJwtHolder,
      protoStore: operatorProtoStore,
      // Wave 1: device-token attestation = the device token itself
      // (read from SecretStore via the pairingStore). The backend
      // verifies it server-side. The token is NEVER logged.
      deviceTokenAttestation,
      logger: mainLogger,
    });
    const checkActiveSessionHandler = new CheckActiveSessionHandler({
      backend: operatorBackend,
    });
    const operatorCashierSignInHandler = new CashierSignInHandler({
      db: dbHandle,
      safeStorage,
      sessionManager: operatorSessionManager,
      checkActiveSession: checkActiveSessionHandler,
      pairingStore,
      protoStore: operatorProtoStore,
      secretStore,
      logger: mainLogger,
    });
    const operatorSignOutHandler = new SignOutHandler({
      backend: operatorBackend,
      sessionManager: operatorSessionManager,
      jwtFor: (sessionId) => operatorJwtHolder.get(sessionId),
      clearJwt: (sessionId) => {
        operatorJwtHolder.clear(sessionId);
      },
      logger: mainLogger,
    });
    const operatorRosterHandler = new RosterHandler({
      backend: operatorBackend,
      logger: mainLogger,
    });
    const operatorInactivityMonitor = new InactivityMonitor({
      sessionManager: operatorSessionManager,
    });
    operatorInactivityMonitor.start();

    // T051b + T051d — lifecycle cascade for terminal-revocation (FR-014) and
    // account-disabled-mid-session edge cases. The cascade holds the session-
    // manager reference so the future US7 401-interceptor can call
    // operatorLifecycleCascade.notifyTerminalRevoked() /
    // operatorLifecycleCascade.notifyAccountDisabled() without importing any
    // singleton. Exported as a module-level let so future interceptors can
    // reach it; it is NOT exposed to the renderer bridge.
    const operatorLifecycleCascade = new LifecycleCascade({
      sessionManager: operatorSessionManager,
      logger: mainLogger,
    });
    // Suppress "declared but never read" until the US7 interceptor wires it.
    void operatorLifecycleCascade;

    // T048 — construct the audit-events outbox chain on the shared DB handle.
    // Lazy statement preparation in bindAuditEventsStoreDb ensures migration
    // T045 has already run before the first emit call.
    const auditEventsStore = bindAuditEventsStoreDb(dbHandle);
    const auditEmitter = new AuditEmitter(auditEventsStore);

    const operatorTakeoverHandler = new TakeoverHandler({
      protoStore: operatorProtoStore,
      sessionManager: operatorSessionManager,
      backend: operatorBackend,
      jwtHolder: operatorJwtHolder,
      auditEmitter,
      pairingStore,
      deviceTokenAttestation,
      logger: mainLogger,
    });

    const operatorPinManagementHandler = new PinManagementHandler({
      db: dbHandle,
      safeStorage,
      sessionManager: operatorSessionManager,
      pairingStore,
      auditEmitter,
      logger: mainLogger,
    });

    // 004-operator-session dev bypass — seeds a fixture manager session so
    // the renderer routes past /sign-in in unpackaged dev builds.
    // SECURITY: isPackaged guard is inside applyDevSkipOperatorSignInIfRequested;
    // this call is a no-op in every packaged build regardless of env vars.
    // Independent from POS_PULSE_DEV_SKIP_PAIRING; both may be set together.
    applyDevSkipOperatorSignInIfRequested({
      isPackaged: app.isPackaged,
      env: process.env,
      sessionManager: operatorSessionManager,
      logger: mainLogger,
    });

    registerOperatorHandlers(ipcMain, {
      signInHandler: operatorSignInHandler,
      cashierSignInHandler: operatorCashierSignInHandler,
      signOutHandler: operatorSignOutHandler,
      rosterHandler: operatorRosterHandler,
      sessionManager: operatorSessionManager,
      inactivityMonitor: operatorInactivityMonitor,
      auditEmitter,
      pairingStore,
      takeoverHandler: operatorTakeoverHandler,
      pinManagementHandler: operatorPinManagementHandler,
      forcedCloseHandler: new ForcedCloseHandler({
        db: dbHandle,
        sessionManager: operatorSessionManager,
        pairingStore,
        auditEmitter,
      }),
      stuckShiftsHandler: new StuckShiftsHandler({
        sessionManager: operatorSessionManager,
        backendClient: operatorBackend,
        jwtHolder: operatorJwtHolder,
      }),
    });

    // 005-sales-cart S2 — register `cart:*` IPC with DB-backed CartStore.
    // resolveItemRef defaults to the refusing stub in cart-bridge.ts until
    // the item-catalogue feature ships (T053 / R7).
    const cartBridgeHandlers = createCartBridgeHandlers({
      dbHandle,
      getCurrentSession: () => operatorSessionManager.getCurrent(),
      logger: mainLogger,
      auditEmitter,
      isPackaged: app.isPackaged,
    });
    registerCartHandlers(ipcMain, { handlers: cartBridgeHandlers });

    // 006-payments-tender Slice 3 (T142 + F-002/F-003/F-004) — wire the
    // payments.* + tender.* bridge surface. The 8 handler factories share
    // the three S3a repositories, both FSMs, and a single idempotency
    // helper + audit-emitter pair. payments.discardOnSessionEnd is
    // instantiated but NOT registered on ipcMain — it's an internal
    // handler called by the operator-session-end signal.
    const paymentsAttemptsRepo = bindPaymentAttemptsRepository(dbHandle);
    const paymentsLinesRepo = bindPaymentTenderLinesRepository(dbHandle);
    const paymentsOutboxRepo = bindPaymentActionOutboxRepository(dbHandle);

    const paymentAttemptFsm = createPaymentAttemptFsm({
      db: dbHandle,
      attempts: paymentsAttemptsRepo,
      lines: paymentsLinesRepo,
      outbox: paymentsOutboxRepo,
    });
    const tenderLineFsm = createTenderLineFsm({
      db: dbHandle,
      attempts: paymentsAttemptsRepo,
      lines: paymentsLinesRepo,
      outbox: paymentsOutboxRepo,
    });

    const paymentsIdempotency = createIdempotencyHelper({ outbox: paymentsOutboxRepo });

    // Adapter — payments emitter writes its own `PaymentAuditEvent` shape;
    // we forward to 004's `audit_events` table via the shared
    // `AuditEventsStore.insertIgnore`. F-006: 004's `ActionCategory` union
    // does not yet include the 7 payment categories at the TypeScript
    // level (migration 0017 extends the SQL CHECK only). The cast lives
    // at this single seam and is bounded by the migration's CHECK; a
    // future PR by 004's owner should extend `AUDIT_ACTION_CATEGORIES`.
    const paymentAuditEmitter = createPaymentAuditEmitter({
      sink: {
        write: (evt: PaymentAuditEvent): void => {
          auditEventsStore.insertIgnore({
            event_id: randomUUID(),
            tenant_id: evt.tenant_id,
            branch_id: evt.branch_id,
            originating_terminal_id: evt.originating_terminal_id,
            acting_operator_id: evt.attribution_operator_id,
            session_id: evt.session_id,
            shift_id: null,
            action_category: evt.action_category as unknown as Audit004ActionCategory,
            created_at: evt.created_at,
            approving_supervisor_id: null,
            payload: evt.payload,
          });
        },
      },
    });

    const paymentsSessionAdapter = (): OperatorSessionForPayments | null => {
      const sess = operatorSessionManager.getCurrent();
      if (sess === null) return null;
      // Adapter — payments require terminal_id on the session. 004's
      // session record stores branch context but no separate terminal id;
      // use pairing-store's terminal id, matching cart's posture
      // (cart-bridge.ts uses session.branch_id as terminal scope).
      // F-007: a follow-up PR can plumb the real terminal id through 004.
      return {
        role: sess.role,
        operator_id: sess.operator_id,
        operator_session_id: sess.id,
        tenant_id: sess.tenant_id,
        branch_id: sess.branch_id,
        terminal_id: sess.branch_id,
        // 008 T094b — persist the human-readable name into payment.settled
        // so the session-independent finalize worker can stamp the Sale row.
        display_name: sess.display_name,
      };
    };

    const paymentsClock = (): Date => new Date();
    const paymentsUuid = (): string => randomUUID();

    const paymentsStart = createPaymentsStartHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      paymentAttemptFsm,
      idempotency: paymentsIdempotency,
      auditEmitter: paymentAuditEmitter,
      uuid: paymentsUuid,
      clock: paymentsClock,
    });
    const paymentsConfirm = createPaymentsConfirmHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
      paymentAttemptFsm,
      idempotency: paymentsIdempotency,
      auditEmitter: paymentAuditEmitter,
      clock: paymentsClock,
    });
    const paymentsCancel = createPaymentsCancelHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
      paymentAttemptFsm,
      idempotency: paymentsIdempotency,
      auditEmitter: paymentAuditEmitter,
      clock: paymentsClock,
    });
    const paymentsSubscribe = createPaymentsSubscribeHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
    });
    const paymentsRead = createPaymentsReadHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
    });
    const tenderApply = createTenderApplyHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
      tenderLineFsm,
      idempotency: paymentsIdempotency,
      auditEmitter: paymentAuditEmitter,
      uuid: paymentsUuid,
      clock: paymentsClock,
    });
    const tenderReverse = createTenderReverseHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
      tenderLineFsm,
      idempotency: paymentsIdempotency,
      auditEmitter: paymentAuditEmitter,
      clock: paymentsClock,
    });
    const tenderRead = createTenderReadHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      linesRepo: paymentsLinesRepo,
    });
    const paymentsForceFail = createPaymentsForceFailHandler({
      getCurrentSession: paymentsSessionAdapter,
      attemptsRepo: paymentsAttemptsRepo,
      paymentAttemptFsm,
      idempotency: paymentsIdempotency,
      auditEmitter: paymentAuditEmitter,
      clock: paymentsClock,
    });

    registerPaymentsHandlers(ipcMain, {
      paymentsStart,
      paymentsConfirm,
      paymentsCancel,
      paymentsSubscribe,
      paymentsRead,
      tenderApply,
      tenderReverse,
      tenderRead,
      paymentsForceFail,
    });

    // 006 T271 — deferred-reversal resolver bootstrap.
    //
    // The resolver scans `payment_tender_lines` for `reversal_pending`
    // voucher lines and retries `vouchers.reverse` against V-A. It runs
    // on (a) app start, (b) future 003 network-restore signal, (c)
    // explicit cashier retry (no bridge surface yet).
    //
    // **Production wiring (PR #222 fixup — CR-1).** The V-A reverse
    // client is wired here using the same `apiBaseUrl` + `fetch` seam
    // the operator backend already uses. The resolver supplies the
    // per-line `idempotencyKey` (derived from `tender_line_id`); the
    // closure bakes in baseUrl / fetch / logger.
    //
    // The 003 network-restore signal is still TBD (no network module
    // yet); the resolver runs without it via (a) app-start and (c)
    // the manual-retry entry point.
    const reverseVoucherForResolver = async (
      input: ReverseVoucherInput,
      options: { idempotencyKey: string },
    ): Promise<ReverseVoucherOutcome> => {
      return await reverseVoucher(input, {
        baseUrl: apiBaseUrl,
        fetch: globalThis.fetch.bind(globalThis),
        logger: {
          info: (payload, msg): void => {
            mainLogger.info(payload, msg);
          },
          warn: (payload, msg): void => {
            mainLogger.warn(payload, msg);
          },
          error: (payload, msg): void => {
            mainLogger.error(payload, msg);
          },
        },
        idempotencyKey: options.idempotencyKey,
      });
    };
    const deferredReversalResolver = createDeferredReversalResolver({
      linesRepo: paymentsLinesRepo,
      attemptsRepo: paymentsAttemptsRepo,
      tenderLineFsm,
      auditEmitter: paymentAuditEmitter,
      reverseVoucher: reverseVoucherForResolver,
      logger: {
        info: (payload, msg): void => {
          mainLogger.info(payload, msg);
        },
        warn: (payload, msg): void => {
          mainLogger.warn(payload, msg);
        },
        error: (payload, msg): void => {
          mainLogger.error(payload, msg);
        },
      },
      clock: paymentsClock,
    });
    void deferredReversalResolver.start().catch((err: unknown) => {
      mainLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        'deferred_reversal_resolver:start_failed',
      );
    });

    // ── 008-sale-finalization-and-receipts Slice 1c.3 (T094c) ──────────────
    //
    // Wire the AD-2 finalize worker + read-only `sales.*` bridge behind the
    // `sale_finalization` feature flag (fail-closed default off). When the
    // flag is off, 006 still settles payments but no Sale rows are written —
    // the cashier falls back to manual receipts (see runbook T525).
    //
    // The worker is terminal-scoped: it only fires for the paired terminal.
    // We read the scope from the pairing status; an unpaired terminal cannot
    // reach a POS surface at all (the renderer is walled at /pairing), so a
    // non-paired status here means "nothing to finalize" and we skip start.
    if (getAppConfig().features?.saleFinalization === true) {
      const salesRepo = bindSalesRepository(dbHandle);
      const printEventsRepo = bindPrintEventsRepository(dbHandle);
      const drawerEventsRepo = bindDrawerEventsRepository(dbHandle);

      // Read-only `sales.*` + `receipts.preview` bridges for the renderer.
      // Registered UNCONDITIONALLY whenever the flag is on — NOT gated on
      // pairing status. Pairing happens in-renderer (PairingForm navigates
      // to /paired without a process relaunch), so a terminal that boots
      // unpaired and pairs later in the same process must still have these
      // handlers; otherwise the renderer's reads reject at the IPC layer. Both
      // bridges gate on the live session at call time, so they are inert until
      // an operator signs in regardless of pairing timing.
      const getCurrentSalesSession = () => {
        const sess = operatorSessionManager.getCurrent();
        if (sess === null) return null;
        return {
          role: sess.role,
          operator_id: sess.operator_id,
          operator_session_id: sess.id,
          tenant_id: sess.tenant_id,
          branch_id: sess.branch_id,
          terminal_id: sess.branch_id,
        };
      };
      const salesBridge = createSalesBridge({
        getCurrentSession: getCurrentSalesSession,
        salesRepo,
        printEventsRepo,
        drawerEventsRepo,
      });
      registerSalesHandlers(ipcMain, { salesBridge });

      // 008 Slice 3 — print dispatcher (used by both the auto-fire finalize
      // seam AND the renderer-callable receipts.retryPrint handler). Built
      // here (not inside the paired branch) so the receipts bridge can be
      // registered UNCONDITIONALLY — the T094c lesson: IPC handlers must be
      // present regardless of pairing, since pairing is in-renderer with no
      // relaunch. The dispatcher needs only the DB + repos + audit sink, none
      // of which are pairing-specific; the paired branch reuses it for the
      // finalize-listener wiring.
      const saleAuditEmitter = createSaleAuditEmitter({
        sink: {
          write: (evt: SaleAuditEvent): void => {
            auditEventsStore.insertIgnore({
              event_id: randomUUID(),
              tenant_id: evt.tenant_id,
              branch_id: evt.branch_id,
              originating_terminal_id: evt.originating_terminal_id,
              acting_operator_id: evt.attribution_operator_id,
              session_id: evt.session_id,
              shift_id: null,
              action_category: evt.action_category,
              created_at: evt.created_at,
              approving_supervisor_id: null,
              payload: evt.payload,
            });
          },
        },
      });
      // The real ESC/POS transport (node-thermal-printer ↔ Epson TM-T20III) +
      // the offscreen `webContents.print` window are the §A3 HARDWARE bring-up
      // (T200), deferred. Until then an honest STUB transport reports `offline`,
      // so a print records a clean `printer_offline` failure row + raises the
      // banner while the Sale stays durable — no fake "success" is recorded.
      // T200 swaps these two adapters for the real transports; nothing else
      // changes.
      const printPipeline = createPrintPipeline({
        escposAdapter: createEscposAdapter({
          transport: {
            write: () => Promise.resolve(),
            pollStatus: () => Promise.resolve('offline' as const),
          },
          statusTimeoutMs: 3000,
        }),
        osPrintAdapter: createOsPrintAdapter({
          print: (_html, cb) => {
            cb(false, 'os_print_transport_not_wired_until_T200');
          },
        }),
        probeEscposSupport: () => Promise.resolve(false),
      });
      const printDispatcher = createPrintDispatcher({
        pipeline: printPipeline,
        printEventsRepo,
        auditEmitter: saleAuditEmitter,
        now: () => new Date().toISOString(),
        newPrintEventId: () => randomUUID(),
        logger: mainLogger,
      });

      // 008 Slice 2 + 3 — receipts.preview (read-only render) + retryPrint
      // (mutating; gated server-side). Registered unconditionally (T094c).
      const receiptsBridge = createReceiptsBridge({
        getCurrentSession: getCurrentSalesSession,
        salesRepo,
        printEventsRepo,
        printDispatcher,
      });
      registerReceiptsHandlers(ipcMain, { receiptsBridge });

      // The AD-2 finalize WORKER, by contrast, IS terminal-scoped and only
      // starts for an already-paired terminal — it needs the pairing row's
      // scope to filter the scan. A terminal paired mid-process picks up the
      // worker on the next launch; the startup recovery scan re-fires any
      // settled-but-unfinalized rows then, so nothing is lost.
      const pairingStatus = await pairingStore.getStatus();
      if (pairingStatus.kind === 'paired') {
        const outboxRepo = bindSaleSyncOutboxRepository(dbHandle);
        const allocator = bindSaleNumberAllocator(dbHandle);
        // saleAuditEmitter + printPipeline + printDispatcher are hoisted above
        // the receipts-bridge registration (T094c — unconditional handlers);
        // the paired branch reuses them for the finalize-listener wiring.
        const finalizeTransaction = bindFinalizeTransaction({
          db: dbHandle,
          salesRepo,
          outboxRepo,
          allocator,
          auditEmitter: saleAuditEmitter,
          now: () => new Date().toISOString(),
          saleIdGenerator: () => randomUUID(),
          outboxRowIdGenerator: () => randomUUID(),
        });

        // The AD-2 dispatch closure: project the settled payment into a
        // FinalizeInput (T094b), then run the atomic finalize (T091). A
        // projection refusal is logged and skipped — the worker re-scans
        // the same row on the next tick (idempotent NOT EXISTS clause).
        // After a FRESH finalize commits, fire the first print asynchronously
        // (T273) — NOT part of the atomic transaction; the Sale is already
        // durable. Idempotent replays do NOT re-print (extracted + unit-tested
        // in dispatch-first-print-on-finalize.ts).
        const finalizeDb = dbHandle;
        const dispatch = (handoff_action_id: string): void => {
          const projected = buildFinalizeInput({ db: finalizeDb, handoff_action_id });
          if (projected.kind === 'refused') {
            mainLogger.warn(
              { handoff_action_id, reason: projected.reason },
              'finalize_dispatch:projection_refused',
            );
            return;
          }
          const result = finalizeTransaction.finalize(projected.input);
          mainLogger.info({ handoff_action_id, kind: result.kind }, 'finalize_dispatch:finalized');
          void dispatchFirstPrintOnFinalize(result, { salesRepo, printDispatcher }).catch(
            (err: unknown) => {
              mainLogger.error(
                { handoff_action_id, err },
                'finalize_dispatch:print_seam_unexpected',
              );
            },
          );
        };

        // F-007 alignment — the AD-2 scan filters `audit_events` by
        // `originating_terminal_id`, which 006 writes as the payment
        // attempt's `terminal_id`. That value comes from
        // `paymentsSessionAdapter`, which (per the documented F-007 shortcut)
        // sets `terminal_id: sess.branch_id` because 004's session record
        // carries no separate terminal id. So the value 006 stamps into
        // `originating_terminal_id` is the BRANCH id, not the pairing row's
        // real terminal_id. The scan MUST bind the same value 006 wrote, or
        // it matches zero settled rows and finalizes nothing. We therefore
        // scope the worker with terminal_id = branch_id, tagged to the same
        // F-007 debt: when the real terminal id is plumbed through 004, BOTH
        // the payments adapter and this scope flip together.
        const payments006TerminalId = pairingStatus.branch_id; // F-007
        const finalizeListener = createFinalizeListener({
          db: dbHandle,
          tenant_id: pairingStatus.tenant_id,
          branch_id: pairingStatus.branch_id,
          terminal_id: payments006TerminalId,
          dispatch,
          // Print recovery (T273): a sale that crashed before a successful
          // first print is re-attempted via the SAME print dispatcher. Reuses
          // the finalize→print seam by synthesising a `finalized` result for
          // the recovered sale_id (the seam reads the row + derives the
          // payload). Drawer recovery lands in Slice 4.
          dispatchPrintRecovery: (sale_id: string): void => {
            void dispatchFirstPrintOnFinalize(
              { kind: 'finalized', sale_id, sale_number: '', receipt_number: '', finalized_at: '' },
              { salesRepo, printDispatcher },
            ).catch((err: unknown) => {
              mainLogger.error({ sale_id, err }, 'finalize_recovery:print_recovery_unexpected');
            });
          },
          dispatchDrawerRecovery: (sale_id: string): void => {
            mainLogger.warn({ sale_id }, 'finalize_recovery:drawer_recovery_stub');
          },
          tickIntervalMs: 200,
          now: () => new Date().toISOString(),
        });

        // Recovery scan first (re-fires any settled-but-unfinalized rows from
        // a prior crash), then install the steady-state tick driver.
        finalizeListener.runStartupRecovery();
        finalizeListener.start();
        finalizeListenerStop = () => {
          finalizeListener.stop();
        };
        mainLogger.info({ terminal_id: pairingStatus.terminal_id }, 'finalize_listener:started');
      } else {
        mainLogger.info('finalize_listener:skipped_unpaired');
      }
    }

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
  // 008 (T094c) — stop the AD-2 finalize worker BEFORE closing the DB so a
  // mid-flight tick cannot run against a closed handle.
  if (finalizeListenerStop !== null) {
    try {
      finalizeListenerStop();
    } catch (err) {
      console.error('[pos-pulse] failed to stop finalize listener:', err);
    }
    finalizeListenerStop = null;
  }
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
