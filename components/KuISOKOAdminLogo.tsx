

import React from 'react';
import { Store } from 'lucide-react';
import KuISOKOLogoSVG from './KuISOKOLogoSVG'; // Import the main KuISOKOLogoSVG
import { useAppContext } from '../context/AppContext'; // Import AppContext

interface KuISOKOAdminLogoProps {
  className?: string;
}

const KuISOKOAdminLogo: React.FC<KuISOKOAdminLogoProps> = ({ className }) => {

  // isDarkMode no longer needed from useAppContext
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}> {/* Changed to items-center for horizontal centering */}
      <KuISOKOLogoSVG className="h-10 w-auto" /> {/* isDarkMode prop removed */}
      <p className="text-xs font-semibold text-slate-500">Admin Central</p>
    </div>
  );
};

export default KuISOKOAdminLogo;
