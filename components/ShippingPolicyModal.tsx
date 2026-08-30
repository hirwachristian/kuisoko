import React from 'react';
import { X, Truck, Clock, MapPin, DollarSign } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const ShippingPolicyModal: React.FC = () => {
  const { isShippingPolicyOpen, toggleShippingPolicy, t } = useAppContext();

  if (!isShippingPolicyOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={toggleShippingPolicy}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <div className="p-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-8 text-center">{t('shipping_policy_title')}</h1>

          <div className="space-y-6 text-slate-600">
            <section className="flex items-start gap-4">
              <Truck className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('shipping_scope_title')}</h3>
                <p>{t('shipping_scope_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <Clock className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('shipping_times_title')}</h3>
                <p>{t('shipping_times_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <DollarSign className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('shipping_costs_title')}</h3>
                <p>{t('shipping_costs_body')}</p>
              </div>
            </section>

            <section className="flex items-start gap-4">
              <MapPin className="text-emerald-600 mt-1" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">{t('shipping_tracking_title')}</h3>
                <p>{t('shipping_tracking_body')}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShippingPolicyModal;
