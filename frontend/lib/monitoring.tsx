import React, { useEffect, useState } from 'react';

// Stays completely inert (and costs 0 bytes of the shipped bundle - @sentry/react itself is only
// ever dynamically imported below) until VITE_SENTRY_DSN is set. Get a free DSN at
// https://sentry.io (free tier easily covers an app this size) and set VITE_SENTRY_DSN in
// Railway's frontend service build variables to start capturing real production errors from
// actual visitors' browsers.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
export const monitoringEnabled = Boolean(dsn);

export function initMonitoring() {
  if (!monitoringEnabled) return;
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
  });
}

const CrashFallback: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-white dark:bg-slate-950">
    <p className="text-lg font-bold text-slate-900 dark:text-emerald-50">Something went wrong.</p>
    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
      We've logged the error and we're looking into it. Try reloading the page.
    </p>
    <button
      onClick={() => window.location.reload()}
      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition"
    >
      Reload
    </button>
  </div>
);

// No-op passthrough when monitoring is off, so this is always safe to wrap the app in - it never
// pulls in @sentry/react's ErrorBoundary (or the SDK at all) for a build with no DSN configured.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorBoundaryComponent = React.ComponentType<any>;

export const MonitoringErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loaded, setLoaded] = useState<{ Boundary: ErrorBoundaryComponent } | null>(null);

  useEffect(() => {
    if (!monitoringEnabled) return;
    import('@sentry/react').then((Sentry) => setLoaded({ Boundary: Sentry.ErrorBoundary }));
  }, []);

  if (!monitoringEnabled || !loaded) return <>{children}</>;
  const { Boundary } = loaded;
  return (
    <Boundary fallback={<CrashFallback />} showDialog={false}>
      {children}
    </Boundary>
  );
};
