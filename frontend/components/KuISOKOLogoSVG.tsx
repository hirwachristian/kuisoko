

import React from 'react';

interface KuISOKOLogoSVGProps {
  className?: string;
}

// The official circular badge artwork (bag+checkmark icon, wordmark, and tagline all baked into
// one image) - replaced the old inline hand-drawn SVG. Every call site sizes this by height with
// an auto width (`h-X w-auto`), which works cleanly since the source art is a 1:1 square.
const KuISOKOLogoSVG: React.FC<KuISOKOLogoSVGProps> = ({ className }) => (
  <img src="/branding/logo.png" alt="KuIsoko" className={className} />
);

export default KuISOKOLogoSVG;
