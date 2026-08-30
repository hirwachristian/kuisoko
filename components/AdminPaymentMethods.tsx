import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { z } from 'zod';
import MtnBadge from './MtnBadge';

const phoneSchema = z.string().regex(/^07\d{8}$/, "Phone number must be 10 digits starting with 07");
const codeSchema = z.string().regex(/^\d{6}$/, "Merchant code must be 6 digits");

const AdminPaymentMethods: React.FC = () => {
  const { paymentMethods, updatePaymentMethods } = useAppContext();
  const [selectedType, setSelectedType] = useState('MTN');
  const [methodDetail, setMethodDetail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddPayment = () => {
    setError(null);
    const schema = selectedType === 'Momo Pay' ? codeSchema : phoneSchema;
    const result = schema.safeParse(methodDetail);

    if (!result.success) {
      const issues = result.error.issues;
      setError(issues && issues.length > 0 ? issues[0].message : 'Invalid input');
      return;
    }

    const methods = Array.isArray(paymentMethods) ? paymentMethods : [];
    updatePaymentMethods([...methods, { name: selectedType, enabled: true, detail: methodDetail }]);
    setMethodDetail('');
  };

  const handleDeletePayment = (methodName: string, methodDetail: string) => {
    updatePaymentMethods(paymentMethods.filter(method => !(method.name === methodName && method.detail === methodDetail)));
  };

  const handleTogglePayment = (methodName: string, methodDetail: string) => {
    updatePaymentMethods(paymentMethods.map(method => 
        (method.name === methodName && method.detail === methodDetail) ? { ...method, enabled: !method.enabled } : method
    ));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
      <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-6">Payment Settings</h3>
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setError(null); }} className="px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-slate-900 dark:text-emerald-100">
             <option value="MTN">MTN</option>
             <option value="Airtel">Airtel</option>
             <option value="Momo Pay">Momo Pay</option>
          </select>
          <div className="flex-1">
            <input 
              value={methodDetail}
              onChange={(e) => { setMethodDetail(e.target.value); setError(null); }}
              className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-slate-900 dark:text-emerald-100"
              placeholder={selectedType === 'Momo Pay' ? 'Enter Code' : 'Enter Number'}
            />
            {error && <p className="text-rose-600 dark:text-rose-400 text-sm mt-1">{error}</p>}
          </div>
          <button onClick={handleAddPayment} className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-emerald-700 text-white font-bold">Add</button>
        </div>
        <div className="space-y-2">
          {paymentMethods?.map(method => (
            <div key={method.name + method.detail} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-emerald-100 transition-colors duration-300">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={method.enabled} onChange={() => handleTogglePayment(method.name, method.detail)} />
                {/mtn/i.test(method.name) && <MtnBadge />}
                {method.name} ({method.detail})
              </div>
              <button onClick={() => handleDeletePayment(method.name, method.detail)} className="text-rose-600 dark:text-rose-400 font-bold px-2">Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPaymentMethods;
