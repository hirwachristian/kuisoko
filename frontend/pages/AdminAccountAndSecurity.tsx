
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Eye, EyeOff, Monitor, Smartphone, Laptop, LogOut, ToggleLeft, ToggleRight, Info, Pencil, User as UserIcon, Camera, X, Mail } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getInitials } from '../utils';
import { apiFetch, ApiError } from '../api';

const AdminAccountAndSecurity: React.FC = () => {
  const { user, token, updateCurrentUser, showToast, logout, start2FASetup, confirm2FASetup } = useAppContext();

  const [adminNameInput, setAdminNameInput] = useState(user?.name || '');
  const [adminEmailInput, setAdminEmailInput] = useState(user?.email || '');
  const [adminPhoneNumberInput, setAdminPhoneNumberInput] = useState('+250 788 123 456');
  const [adminBioInput, setAdminBioInput] = useState('Tell us a little about yourself...');
  const [adminCountryInput, setAdminCountryInput] = useState('Rwanda');
  const [adminCityInput, setAdminCityInput] = useState('Kigali');
  const [adminProfileImagePreview, setAdminProfileImagePreview] = useState<string | null>(user?.profileImage || null);
  const [adminProfileErrors, setAdminProfileErrors] = useState<{ name?: string; email?: string; phoneNumber?: string; bio?: string; country?: string; city?: string; profileImage?: string }>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  // Security States - real email-based 2FA (see backend /auth/2fa/*), not a local-only toggle.
  // Mandatory for admin accounts and can't be disabled, so there's no 'awaiting-password'
  // (disable) step here - only 'idle' (showing status) and 'awaiting-code' (confirming setup).
  const [twoFAStep, setTwoFAStep] = useState<'idle' | 'awaiting-code'>('idle');
  const [twoFACodeInput, setTwoFACodeInput] = useState('');
  const [is2FABusy, setIs2FABusy] = useState(false);

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

  const handleUpdateAdminProfile = async () => {
    await updateCurrentUser({
      name: adminNameInput.trim(),
      email: adminEmailInput.trim(),
    });
  };

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

  const handleStartEnable2FA = async () => {
    setIs2FABusy(true);
    const ok = await start2FASetup();
    setIs2FABusy(false);
    if (ok) setTwoFAStep('awaiting-code');
  };

  const handleConfirmEnable2FA = async () => {
    setIs2FABusy(true);
    const ok = await confirm2FASetup(twoFACodeInput.trim());
    setIs2FABusy(false);
    if (ok) {
      setTwoFAStep('idle');
      setTwoFACodeInput('');
    }
  };

  const handleCancel2FAStep = () => {
    setTwoFAStep('idle');
    setTwoFACodeInput('');
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-emerald-50 mb-2">Account & Security</h2>
        <p className="text-slate-600 dark:text-emerald-300 text-sm max-w-xl">Manage your public profile, password, 2FA, and device sessions.</p>
      </div>

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

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-emerald-50 mb-2">Two-Factor Authentication</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xl">
          Signing in also requires a 6-digit code sent to <span className="font-semibold">{user?.email}</span> - a stolen password alone won't be enough to get in.
          {' '}Required for admin accounts and can't be turned off.
        </p>

        {twoFAStep === 'idle' && (
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${user?.twoFactorEnabled ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
              <ShieldCheck size={14} /> {user?.twoFactorEnabled ? 'Enabled' : 'Required - takes effect on your next sign-in'}
            </span>
            {!user?.twoFactorEnabled && (
              <button
                onClick={handleStartEnable2FA}
                disabled={is2FABusy}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {is2FABusy ? 'Sending code...' : 'Enable now'}
              </button>
            )}
          </div>
        )}

        {twoFAStep === 'awaiting-code' && (
          <div className="max-w-sm">
            <label className="text-xs font-semibold text-slate-600 dark:text-emerald-300 flex items-center gap-1.5 mb-2">
              <Mail size={13} /> Enter the code we emailed you
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={twoFACodeInput}
              onChange={(e) => setTwoFACodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full text-center tracking-[0.4em] text-lg font-bold px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleCancel2FAStep} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button
                onClick={handleConfirmEnable2FA}
                disabled={is2FABusy || twoFACodeInput.length !== 6}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {is2FABusy ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminAccountAndSecurity;
