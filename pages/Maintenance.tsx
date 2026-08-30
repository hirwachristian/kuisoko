
import React from 'react';
import { Settings } from 'lucide-react';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';

const Maintenance: React.FC = () => {
  // Removed translation usage
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-950 text-emerald-100 py-12 px-4 sm:px-6 lg:px-8 text-center">
      <KuISOKOLogoSVG className="h-20 w-auto mb-8" />
      <div className="w-24 h-24 bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-100 animate-pulse">
        <Settings size={48} className="rotate-45" />
      </div>
      <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">Under Maintenance</h1>
      <p className="text-lg md:text-xl text-emerald-100/70 max-w-xl mx-auto leading-relaxed">
        We're currently performing essential updates to improve your shopping experience.<br />We'll be back online shortly. Thank you for your patience!
      </p>
      <p className="mt-8 text-sm text-emerald-100/50">
        For urgent inquiries, please contact us at <a href="mailto:support@kuisoko.com" className="underline hover:text-emerald-100/80">support@kuisoko.com</a>.
      </p>
    </div>
  );
};

export default Maintenance;
