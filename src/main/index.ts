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
import { createPaymentsSubscribeHandler } from './payments/handlers/payments-subscribe.js';
import { createPaymentsReadHandler } from './payments/handlers/payments-read.js';
import { createTenderApplyHandler } from './payments/handlers/tender-apply.js';
import { createTenderReverseHandler } from './payments/handlers/tender-reverse.js';
import { createTenderReadHandler } from './payments/handlers/tender-read.js';
import { createDeferredReversalResolver } from './payments/deferred-reversal-resolver.js';
import type {
  ReverseVoucherInput,
  ReverseVoucherOutcome,
} from './payments/voucher-authority/reverse.js';
import type { ActionCategory as Audit004ActionCategory } from '../shared/audit/event-shape.js';
import type { OperatorSessionForPayments } from './payments/require-operator-session.js';
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
      cfg.features = { cart: cartEnabled };
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

    registerPaymentsHandlers(ipcMain, {
      paymentsStart,
      paymentsConfirm,
      paymentsCancel,
      paymentsSubscribe,
      paymentsRead,
      tenderApply,
      tenderReverse,
      tenderRead,
    });

    // 006 T271 — deferred-reversal resolver bootstrap.
    //
    // The resolver scans `payment_tender_lines` for `reversal_pending`
    // voucher lines and retries `vouchers.reverse` against V-A. It runs
    // on (a) app start, (b) future 003 network-restore signal, (c)
    // explicit cashier retry (no bridge surface yet).
    //
    // **Production wiring posture.** The V-A reverse client itself
    // (`src/main/payments/voucher-authority/reverse.ts`) is not yet
    // wired into production bootstrap (voucher surface ships in a
    // future Wave; today the V-A clients exist as modules but no
    // production caller injects them). Until that wiring lands, the
    // resolver uses a defensive stub that returns
    // `authority_unreachable` for every call — every pending line
    // simply stays pending until the real client arrives, which is
    // the correct behaviour (no state corruption, full audit trail
    // preserved). When the real client is wired (next Wave), this
    // stub is replaced with the production V-A reverse client and the
    // resolver immediately starts resolving on the next sweep.
    //
    // The 003 network-restore signal is also TBD (no network module
    // yet). The resolver runs without it via (a) app-start and (c)
    // the manual-retry entry point.
    const reverseVoucherStub = async (
      input: ReverseVoucherInput,
    ): Promise<ReverseVoucherOutcome> => {
      void input;
      mainLogger.info(
        { resolver: 'deferred_reversal_resolver' },
        'voucher_reverse_stub:authority_unreachable',
      );
      return await Promise.resolve({ kind: 'authority_unreachable' });
    };
    const deferredReversalResolver = createDeferredReversalResolver({
      linesRepo: paymentsLinesRepo,
      attemptsRepo: paymentsAttemptsRepo,
      tenderLineFsm,
      auditEmitter: paymentAuditEmitter,
      reverseVoucher: reverseVoucherStub,
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
