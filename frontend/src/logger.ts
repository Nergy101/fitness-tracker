/**
 * Minimal structured logging abstraction. Components should never call
 * `console.error` directly — route through this so a real error tracker
 * (Sentry, etc.) can be wired in later by changing one module.
 *
 * `error` is a no-op in production builds (DEV-only console output) since
 * browser console noise is not useful to users; the message shape stays
 * consistent for future ingestion.
 */

interface Logger {
  error: (context: string, err: unknown) => void;
  warn: (context: string, msg: string) => void;
  info: (context: string, msg: string) => void;
}

export const logger: Logger = {
  error: (context, err) => {
    if (import.meta.env.DEV) {
      console.error(`[${context}]`, err);
    }
    // Future: send to error tracking service
  },
  warn: (context, msg) => {
    if (import.meta.env.DEV) {
      console.warn(`[${context}]`, msg);
    }
  },
  info: (context, msg) => {
    if (import.meta.env.DEV) {
      console.info(`[${context}]`, msg);
    }
  },
};
