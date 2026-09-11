import { useLayoutEffect } from 'react';

/**
 * Locks the page from scrolling while `isLocked` is true - used for full-screen mobile overlays
 * (the navbar menu, the shop filters drawer) so a touch scroll inside the overlay can't "leak"
 * into the page behind it.
 *
 * `position: fixed` alone is enough - taking body out of normal flow this way removes it from
 * what the document has to scroll in the first place, on iOS Safari and everywhere else. That
 * requires saving and restoring the scroll position by hand, since a fixed body would otherwise
 * silently jump to the top the moment the lock lifts.
 *
 * Deliberately does NOT also set `overflow: hidden` on body - an element's own `overflow` other
 * than `visible` makes it the nearest scrolling ancestor for any `position: sticky` descendant
 * (the navbar), so while locked that would hijack the navbar's stuck-to-viewport positioning in
 * favor of body's own (now frozen) box instead - it can end up rendered off in body's shifted
 * coordinate space the next time the lock re-engages after the page has scrolled.
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
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}
