

import React from 'react';
import KuISOKOLogoSVG from './KuISOKOLogoSVG';

interface KuISOKOAdminLogoProps {
  className?: string;
}

const KuISOKOAdminLogo: React.FC<KuISOKOAdminLogoProps> = ({ className }) => {
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <KuISOKOLogoSVG className="h-10 w-auto" />
      <p className="text-xs font-semibold text-slate-500">Admin Central</p>
    </div>
  );
};

export default KuISOKOAdminLogo;
