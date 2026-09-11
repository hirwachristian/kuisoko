
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initMonitoring, MonitoringErrorBoundary } from './lib/monitoring';

// "Tab security": a brand-new tab/window landing directly on a signed-in area (admin, dashboard,
// cart/checkout) - via a pasted/typed link, a bookmark, or browser history - redirects to Home and
// signs out, instead of continuing straight into it. A tab that has already loaded this app once
// this browsing session is trusted to keep going, even if this particular load wasn't a reload the
// user personally triggered (the OS/browser silently reloading a tab it discarded to save memory
// while it sat idle, or a "reopen previous session" bringing tabs back) - that's still the *same*
// tab continuing, not a different one gaining access.
//
// sessionStorage is what actually distinguishes those cases, not the Navigation Timing API this
// used to check: it's unique per tab (a genuinely new tab, even to the exact same URL, always
// starts empty) but survives every kind of reload in that same tab - including ones the user
// didn't press themselves. Checking `type === 'reload'` instead answered the wrong question -
// browsers routinely reload a backgrounded tab without that ever being a user-pressed refresh, so
// that check was wiping out perfectly legitimate admin sessions that had simply sat open a while.
const TAB_ACTIVE_MARKER = 'kuisoko-tab-active';
const PROTECTED_PATH_PREFIXES = ['/admin', '/dashboard', '/cart', '/rider'];
const isTrustedTab = sessionStorage.getItem(TAB_ACTIVE_MARKER) === '1';
const shouldRedirectHome = !isTrustedTab && PROTECTED_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));

if (shouldRedirectHome) {
  // Landing back on Home while still signed in would only stop the pasted link itself from
  // working - anyone on this tab could still just click their way back into the account through
  // the normal UI. Clearing the session here means arriving fresh at Home genuinely means fresh:
  // signed out, same as a first-time visitor, not just parked one click away from where they were.
  localStorage.removeItem('kuisoko-token');
  // The cached user object (still showing role: 'admin', etc.) has to go too - AppContext reads
  // it back on the very next load regardless of whether a token came with it, so leaving it
  // behind meant the app still *looked* signed in as that user (right down to route guards
  // treating them as an admin) even with no token to actually authenticate any of it.
  localStorage.removeItem('kuisoko-user');
  // A hard redirect, before the app ever mounts - simplest way to guarantee zero flash of the
  // protected page's content, and doesn't need React Router to be ready yet.
  window.location.replace('/');
} else {
  sessionStorage.setItem(TAB_ACTIVE_MARKER, '1');
  initMonitoring();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = createRoot(rootElement);
  root.render(
    <MonitoringErrorBoundary>
      <App />
    </MonitoringErrorBoundary>
  );
}
