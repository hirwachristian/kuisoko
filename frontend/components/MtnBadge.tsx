import React from 'react';

// MTN's official logo asset isn't bundled here, so this is a lightweight brand-colored
// stand-in (their yellow, bold wordmark) shown next to MTN-named payment methods.
const MtnBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    className={`inline-flex items-center justify-center bg-[#FFCC00] text-black font-black text-[10px] tracking-tight rounded-md px-2 py-1 leading-none shadow-sm ${className}`}
  >
    MTN
  </span>
);

export default MtnBadge;
