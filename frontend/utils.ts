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
