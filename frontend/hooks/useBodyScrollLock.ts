import { useLayoutEffect } from 'react';

/**
 * Locks the page from scrolling while `isLocked` is true - used for full-screen mobile overlays
 * (the navbar menu, the shop filters drawer) so a touch scroll inside the overlay can't "leak"
 * into the page behind it.
 *
 * Plain `overflow: hidden` on body is enough on Android Chrome and desktop browsers, but iOS
 * Safari ignores it for touch scrolling - it only actually stops the page from moving once body
 * is taken out of normal flow via `position: fixed`. That requires saving and restoring the
 * scroll position by hand, since a fixed body would otherwise silently jump to the top the moment
 * the lock lifts.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useLayoutEffect(() => {
    if (!isLocked) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
