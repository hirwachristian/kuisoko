import { useEffect, useRef } from 'react';

/**
 * Calls `callback` repeatedly every `intervalMs` for as long as the tab is visible - paused
 * entirely while it isn't (a background tab has no reason to keep polling), and catches up with
 * one immediate call the moment it's switched back to, rather than waiting out the rest of the
 * interval. Does not call `callback` on mount - the caller is expected to already do its own
 * initial fetch; this only adds the repeat.
 */
export function usePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let intervalId: number | undefined;

    const startPolling = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(() => callbackRef.current(), intervalMs);
    };
    const stopPolling = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs]);
}
