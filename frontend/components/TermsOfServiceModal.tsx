import React from 'react';
import { X, FileText, ShieldCheck, UserCheck, AlertTriangle, RotateCcw, Scale } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const TermsOfServiceModal: React.FC = () => {
  const { isTermsOfServiceOpen, toggleTermsOfService, t } = useAppContext();

  if (!isTermsOfServiceOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={toggleTermsOfService}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <div className="p-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-8 text-center">{t('terms_title')}</h1>

          <div className="space-y-6 text-slate-600">
            <section className="flex items-start gap-4">
              <UserCheck className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('terms_obligations_title')}</h3>
                <p>{t('terms_obligations_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <ShieldCheck className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('terms_privacy_title')}</h3>
                <p>{t('terms_privacy_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <RotateCcw className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('terms_returns_title')}</h3>
                <p>{t('terms_returns_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <AlertTriangle className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('terms_liability_title')}</h3>
                <p>{t('terms_liability_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <Scale className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('terms_governing_law_title')}</h3>
                <p>{t('terms_governing_law_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <FileText className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('terms_modifications_title')}</h3>
                <p>{t('terms_modifications_body')}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
