
import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, Monitor, Smartphone, Laptop, LogOut, ToggleLeft, ToggleRight, Info, Pencil, User as UserIcon, Camera, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getInitials } from '../utils';
import { apiFetch, ApiError } from '../api';
import ConfirmationModal from '../components/ConfirmationModal';

const AdminAccountAndSecurity: React.FC = () => {
  const { user, token, updateCurrentUser, showToast, logout } = useAppContext();

  // Profile States
  const [adminNameInput, setAdminNameInput] = useState(user?.name || '');
  const [adminEmailInput, setAdminEmailInput] = useState(user?.email || '');
  const [adminPhoneNumberInput, setAdminPhoneNumberInput] = useState('+250 788 123 456');
  const [adminBioInput, setAdminBioInput] = useState('Tell us a little about yourself...');
  const [adminCountryInput, setAdminCountryInput] = useState('Rwanda');
  const [adminCityInput, setAdminCityInput] = useState('Kigali');
  const [adminProfileImagePreview, setAdminProfileImagePreview] = useState<string | null>(user?.profileImage || null);
  const [adminProfileErrors, setAdminProfileErrors] = useState<{ name?: string; email?: string; phoneNumber?: string; bio?: string; country?: string; city?: string; profileImage?: string }>({});

  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  // Security States
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAConfirm, setShow2FAConfirm] = useState(false);
  const [twoFAAction, setTwoFAAction] = useState<'enable' | 'disable' | null>(null);

  const mockSessions = [
    { id: 's1', device: 'Windows Desktop', browser: 'Chrome', location: 'Lagos, Nigeria', ip: '192.168.1.1', current: true },
    { id: 's2', device: 'iPhone 13', app: 'KuISOKO App', location: 'Abuja, Nigeria', age: '2 days ago', current: false },
  ];
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [showLogoutSessionConfirm, setShowLogoutSessionConfirm] = useState(false);
  const [sessionToLogout, setSessionToLogout] = useState<string | null>(null);

  // Initialize/handlers (simplified/merged from previous files)
  useEffect(() => {
    setAdminNameInput(user?.name || '');
    setAdminEmailInput(user?.email || '');
    setAdminProfileImagePreview(user?.profileImage || null);
  }, [user]);

  // --- Handlers ---
  const handleUpdateAdminProfile = async () => {
    // Basic validation and update
    await updateCurrentUser({
      name: adminNameInput.trim(),
      email: adminEmailInput.trim(),
    });
  };

  // --- Avatar Handlers ---
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handleAvatarClick = () => {
    avatarFileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    const previousImage = user?.profileImage;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await apiFetch<{ url: string }>('/uploads', { method: 'POST', body: formData }, token);
      setAdminProfileImagePreview(url);
      await updateCurrentUser({ profileImage: url });
      if (previousImage) {
        apiFetch('/uploads', { method: 'DELETE', body: JSON.stringify({ url: previousImage }) }, token).catch(() => {});
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload photo.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const previousImage = user?.profileImage;
    setAdminProfileImagePreview(null);
    setIsUploadingAvatar(true);
    await updateCurrentUser({ profileImage: null });
    setIsUploadingAvatar(false);
    if (previousImage) {
      apiFetch('/uploads', { method: 'DELETE', body: JSON.stringify({ url: previousImage }) }, token).catch(() => {});
    }
  };

  const handleToggle2FA = (enable: boolean) => {
    setTwoFAAction(enable ? 'enable' : 'disable');
    setShow2FAConfirm(true);
  };

  const confirm2FAToggle = () => {
    if (twoFAAction !== null) {
      setIs2FAEnabled(twoFAAction === 'enable');
      showToast(`Two-Factor Authentication ${twoFAAction === 'enable' ? 'enabled' : 'disabled'}.`, twoFAAction === 'enable' ? 'success' : 'info');
      setShow2FAConfirm(false);
      setTwoFAAction(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Account & Security Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-emerald-50 mb-2">Account & Security</h2>
        <p className="text-slate-600 dark:text-emerald-300 text-sm max-w-xl">Manage your public profile, password, 2FA, and device sessions.</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-6">Profile Details</h3>

        <div className="flex items-center gap-5 mb-8">
          <div className="relative group">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              className="w-20 h-20 rounded-full overflow-hidden bg-emerald-700 dark:bg-emerald-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-white disabled:opacity-60"
              title="Click to upload a profile photo"
            >
              {adminProfileImagePreview ? (
                <img src={adminProfileImagePreview} alt={adminNameInput || 'Profile'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold">{getInitials(adminNameInput || 'Admin')}</span>
              )}
              <span className="absolute inset-0 rounded-full bg-slate-900/0 group-hover:bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <Camera size={22} className="text-white" />
              </span>
            </button>
            {adminProfileImagePreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isUploadingAvatar}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow hover:bg-rose-600 transition-colors disabled:opacity-60"
                title="Remove profile photo"
                aria-label="Remove profile photo"
              >
                <X size={14} />
              </button>
            )}
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-emerald-50">{adminNameInput || 'Admin'}</p>
            <p className="text-sm text-slate-500 dark:text-emerald-300">
              {isUploadingAvatar ? 'Uploading...' : 'Click the avatar to upload or remove your photo'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
           <input type="text" value={adminNameInput} onChange={(e) => setAdminNameInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100" placeholder="Full Name" />
           <input type="email" value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)} className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100" placeholder="Email Address" />
        </div>
        <button onClick={handleUpdateAdminProfile} className="mt-6 px-6 py-3 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95">Update Profile</button>
      </div>

      {/* Security Section (Change Password & 2FA) */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold text-slate-900 dark:text-emerald-50 mb-6">Security Settings</h3>
        {/* Simplified Security UI components here */}
        <button onClick={() => handleToggle2FA(!is2FAEnabled)} className={`px-4 py-2 rounded-lg ${is2FAEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'} text-white`}>
            {is2FAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
        </button>
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={show2FAConfirm}
        onClose={() => { setShow2FAConfirm(false); setTwoFAAction(null); }}
        onConfirm={confirm2FAToggle}
        title={`${twoFAAction === 'enable' ? 'Enable' : 'Disable'} Two-Factor Authentication`}
        message={`Are you sure you want to ${twoFAAction === 'enable' ? 'enable' : 'disable'} 2FA?`}
        confirmButtonText={twoFAAction === 'enable' ? 'Enable 2FA' : 'Disable 2FA'}
      />
    </div>
  );
};

export default AdminAccountAndSecurity;
