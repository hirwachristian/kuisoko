
import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Eye, Megaphone, Plus, Pencil, Trash2, X, MapPin, Copyright, Settings, Truck, Phone } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { FooterLink, ShippingZone } from '../types';
import { apiFetch, ApiError } from '../api';
import ConfirmationModal from '../components/ConfirmationModal';
import WhatsAppIcon from '../components/WhatsAppIcon';

// LinkForm component for footer links management
const LinkForm: React.FC<{
  initialLink?: FooterLink;
  onSave: (link: FooterLink) => void;
  onCancel: () => void;
  title: string;
  submitLabel: string;
}> = ({ initialLink, onSave, onCancel, title, submitLabel }) => {
  const [label, setLabel] = useState(initialLink?.label || '');
  const [to, setTo] = useState(initialLink?.to || '');
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[2.5rem] p-5 sm:p-8 w-full max-w-md shadow-xl">
        <h3 className="text-2xl font-black text-slate-900 mb-6">{title}</h3>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-200 mb-4" placeholder="Link Label" />
        <input type="text" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-200 mb-4" placeholder="URL Path" />
        <button onClick={() => onSave({ label, to })} className="w-full px-6 py-3 rounded-xl font-bold bg-orange-500 text-white">{submitLabel}</button>
      </div>
    </div>
  );
};

const AdminStoreConfiguration: React.FC = () => {
  const { showToast, token, footerSettings, updateFooterLocation, updateFooterPhoneNumber, updateFooterWhatsappNumber, updateFooterEmail, updateFooterQuickLinks, updateFooterSupportLinks, updateFooterCopyrightText, isMaintenanceMode, toggleMaintenanceMode } = useAppContext();

  // Shop Preferences States
  const [makeWishlistPublic, setMakeWishlistPublic] = useState(false);
  const [showBrowsingHistory, setShowBrowsingHistory] = useState(true);

  // General Settings States
  const [locationInput, setLocationInput] = useState(footerSettings.locationLines.join('\n'));
  const [phoneNumberInput, setPhoneNumberInput] = useState(footerSettings.phoneNumber);
  const [whatsappNumberInput, setWhatsappNumberInput] = useState(footerSettings.whatsappNumber);
  const [emailInput, setEmailInput] = useState(footerSettings.emailAddress);
  const [copyrightInput, setCopyrightInput] = useState(footerSettings.copyrightText);
  const [quickLinksInput, setQuickLinksInput] = useState<FooterLink[]>(footerSettings.quickLinks);

  const handleSaveAll = () => {
    updateFooterLocation(locationInput.split('\n'));
    updateFooterPhoneNumber(phoneNumberInput);
    updateFooterWhatsappNumber(whatsappNumberInput);
    updateFooterEmail(emailInput);
    updateFooterCopyrightText(copyrightInput);
    updateFooterQuickLinks(quickLinksInput);
    showToast('Store configuration saved!', 'success');
  };

  // --- Shipping Zones ---
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDistricts, setNewZoneDistricts] = useState('');
  const [newZoneFee, setNewZoneFee] = useState('');

  const fetchShipping = useCallback(async () => {
    try {
      const [zonesResp, settingsResp] = await Promise.all([
        apiFetch<{ zones: ShippingZone[] }>('/shipping/zones'),
        apiFetch<{ freeShippingThreshold: number }>('/shipping/settings'),
      ]);
      setZones(zonesResp.zones);
      setFreeShippingThreshold(String(settingsResp.freeShippingThreshold));
    } catch (e) {
      console.error('Error fetching shipping settings:', e);
    }
  }, []);

  useEffect(() => { fetchShipping(); }, [fetchShipping]);

  const handleAddZone = async () => {
    if (!newZoneName.trim()) {
      showToast('Zone name is required.', 'error');
      return;
    }
    const fee = parseFloat(newZoneFee);
    if (isNaN(fee) || fee < 0) {
      showToast('Valid fee is required.', 'error');
      return;
    }
    const districts = newZoneDistricts.split(',').map((d) => d.trim()).filter(Boolean);
    try {
      await apiFetch('/shipping/zones', {
        method: 'POST',
        body: JSON.stringify({ name: newZoneName.trim(), districts, fee }),
      }, token);
      showToast(`Zone "${newZoneName.trim()}" added.`, 'success');
      setNewZoneName('');
      setNewZoneDistricts('');
      setNewZoneFee('');
      fetchShipping();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not add zone.', 'error');
    }
  };

  const handleUpdateZoneFee = async (zone: ShippingZone, fee: number) => {
    try {
      await apiFetch(`/shipping/zones/${zone.id}`, { method: 'PATCH', body: JSON.stringify({ fee }) }, token);
      setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, fee } : z)));
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update fee.', 'error');
      fetchShipping();
    }
  };

  const handleSetDefaultZone = async (zone: ShippingZone) => {
    try {
      await apiFetch(`/shipping/zones/${zone.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }, token);
      showToast(`"${zone.name}" is now the default zone.`, 'success');
      fetchShipping();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not set default zone.', 'error');
    }
  };

  const handleDeleteZone = async (zone: ShippingZone) => {
    try {
      await apiFetch(`/shipping/zones/${zone.id}`, { method: 'DELETE' }, token);
      showToast(`Zone "${zone.name}" deleted.`, 'success');
      setZones((prev) => prev.filter((z) => z.id !== zone.id));
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete zone.', 'error');
    }
  };

  const handleSaveThreshold = async () => {
    const value = parseFloat(freeShippingThreshold);
    if (isNaN(value) || value < 0) {
      showToast('Valid threshold is required.', 'error');
      return;
    }
    try {
      await apiFetch('/shipping/settings', { method: 'PATCH', body: JSON.stringify({ freeShippingThreshold: value }) }, token);
      showToast('Free shipping threshold updated.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update threshold.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-emerald-50 mb-2">Store Configuration</h2>
        <p className="text-slate-600 dark:text-emerald-300 text-sm max-w-xl">Manage localization, branding, and store-wide preferences.</p>
      </div>

      {/* Localization */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-6">Localization</h3>
        <div className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-emerald-100 font-semibold">
          RWF - Rwandan Franc
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">KuISOKO currently operates in Rwandan Francs only.</p>
      </div>

      {/* Shipping Zones */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-2 flex items-center gap-2"><Truck size={20} /> Shipping Zones</h3>
        <p className="text-sm text-slate-500 dark:text-emerald-300 mb-6">Set a flat shipping fee per set of districts. Orders from a district not listed in any zone use the default zone's fee.</p>

        <div className="space-y-3 mb-6">
          {zones.map((zone) => (
            <div key={zone.id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-[160px]">
                <p className="font-bold text-slate-900 dark:text-emerald-50 flex items-center gap-2">
                  {zone.name}
                  {zone.isDefault && <span className="text-[10px] uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">Default</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{zone.districts.length > 0 ? zone.districts.join(', ') : 'Fallback for any unlisted district'}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500 dark:text-slate-400">Rwf</span>
                <input
                  type="number"
                  defaultValue={zone.fee}
                  onBlur={(e) => {
                    const fee = parseFloat(e.target.value);
                    if (!isNaN(fee) && fee >= 0 && fee !== zone.fee) handleUpdateZoneFee(zone, fee);
                  }}
                  className="w-24 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-emerald-100"
                />
              </div>
              {!zone.isDefault && (
                <button onClick={() => handleSetDefaultZone(zone)} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap">
                  Make Default
                </button>
              )}
              <button onClick={() => handleDeleteZone(zone)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 block mb-1">Zone Name</label>
            <input type="text" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} placeholder="e.g. Northern Province" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-emerald-100" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 block mb-1">Districts (comma separated)</label>
            <input type="text" value={newZoneDistricts} onChange={(e) => setNewZoneDistricts(e.target.value)} placeholder="e.g. Musanze, Gicumbi" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-emerald-100" />
          </div>
          <div className="w-28">
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 block mb-1">Fee (RWF)</label>
            <input type="number" value={newZoneFee} onChange={(e) => setNewZoneFee(e.target.value)} placeholder="0" className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-emerald-100" />
          </div>
          <button onClick={handleAddZone} className="flex items-center gap-1 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-800">
            <Plus size={16} /> Add Zone
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 block mb-1">Free Shipping Threshold (RWF)</label>
            <input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} placeholder="0 = disabled" className="w-48 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-emerald-100" />
          </div>
          <button onClick={handleSaveThreshold} className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-700 text-white text-sm font-bold">Save Threshold</button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Orders with a subtotal at or above this amount get free shipping, regardless of zone.</p>
        </div>
      </div>

      {/* Storefront Customization */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-6">Contact & Storefront</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 flex items-center gap-1.5 mb-1.5"><Phone size={13} /> Call Number</label>
            <input type="text" value={phoneNumberInput} onChange={(e) => setPhoneNumberInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600" placeholder="Phone Number" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 flex items-center gap-1.5 mb-1.5"><WhatsAppIcon size={13} className="text-green-600 dark:text-green-400" /> WhatsApp Number</label>
            <input type="text" value={whatsappNumberInput} onChange={(e) => setWhatsappNumberInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600" placeholder="WhatsApp Number" />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-4">Use two different numbers if your call line and WhatsApp line aren't the same.</p>
        <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-4 text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600" placeholder="Email Address" />
        <textarea rows={3} value={locationInput} onChange={(e) => setLocationInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-4 text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600" placeholder="Location" />
        <input type="text" value={copyrightInput} onChange={(e) => setCopyrightInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-4 text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600" placeholder="Copyright" />
      </div>

      <button onClick={handleSaveAll} className="px-6 py-3 rounded-xl font-bold bg-orange-500 text-white shadow-lg">Save Configuration</button>
    </div>
  );
};

export default AdminStoreConfiguration;
