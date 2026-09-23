import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SavedAddress } from '../types';
import { useAppContext } from '../context/AppContext';

interface AddressFormModalProps {
  /** Present when editing an existing entry - pre-fills every field; absent for a fresh Add. */
  initialValues: SavedAddress | null;
  onSubmit: (data: Omit<SavedAddress, 'id' | 'lat' | 'lng'>) => void;
  onClose: () => void;
  isSaving: boolean;
}

const EMPTY_FORM = {
  label: '', fullName: '', phoneNumber: '', country: '', cityTown: '', district: '',
  streetAddress: '', houseBuildingNumber: '', additionalInfo: '', isDefault: false,
};

// A real Add/Edit modal for one address-book entry - same field shape as the checkout delivery
// address (AddressForm.tsx), plus a label and a "set as default" toggle. Kept as its own component
// rather than reusing AddressForm.tsx, which is a checkout-specific imperative-ref form with no
// pre-fill support and no label/default concept - refactoring it to serve both would risk the
// (already working, real-money-adjacent) checkout flow for no benefit here.
const AddressFormModal: React.FC<AddressFormModalProps> = ({ initialValues, onSubmit, onClose, isSaving }) => {
  const { t } = useAppContext();
  const [formData, setFormData] = useState(initialValues ? { ...initialValues } : EMPTY_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(initialValues ? { ...initialValues } : EMPTY_FORM);
  }, [initialValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (error) setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { label, fullName, phoneNumber, country, cityTown, district, streetAddress } = formData;
    if (!label.trim() || !fullName.trim() || !phoneNumber.trim() || !country.trim() || !cityTown.trim() || !district.trim() || !streetAddress.trim()) {
      setError(t('addr_fill_required'));
      return;
    }
    onSubmit({
      label: label.trim(),
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      country: country.trim(),
      cityTown: cityTown.trim(),
      district: district.trim(),
      streetAddress: streetAddress.trim(),
      houseBuildingNumber: formData.houseBuildingNumber?.trim() || undefined,
      additionalInfo: formData.additionalInfo?.trim() || undefined,
      isDefault: formData.isDefault,
    });
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-emerald-100';
  const labelClass = 'block text-xs font-bold text-slate-700 dark:text-emerald-300 mb-1.5';

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-emerald-50">
            {initialValues ? t('dashboard_edit_address') : t('dashboard_add_new_address')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-emerald-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('dashboard_address_label')}</label>
              <input name="label" value={formData.label} onChange={handleChange} className={inputClass} placeholder={t('dashboard_address_label_placeholder')} />
            </div>
            <div>
              <label className={labelClass}>{t('addr_full_name')}</label>
              <input name="fullName" value={formData.fullName} onChange={handleChange} className={inputClass} placeholder="Jane Doe" />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('addr_street_address')}</label>
            <input name="streetAddress" value={formData.streetAddress} onChange={handleChange} className={inputClass} placeholder="Street Name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('addr_city_town')}</label>
              <input name="cityTown" value={formData.cityTown} onChange={handleChange} className={inputClass} placeholder="Kigali" />
            </div>
            <div>
              <label className={labelClass}>{t('addr_district')}</label>
              <input name="district" value={formData.district} onChange={handleChange} className={inputClass} placeholder="Gasabo" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('addr_country')}</label>
              <input name="country" value={formData.country} onChange={handleChange} className={inputClass} placeholder="Rwanda" />
            </div>
            <div>
              <label className={labelClass}>{t('addr_phone_number')}</label>
              <input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className={inputClass} placeholder="+250 788 000 000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('addr_house_building')}</label>
              <input name="houseBuildingNumber" value={formData.houseBuildingNumber ?? ''} onChange={handleChange} className={inputClass} placeholder="A1" />
            </div>
            <div>
              <label className={labelClass}>{t('addr_additional_info')}</label>
              <input name="additionalInfo" value={formData.additionalInfo ?? ''} onChange={handleChange} className={inputClass} placeholder={t('addr_additional_info')} />
            </div>
          </div>
          <label className="flex items-center gap-2.5 pt-1">
            <input type="checkbox" name="isDefault" checked={formData.isDefault} onChange={handleChange} className="w-4 h-4 rounded accent-emerald-600" />
            <span className="text-sm font-semibold text-slate-700 dark:text-emerald-200">{t('dashboard_set_as_default_checkbox')}</span>
          </label>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400 font-semibold">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-5 py-2.5 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95 disabled:opacity-60"
            >
              {isSaving ? t('dashboard_saving') : t('dashboard_save_address')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('dashboard_cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddressFormModal;
