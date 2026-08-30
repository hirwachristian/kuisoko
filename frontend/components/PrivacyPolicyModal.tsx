import React from 'react';
import { X, Shield, Lock, Eye, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const PrivacyPolicyModal: React.FC = () => {
  const { isPrivacyPolicyOpen, togglePrivacyPolicy, t } = useAppContext();

  if (!isPrivacyPolicyOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={togglePrivacyPolicy}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <div className="p-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-8 text-center">{t('privacy_title')}</h1>

          <div className="space-y-6 text-slate-600">
            <section className="flex items-start gap-4">
              <Eye className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('privacy_collection_title')}</h3>
                <p>{t('privacy_collection_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <Lock className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('privacy_security_title')}</h3>
                <p>{t('privacy_security_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <Shield className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('privacy_usage_title')}</h3>
                <p>{t('privacy_usage_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <FileText className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('privacy_updates_title')}</h3>
                <p>{t('privacy_updates_body')}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyModal;
