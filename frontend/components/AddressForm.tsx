import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useAppContext } from '../context/AppContext';
import { SavedAddress } from '../types';
import { apiFetch } from '../api';

interface AddressFormProps {
  onProceed: () => void;
  setAddressData: (data: any) => void;
}

export interface AddressFormHandle {
  /** Validates and, if valid, saves the address and calls onProceed - lets the "Proceed to
   * Payment" button live in the order summary card (matching how steps 1 and 3 place their
   * primary action there) while validation stays owned by this form. */
  submit: () => void;
}

const AddressForm = forwardRef<AddressFormHandle, AddressFormProps>(({ onProceed, setAddressData }, ref) => {
  const { user, token, t } = useAppContext();

  const [formData, setFormData] = useState({
    fullName: user?.name ?? '',
    phoneNumber: '',
    email: user?.email ?? '',
    country: '',
    cityTown: '',
    district: '',
    streetAddress: '',
    houseBuildingNumber: '',
    additionalInfo: ''
  });

  const [error, setError] = useState('');

  // Pre-fills from the customer's default Address Book entry (if they're signed in and have one)
  // the moment this form mounts - never overwrites a field the shopper has already typed into,
  // since the fetch is async and a fast typist could beat it. Guests (no token) just get the
  // blank form exactly as before; there's nothing to fetch for them.
  const hasAutofilledRef = useRef(false);
  useEffect(() => {
    if (!token || hasAutofilledRef.current) return;
    (async () => {
      try {
        const { addresses } = await apiFetch<{ addresses: SavedAddress[] }>('/addresses', {}, token);
        const defaultAddress = addresses.find((a) => a.isDefault);
        if (!defaultAddress || hasAutofilledRef.current) return;
        hasAutofilledRef.current = true;
        setFormData((prev) => ({
          ...prev,
          phoneNumber: prev.phoneNumber || defaultAddress.phoneNumber,
          country: prev.country || defaultAddress.country,
          cityTown: prev.cityTown || defaultAddress.cityTown,
          district: prev.district || defaultAddress.district,
          streetAddress: prev.streetAddress || defaultAddress.streetAddress,
          houseBuildingNumber: prev.houseBuildingNumber || defaultAddress.houseBuildingNumber || '',
          additionalInfo: prev.additionalInfo || defaultAddress.additionalInfo || '',
        }));
      } catch (e) {
        console.error('Error fetching default address:', e);
      }
    })();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleProceed = () => {
    const { fullName, phoneNumber, email, country, cityTown, district, streetAddress } = formData;
    if (!fullName || !phoneNumber || !email || !country || !cityTown || !district || !streetAddress) {
      setError(t('addr_fill_required'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('addr_invalid_email'));
      return;
    }
    setError('');
    setAddressData(formData);
    onProceed();
  };

  useImperativeHandle(ref, () => ({ submit: handleProceed }));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-8 shadow-sm transition-colors duration-300">
      <h2 className="text-lg sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-4 sm:mb-6">{t('addr_delivery_address')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="col-span-1 md:col-span-2">
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_full_name')}</label>
          <input name="fullName" value={formData.fullName} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_phone_number')}</label>
          <input name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="+250 (XXX) XXX-XXX" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_email_address')}</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="you@example.com" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_country')}</label>
          <input name="country" value={formData.country} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="Rwanda" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_city_town')}</label>
          <input name="cityTown" value={formData.cityTown} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="Kigali" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_district')}</label>
          <input name="district" value={formData.district} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="Gasabo" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_street_address')}</label>
          <input name="streetAddress" value={formData.streetAddress} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="Street Name" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_house_building')}</label>
          <input name="houseBuildingNumber" value={formData.houseBuildingNumber} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="A1" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">{t('addr_additional_info')}</label>
          <input name="additionalInfo" value={formData.additionalInfo} onChange={handleChange} className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100" placeholder="Apartment, suite, etc." />
        </div>
      </div>
      {error && <p className="text-sm text-red-500 font-bold mt-4">{error}</p>}
    </div>
  );
});

export default AddressForm;
