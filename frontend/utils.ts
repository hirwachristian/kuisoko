// Standard clothing-size progression - letter sizes don't sort correctly alphabetically
// ('L' < 'M' < 'S' < 'XL' < 'XS'), so they need an explicit small-to-large ordering instead.
const LETTER_SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];

/** Compares two product variant sizes so they can always be shown smallest-to-largest, whether
 * they're numeric (shoe/measurement sizes like "39", "40.5") or letter sizes (S/M/L/XL). Numeric
 * sizes compare as numbers (never as strings, where "10" would wrongly sort before "9"); letter
 * sizes use the standard XS-5XL progression. An unrecognized size (a one-off label an admin typed
 * that's neither) sorts after every size this function does understand, alphabetically among
 * themselves, rather than landing at a misleading position in the middle. */
export function compareSizes(a: string, b: string): number {
  const aNum = /^\d+(\.\d+)?$/.test(a.trim()) ? parseFloat(a) : null;
  const bNum = /^\d+(\.\d+)?$/.test(b.trim()) ? parseFloat(b) : null;
  if (aNum !== null && bNum !== null) return aNum - bNum;
  if (aNum !== null) return -1;
  if (bNum !== null) return 1;

  const aIdx = LETTER_SIZE_ORDER.indexOf(a.trim().toUpperCase());
  const bIdx = LETTER_SIZE_ORDER.indexOf(b.trim().toUpperCase());
  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
  if (aIdx !== -1) return -1;
  if (bIdx !== -1) return 1;
  return a.localeCompare(b);
}

export type StockLevel = 'out' | 'low' | 'medium' | 'high';

/** Stock color-coding used across product cards and the product detail page:
 * out of stock, <10 units (red, about to run out), 10-15 (orange), >15 (green, well stocked). */
export const getStockLevel = (stock: number): StockLevel => {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  if (stock <= 15) return 'medium';
  return 'high';
};

export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Collapses a long page range down to first, last, current ±1, and 'ellipsis' for the gaps - e.g.
 * 1 … 4 5 6 … 12 instead of listing every page from 1 to 12, which reads as cluttered once there
 * are more than a handful of pages (and wraps awkwardly on mobile). Shared by every paginated
 * list in the app (admin tables, the shop grid) so they all truncate the same way. */
export const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
  const delta = 1;
  const pages: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    }
  }
  const result: (number | 'ellipsis')[] = [];
  let last: number | undefined;
  for (const p of pages) {
    if (last !== undefined) {
      if (p - last === 2) result.push(last + 1);
      else if (p - last > 2) result.push('ellipsis');
    }
    result.push(p);
    last = p;
  }
  return result;
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-RW', {
    timeZone: 'Africa/Kigali',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

let notificationAudioContext: AudioContext | null = null;

/** Plays a short synthesized chime for new admin notifications - no audio file needed. */
export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!notificationAudioContext) notificationAudioContext = new AudioContextClass();
    const ctx = notificationAudioContext;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    // Two quick ascending tones for a friendly "ding-ding" chime.
    [880, 1175].forEach((frequency, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    });
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
};
