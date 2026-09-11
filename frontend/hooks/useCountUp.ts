import { useEffect, useState } from 'react';

/** Counts an integer up from 0 to `target` over `duration` ms on an ease-out curve, starting only
 * once `active` becomes true (typically driven by a scroll-into-view check) - shared by every
 * animated counter in the app (admin overview cards, the About page's stat row) so they all move
 * the same way. */
export function useCountUp(target: number, active: boolean, duration = 1100): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}
