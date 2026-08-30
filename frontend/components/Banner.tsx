import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const Banner: React.FC = () => {
  const { siteAnnouncements } = useAppContext();

  if (siteAnnouncements.length === 0) return null;

  // One pass through every live announcement, separated by a spacer icon.
  const oneCycle = siteAnnouncements.map((announcement) => (
    <span key={announcement.id} className="inline-flex items-center gap-2 mx-8 shrink-0">
      <Sparkles size={14} className="text-white/80 shrink-0" />
      {announcement.message}
    </span>
  ));

  // Repeated enough times that the track is always wider than the viewport, so the
  // right-to-left scroll never shows a gap regardless of how many/short the messages are.
  const repeatedCycle = Array.from({ length: 4 }).flatMap((_, i) =>
    oneCycle.map((el) => React.cloneElement(el, { key: `${i}-${el.key}` }))
  );

  return (
    <div className="bg-orange-500 text-white relative overflow-hidden">
      <div className="flex w-max banner-marquee-track py-2.5">
        <div className="flex items-center whitespace-nowrap text-sm font-bold">{repeatedCycle}</div>
        <div className="flex items-center whitespace-nowrap text-sm font-bold" aria-hidden="true">{repeatedCycle}</div>
      </div>
    </div>
  );
};

export default Banner;
