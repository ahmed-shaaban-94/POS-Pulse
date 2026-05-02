/**
 * Phase 9 / US7 — runtime config shape exposed to the renderer.
 *
 * The renderer cannot read `process.env` safely under sandbox. The
 * preload bridge calls `app:config` once at startup to learn its
 * runtime configuration, currently just the Sentry DSN.
 *
 * SECURITY: this shape is deliberately narrow. Only values the
 * renderer genuinely needs at runtime cross the bridge — never raw
 * env, never SecretStore values, never tokens fetched from the
 * platform. Each field added here MUST be reviewed for whether the
 * renderer truly needs it (Constitution III).
 */

export interface AppConfig {
  /**
   * Sentry DSN. Optional — when absent, Sentry stays inert in the
   * renderer (no `Sentry.init` call, no network traffic). Sourced
   * from `process.env.SENTRY_DSN` in main; never read in renderer.
   */
  sentryDsn?: string;
}
