import * as Sentry from '@sentry/node';

// Stays completely inert until SENTRY_DSN is set - no account, no behavior change, no cost.
// Get a free DSN at https://sentry.io (free tier easily covers an app this size) and set
// SENTRY_DSN in Railway's backend service variables to start capturing real production errors.
export const monitoringEnabled = Boolean(process.env.SENTRY_DSN);

export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  });
}

export function captureError(err: unknown) {
  if (!monitoringEnabled) return;
  Sentry.captureException(err);
}
