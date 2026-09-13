

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, User, Heart, LogOut, Clock, MapPin, Plus, Pencil, Sun, Moon, CheckCircle2, Truck, PackageCheck, X, Menu, KeyRound, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import RiderLocationMap from '../components/RiderLocationMap';
import { Order } from '../types';
import { getInitials } from '../utils';
import { apiFetch, ApiError } from '../api';

const TRACKING_ICONS: Record<string, React.ElementType> = {
  'Pending': Clock,
  'Processing': Package,
  'Shipped': Truck,
  'Delivered': PackageCheck,
  'Cancelled': X,
  'Returned': RefreshCw,
};

// A distinct color per status, tuned for at-a-glance scanning in a customer's own order list
// (unlike the admin's ORDER_STATUS_COLORS, which flattens Processing/Shipped/Delivered to the
// same emerald since admins mainly care about Pending/Cancelled there).
const CUSTOMER_STATUS_STYLES: Record<Order['status'], string> = {
  'Pending': 'bg-amber-100 text-amber-700',
  'Processing': 'bg-orange-100 text-orange-700',
  'Shipped': 'bg-orange-100 text-orange-700',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-rose-100 text-rose-700',
  'Returned': 'bg-purple-100 text-purple-700',
};

const UserDashboard: React.FC = () => {
  const { user, products, getFormattedPrice, logout, orders: userOrders, wishlist, theme, toggleTheme, updateCurrentUser, token, showToast, addToCart, requestReturn, acknowledgeReturnResult, t } = useAppContext();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    initialTab && ['orders', 'wishlist', 'profile', 'address'].includes(initialTab) ? initialTab : 'orders'
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  // Once the customer opens an order carrying an unseen return resolution (approved/rejected),
  // clear that flag server-side - the banner itself is the notification, this just stops it from
  // being flagged as new the next time they look.
  useEffect(() => {
    setShowReturnForm(false);
    setReturnReason('');
    if (selectedOrder?.returnRequest?.customerUnread) {
      acknowledgeReturnResult(selectedOrder.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder?.id]);

  const handleSubmitReturn = async () => {
    if (!selectedOrder || !returnReason.trim() || isSubmittingReturn) return;
    setIsSubmittingReturn(true);
    const ok = await requestReturn(selectedOrder.id, returnReason.trim());
    setIsSubmittingReturn(false);
    if (ok) {
      setShowReturnForm(false);
      setReturnReason('');
    }
  };

  // <main> is its own scroll container (overflow-y-auto below), not the window - so switching
  // tabs (or opening/closing an order's details) while scrolled down left the new view starting
  // mid-scroll instead of at the top, since nothing was resetting this container's scroll position.
  // useLayoutEffect (not useEffect) so this runs before the browser paints the new content - with
  // a plain effect there's a brief window where the old scroll position is still visible against
  // the new content before it snaps to the top, which reads as the page being "stuck".
  useLayoutEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [activeTab, selectedOrder]);

  const wishlistProducts = products.filter(p => wishlist.includes(p.id));

  // --- Profile Settings ---
  const [fullName, setFullName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    setFullName(user?.name || '');
    setUsername(user?.username || '');
    setPhoneNumber(user?.phoneNumber || '');
  }, [user?.name, user?.username, user?.phoneNumber]);

  // Ports SignUp.tsx's live debounced availability check, with one addition: re-submitting the
  // account's own current username unchanged must never be flagged "taken" - GET
  // /auth/check-username is public/context-free (it has no idea who's asking or what their
  // current username already is), so that guard has to live here on the client.
  type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3 || trimmed === (user?.username || '').toLowerCase()) {
      setUsernameStatus('idle');
      setUsernameSuggestions([]);
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameSuggestions([]);
      return;
    }
    setUsernameStatus('checking');
    const handle = window.setTimeout(async () => {
      try {
        const result = await apiFetch<{ available: boolean; suggestions?: string[] }>(
          `/auth/check-username?username=${encodeURIComponent(trimmed)}`
        );
        setUsernameStatus(result.available ? 'available' : 'taken');
        setUsernameSuggestions(result.suggestions ?? []);
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [username, user?.username]);

  const handleUpdateProfile = async () => {
    if (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking') return;
    setIsSavingProfile(true);
    await updateCurrentUser({ name: fullName.trim(), username: username.trim() || undefined, phoneNumber: phoneNumber.trim() });
    setIsSavingProfile(false);
  };

  // --- Change Email (requires verifying the new address before it takes effect) ---
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false);
  const [pendingEmailChange, setPendingEmailChange] = useState<string | null>(null);

  const handleRequestEmailChange = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    setIsRequestingEmailChange(true);
    try {
      await apiFetch('/users/me/email-change', {
        method: 'POST',
        body: JSON.stringify({ newEmail: trimmed }),
      }, token);
      setPendingEmailChange(trimmed);
      setIsChangingEmail(false);
      setNewEmail('');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth_something_wrong_retry'), 'error');
    } finally {
      setIsRequestingEmailChange(false);
    }
  };

  // --- Change Password (PATCH /users/me only checks currentPassword against the stored hash
  // when a new `password` is present in the body, so this reuses that same endpoint rather than
  // needing a dedicated route) ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword) {
      setPasswordError(t('dashboard_password_missing_fields'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('auth_password_min_length'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('dashboard_password_mismatch'));
      return;
    }
    setIsSavingPassword(true);
    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, password: newPassword }),
      }, token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast(t('dashboard_password_changed'), 'success');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : t('dashboard_change_password_error'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  // --- Address Book ---
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState(user?.address || '');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  useEffect(() => {
    setAddressDraft(user?.address || '');
  }, [user?.address]);

  const handleSaveAddress = async () => {
    setIsSavingAddress(true);
    await updateCurrentUser({ address: addressDraft.trim() });
    setIsSavingAddress(false);
    setIsEditingAddress(false);
  };

  // Re-adds a past order's items to the cart using each product's *current* data (price, stock,
  // images) rather than the order's own snapshot - a "buy again" should reflect what the item
  // actually costs and looks like today, not what it cost when this order was placed. Items whose
  // product was deleted since, or whose exact color/size no longer exists, are skipped with a
  // toast rather than silently failing or adding something the shopper didn't ask for.
  const handleReorder = (order: Order) => {
    let addedCount = 0;
    let skippedCount = 0;
    for (const item of order.items) {
      const currentProduct = products.find((p) => p.id === item.productId);
      if (!currentProduct) {
        skippedCount++;
        continue;
      }
      if (item.selectedColor || item.selectedSize) {
        const variant = currentProduct.variants?.find(
          (v) => v.color === item.selectedColor && v.size === item.selectedSize
        );
        if (!variant || variant.stock <= 0) {
          skippedCount++;
          continue;
        }
        addToCart({ ...currentProduct, selectedColor: item.selectedColor, selectedSize: item.selectedSize }, item.quantity);
      } else {
        if (currentProduct.stock <= 0) {
          skippedCount++;
          continue;
        }
        addToCart(currentProduct, item.quantity);
      }
      addedCount++;
    }
    if (addedCount > 0) {
      showToast(
        skippedCount > 0 ? t('dashboard_reorder_partial', { added: addedCount, skipped: skippedCount }) : t('dashboard_reorder_success'),
        skippedCount > 0 ? 'info' : 'success'
      );
      navigate('/cart');
    } else {
      showToast(t('dashboard_reorder_none_available'), 'error');
    }
  };

  const NAV_ITEMS: { key: string; labelKey: string; icon: React.ElementType }[] = [
    { key: 'orders', labelKey: 'dashboard_my_orders', icon: Package },
    { key: 'wishlist', labelKey: 'dashboard_wishlist', icon: Heart },
    { key: 'profile', labelKey: 'dashboard_profile_settings', icon: User },
    { key: 'address', labelKey: 'dashboard_address_book', icon: MapPin },
  ];

  const TAB_SUBTITLES: Record<string, string> = {
    orders: t('dashboard_orders_subtitle'),
    wishlist: t('dashboard_wishlist_subtitle'),
    profile: t('dashboard_profile_subtitle'),
    address: t('dashboard_address_subtitle'),
  };

  const sidebarContent = (
    <>
      <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
        <Link to="/" className="flex items-center gap-2 mb-2">
          <KuISOKOLogoSVG className="h-7 w-auto" />
        </Link>
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">{t('dashboard_my_account')}</p>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setSelectedOrder(null); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all ${
              activeTab === key
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={20} />
            {t(labelKey)}
          </button>
        ))}

        <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          {theme === 'light' ? t('dashboard_dark_mode') : t('dashboard_light_mode')}
        </button>
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          {user?.profileImage ? (
            <div className="w-11 h-11 rounded-full bg-cover bg-center shrink-0" style={{ backgroundImage: `url('${user.profileImage}')` }} />
          ) : (
            <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
              {getInitials(user?.name || '')}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-emerald-50 truncate">{user?.name}</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t('dashboard_customer')}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full flex items-center justify-center gap-2 rounded-xl h-11 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 dark:hover:text-rose-400 transition-all text-sm font-bold"
        >
          <LogOut size={18} />
          {t('dashboard_logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#FBF8F2] dark:bg-slate-950 text-slate-900 dark:text-emerald-50 transition-colors duration-300">
      {/* Mobile drawer backdrop */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      <main ref={mainRef} className="flex-1 min-w-0 flex flex-col overflow-y-auto overscroll-y-contain">
        {/* Mobile-only top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 sticky top-0 z-30">
          <Link to="/" className="shrink-0">
            <KuISOKOLogoSVG className="h-6 w-auto" />
          </Link>
          <p className="flex-1 min-w-0 text-center font-bold text-slate-900 dark:text-emerald-50 truncate px-3">
            {selectedOrder ? t('dashboard_order_details') : t(NAV_ITEMS.find(i => i.key === activeTab)?.labelKey || 'dashboard_my_orders')}
          </p>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>

        <div className="max-w-4xl w-full mx-auto px-2 sm:px-6 lg:px-10 py-6 sm:py-10">
          {activeTab === 'orders' && (
            <>
              {selectedOrder ? (
                <div className="space-y-8">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <button onClick={() => setSelectedOrder(null)} className="text-emerald-600 dark:text-emerald-400 text-sm font-bold hover:underline">
                      ← {t('dashboard_back_to_orders')}
                    </button>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${CUSTOMER_STATUS_STYLES[selectedOrder.status]}`}>
                        {t(`status_${selectedOrder.status.toLowerCase()}`)}
                      </span>
                      <button
                        onClick={() => handleReorder(selectedOrder)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-full transition-colors"
                      >
                        <RefreshCw size={13} /> {t('dashboard_buy_again')}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-2xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">{t('dashboard_order_details')}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                      {t('dashboard_order_id')}: {selectedOrder.orderNumber || selectedOrder.id} • {t('dashboard_order_date')}: {selectedOrder.date}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center gap-4">
                        <img src={item.images?.[0]} alt={item.name} className="w-16 h-16 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 dark:text-emerald-50 truncate">{item.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {item.quantity} × {getFormattedPrice(item.price)}
                          </p>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-emerald-50 shrink-0">{getFormattedPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>{t('cart_subtotal')}</span>
                      <span>{getFormattedPrice(selectedOrder.subtotal ?? selectedOrder.total)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>{t('dashboard_shipping_fee')}</span>
                      <span>{getFormattedPrice(selectedOrder.shippingFee ?? 0)}</span>
                    </div>
                    {!!selectedOrder.discountAmount && (
                      <div className="flex justify-between text-rose-500">
                        <span>{t('cart_discount')}</span>
                        <span>-{getFormattedPrice(selectedOrder.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-base text-slate-900 dark:text-emerald-50 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{t('cart_total')}</span>
                      <span>{getFormattedPrice(selectedOrder.total)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-emerald-50 mb-2 text-sm">{t('dashboard_delivery_address')}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedOrder.deliveryAddress.fullName}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedOrder.deliveryAddress.streetAddress}, {selectedOrder.deliveryAddress.cityTown}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedOrder.deliveryAddress.district}, {selectedOrder.deliveryAddress.country}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{selectedOrder.deliveryAddress.phoneNumber}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-emerald-50 mb-2 text-sm">{t('dashboard_payment_status')}</h3>
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${
                        selectedOrder.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : selectedOrder.paymentStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedOrder.paymentStatus === 'paid' ? t('dashboard_paid') : selectedOrder.paymentStatus === 'failed' ? t('dashboard_payment_failed') : t('dashboard_unpaid')}
                      </span>
                      {selectedOrder.paymentMethod && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{selectedOrder.paymentMethod}</p>}
                    </div>
                  </div>

                  {selectedOrder.status === 'Shipped' && selectedOrder.deliveryVerificationCode && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-5 sm:p-6 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <KeyRound size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-emerald-50">{t('order_verification_code_title')}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t('order_verification_code_subtitle')}</p>
                        <p className="text-2xl font-black tracking-[0.3em] text-emerald-800 dark:text-emerald-400 mt-1.5">{selectedOrder.deliveryVerificationCode}</p>
                      </div>
                    </div>
                  )}

                  {selectedOrder.status === 'Shipped' && selectedOrder.riderId && (
                    <RiderLocationMap orderId={selectedOrder.id} riderName={selectedOrder.riderName} />
                  )}

                  {selectedOrder.status === 'Delivered' && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-6 sm:p-8 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-700 text-white flex items-center justify-center mx-auto mb-3">
                        <PackageCheck size={26} />
                      </div>
                      <p className="font-black text-lg text-slate-900 dark:text-emerald-50">{t('order_delivered_thank_you_title')}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-sm mx-auto">{t('order_delivered_thank_you_message')}</p>
                    </div>
                  )}

                  {selectedOrder.returnRequest && (
                    <div className={`rounded-2xl p-5 sm:p-6 border ${
                      selectedOrder.returnRequest.status === 'pending'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900'
                        : selectedOrder.returnRequest.status === 'approved'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900'
                    }`}>
                      <p className="font-bold text-slate-900 dark:text-emerald-50">
                        {selectedOrder.returnRequest.status === 'pending' && t('order_return_pending_title')}
                        {selectedOrder.returnRequest.status === 'approved' && t('order_return_approved_title')}
                        {selectedOrder.returnRequest.status === 'rejected' && t('order_return_rejected_title')}
                      </p>
                      {selectedOrder.returnRequest.status === 'rejected' && selectedOrder.returnRequest.adminNote && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">{selectedOrder.returnRequest.adminNote}</p>
                      )}
                    </div>
                  )}

                  {selectedOrder.status === 'Delivered' && (!selectedOrder.returnRequest || selectedOrder.returnRequest.status === 'rejected') && (
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {showReturnForm ? (
                        <div className="space-y-3">
                          <textarea
                            rows={3}
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            placeholder={t('order_return_reason_placeholder')}
                            disabled={isSubmittingReturn}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-emerald-100 disabled:opacity-60 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSubmitReturn}
                              disabled={isSubmittingReturn || !returnReason.trim()}
                              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800 transition-colors disabled:opacity-50"
                            >
                              {t('order_return_submit')}
                            </button>
                            <button
                              onClick={() => { setShowReturnForm(false); setReturnReason(''); }}
                              disabled={isSubmittingReturn}
                              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              {t('dashboard_cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowReturnForm(true)}
                          className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <RefreshCw size={15} /> {t('order_request_return')}
                        </button>
                      )}
                    </div>
                  )}

                  {selectedOrder.trackingHistory && selectedOrder.trackingHistory.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-emerald-50 mb-4 text-sm">{t('dashboard_tracking_history')}</h3>
                      <div className="space-y-5">
                        {selectedOrder.trackingHistory.map((event, idx) => {
                          const Icon = TRACKING_ICONS[event.status] || CheckCircle2;
                          const isLast = idx === selectedOrder.trackingHistory!.length - 1;
                          return (
                            <div key={idx} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                  <Icon size={16} />
                                </div>
                                {!isLast && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />}
                              </div>
                              <div className="pb-5">
                                <p className="font-bold text-slate-900 dark:text-emerald-50 text-sm">{event.status}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{event.date}</p>
                                {event.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{event.description}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">{t(NAV_ITEMS[0].labelKey)}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{TAB_SUBTITLES.orders}</p>
                  </div>
                  {userOrders.length > 0 ? (
                    <div className="space-y-3">
                      {userOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left hover:shadow-md transition-shadow"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-emerald-50 truncate flex items-center gap-1.5">
                              Order #{order.orderNumber || order.id}
                              {order.returnRequest?.customerUnread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                              {order.items.length} {order.items.length === 1 ? t('dashboard_item') : t('dashboard_items')} · {getFormattedPrice(order.total)}
                            </p>
                          </div>
                          <span className={`inline-flex items-center self-start sm:self-auto px-3 py-1.5 text-xs font-bold rounded-full shrink-0 ${CUSTOMER_STATUS_STYLES[order.status]}`}>
                            {t(`status_${order.status.toLowerCase()}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-center py-14">
                      <Package size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500 dark:text-slate-400">{t('dashboard_no_orders')}</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'wishlist' && (
            <>
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">{t('dashboard_wishlist')}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{TAB_SUBTITLES.wishlist}</p>
              </div>
              {wishlistProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  {wishlistProducts.map(product => (
                    <ProductCard key={product.id} product={{ ...product, image: product.images[0] }} />
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-center py-14">
                  <Heart size={40} className="text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">{t('dashboard_no_wishlist_items')}</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'profile' && (
            <>
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">{t('dashboard_profile_settings')}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{TAB_SUBTITLES.profile}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 max-w-lg space-y-5">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth_full_name')}
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-emerald-100"
                    placeholder={t('dashboard_enter_full_name')}
                  />
                </div>
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth_username')}
                  </label>
                  <div className="relative">
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      minLength={3}
                      maxLength={20}
                      pattern="[a-zA-Z0-9_]+"
                      title={t('auth_username_hint')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`w-full px-5 py-3 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border outline-none focus:ring-2 focus:border-transparent text-slate-900 dark:text-emerald-100 ${
                        usernameStatus === 'taken' || usernameStatus === 'invalid'
                          ? 'border-rose-300 focus:ring-rose-600'
                          : usernameStatus === 'available'
                          ? 'border-emerald-300 focus:ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                      }`}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center">
                      {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-slate-400" />}
                      {usernameStatus === 'available' && <Check size={16} className="text-emerald-600" />}
                      {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X size={16} className="text-rose-500" />}
                    </span>
                  </div>
                  {usernameStatus === 'taken' ? (
                    <div className="mt-1.5">
                      <p className="text-xs font-semibold text-rose-600">{t('auth_username_taken')}</p>
                      {usernameSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {usernameSuggestions.map((suggestion) => (
                            <button
                              type="button"
                              key={suggestion}
                              onClick={() => setUsername(suggestion)}
                              className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 font-semibold transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : usernameStatus === 'invalid' ? (
                    <p className="mt-1.5 text-xs font-semibold text-rose-600">{t('auth_username_hint')}</p>
                  ) : usernameStatus === 'available' ? (
                    <p className="mt-1.5 text-xs font-semibold text-emerald-600">{t('auth_username_available')}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth_phone_number')}
                  </label>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-emerald-100"
                    placeholder={t('dashboard_enter_phone_number')}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('auth_email')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    disabled
                    className="w-full px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 outline-none text-slate-500 dark:text-slate-500 cursor-not-allowed"
                  />

                  {pendingEmailChange && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">
                      {t('dashboard_email_change_pending', { email: pendingEmailChange })}
                    </p>
                  )}

                  {isChangingEmail ? (
                    <div className="mt-3 space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div>
                        <label htmlFor="newEmail" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {t('dashboard_new_email')}
                        </label>
                        <input
                          id="newEmail"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder={t('dashboard_enter_new_email')}
                          className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-emerald-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRequestEmailChange}
                          disabled={isRequestingEmailChange || !newEmail.trim()}
                          className="px-4 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors text-sm active:scale-95 disabled:opacity-60"
                        >
                          {isRequestingEmailChange ? t('dashboard_sending') : t('dashboard_send_verification')}
                        </button>
                        <button
                          onClick={() => { setIsChangingEmail(false); setNewEmail(''); }}
                          className="px-4 py-2 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                          {t('dashboard_cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsChangingEmail(true)}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
                    >
                      {t('dashboard_change_email')}
                    </button>
                  )}
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={isSavingProfile || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'}
                    className="px-6 py-3 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg active:scale-95 disabled:opacity-60"
                  >
                    {isSavingProfile ? t('dashboard_saving') : t('dashboard_update_profile')}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-8 max-w-lg space-y-5 mt-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-emerald-50 flex items-center gap-2">
                  <KeyRound size={18} className="text-emerald-600 dark:text-emerald-400" /> {t('dashboard_change_password')}
                </h2>
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('dashboard_current_password')}
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-emerald-100"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('dashboard_new_password')}
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-emerald-100"
                  />
                </div>
                <div>
                  <label htmlFor="confirmNewPassword" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('dashboard_confirm_new_password')}
                  </label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-emerald-100"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">{passwordError}</p>
                )}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={isSavingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                    className="px-6 py-3 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg active:scale-95 disabled:opacity-60"
                  >
                    {isSavingPassword ? t('dashboard_saving') : t('dashboard_change_password')}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'address' && (
            <>
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">{t('dashboard_address_book')}</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{TAB_SUBTITLES.address}</p>
              </div>
              <div className="max-w-lg">
                {isEditingAddress ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6 space-y-4">
                    <textarea
                      rows={4}
                      value={addressDraft}
                      onChange={(e) => setAddressDraft(e.target.value)}
                      placeholder={t('dashboard_enter_address')}
                      className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-emerald-100 resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveAddress}
                        disabled={isSavingAddress}
                        className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg active:scale-95 disabled:opacity-60"
                      >
                        {isSavingAddress ? t('dashboard_saving') : t('dashboard_save_address')}
                      </button>
                      <button
                        onClick={() => { setIsEditingAddress(false); setAddressDraft(user?.address || ''); }}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        {t('dashboard_cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 sm:p-6">
                    <h3 className="font-bold text-slate-900 dark:text-emerald-50 mb-2">{t('dashboard_default_shipping_address')}</h3>
                    {user?.address ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">{user.address}</p>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-slate-500 italic">{t('dashboard_no_address')}</p>
                    )}
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setIsEditingAddress(true)}
                        className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-50 dark:hover:bg-slate-800"
                      >
                        {user?.address ? (
                          <>
                            <Pencil size={16} /> {t('dashboard_edit')}
                          </>
                        ) : (
                          <>
                            <Plus size={16} /> {t('dashboard_add_new_address')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export { UserDashboard };
