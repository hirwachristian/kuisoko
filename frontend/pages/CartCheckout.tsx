

import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { Trash2, Plus, Minus, CreditCard, Truck, CheckCircle, ArrowRight, ShoppingBag, Smartphone, Mail, RotateCw } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import AddressForm, { AddressFormHandle } from '../components/AddressForm';
import MtnBadge from '../components/MtnBadge';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { Order } from '../types';

// A payment method is treated as MTN MoMo (triggering the real "Request to Pay" phone prompt)
// when its admin-configured name mentions momo/mobile money/mtn - see AdminPaymentMethods.tsx.
const isMomoMethodName = (name: string) => /momo|mobile money|mtn/i.test(name);
// Likewise for Paypack - also matches "Airtel", since Airtel Money isn't reachable through MTN's
// own API above; Paypack is the only integration here that can push a prompt to an Airtel number.
const isPaypackMethodName = (name: string) => /paypack|airtel/i.test(name);

// Not one of the admin-configurable payment_methods rows - a fixed virtual option that's always
// offered when the store has a WhatsApp number configured (Admin > Store Configuration).
const WHATSAPP_METHOD_NAME = 'WhatsApp';
// Hidden at checkout for now - flip back on once it's wanted again. The OTP verification flow
// and backend gating stay in place either way, this only hides the option in the payment list.
const WHATSAPP_CHECKOUT_ENABLED = false;

const CartCheckout: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, user, addOrder, getFormattedPrice, paymentMethods, footerSettings, t, tCategory } = useAppContext();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const directBuy = location.state as { directBuyProduct: any; quantity: number } | null;

  const stepParam = searchParams.get('step');
  const [step, setStep] = useState(stepParam ? parseInt(stepParam, 10) : 1);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [showContactCard, setShowContactCard] = useState(!user);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showConfirmOrderModal, setShowConfirmOrderModal] = useState(false);

  // Payment state - selectedPayment holds the payment method's name (from admin-configured paymentMethods)
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [addressData, setAddressData] = useState<any>(null); // State to store address data from AddressForm

  // Mobile money payment prompt flow state - shared between MTN MoMo (direct MTN Developer API)
  // and Paypack (aggregates MTN + Airtel Money); which one is used is picked by the payment
  // method name (see isMomoMethodName/isPaypackMethodName) and stored per-attempt in pendingProvider.
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [mobileMoneyFlow, setMobileMoneyFlow] = useState<'idle' | 'requesting' | 'awaiting-approval' | 'failed' | 'error'>('idle');
  const [mobileMoneyError, setMobileMoneyError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [pendingProvider, setPendingProvider] = useState<'momo' | 'paypack' | null>(null);
  const cancelledRef = useRef(false);
  const addressFormRef = useRef<AddressFormHandle>(null);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Shipping fee - based on the delivery district, calculated once the address step is complete
  const [shipping, setShipping] = useState<{ fee: number; zoneName: string; isFreeShipping: boolean } | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const checkoutItems = directBuy
    ? [{ ...directBuy.directBuyProduct, quantity: directBuy.quantity }]
    : cart;

  const subtotal = checkoutItems.reduce((sum, item) => sum + (item.price * (1 - (item.discount || 0) / 100) * item.quantity), 0);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await apiFetch<{ code: string; discountAmount: number }>('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      });
      setAppliedCoupon({ code: result.code, discountAmount: result.discountAmount });
      setCouponError(null);
    } catch (e) {
      setAppliedCoupon(null);
      setCouponError(e instanceof ApiError ? e.message : 'Could not apply coupon.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Re-validate a currently-applied coupon whenever the subtotal changes (cart edits, etc.)
  // so a coupon that's no longer eligible (e.g. dropped below its minimum) doesn't silently overcharge.
  useEffect(() => {
    if (!appliedCoupon) return;
    (async () => {
      try {
        const result = await apiFetch<{ code: string; discountAmount: number }>('/coupons/validate', {
          method: 'POST',
          body: JSON.stringify({ code: appliedCoupon.code, subtotal }),
        });
        setAppliedCoupon({ code: result.code, discountAmount: result.discountAmount });
      } catch (e) {
        setAppliedCoupon(null);
        setCouponError(e instanceof ApiError ? `"${appliedCoupon.code}" no longer applies: ${e.message}` : 'This coupon no longer applies.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  useEffect(() => {
    if (!addressData?.district) {
      setShipping(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await apiFetch<{ fee: number; zoneName: string; isFreeShipping: boolean }>('/shipping/calculate', {
          method: 'POST',
          body: JSON.stringify({ district: addressData.district, subtotal }),
        });
        if (!cancelled) setShipping(result);
      } catch (e) {
        console.error('Error calculating shipping fee:', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressData?.district, subtotal]);

  const shippingFee = shipping?.fee ?? 0;
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  useEffect(() => {
    if (!selectedPayment && paymentMethods.length > 0) {
      const firstEnabled = paymentMethods.find(m => m.enabled);
      if (firstEnabled) setSelectedPayment(firstEnabled.name);
    }
  }, [paymentMethods, selectedPayment]);

  useEffect(() => {
    if (addressData?.phoneNumber && !mobileMoneyPhone) setMobileMoneyPhone(addressData.phoneNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressData]);

  const isMomoSelected = isMomoMethodName(selectedPayment);
  const isPaypackSelected = isPaypackMethodName(selectedPayment);
  const isMobileMoneySelected = isMomoSelected || isPaypackSelected;
  const isWhatsAppSelected = selectedPayment === WHATSAPP_METHOD_NAME;
  const whatsappNumber = (footerSettings.whatsappNumber || footerSettings.phoneNumber || '').trim();

  // Proves the customer controls the email on the order before it's placed at all - there's no
  // live payment gateway yet to gate this on instead. Triggered from the confirm-order modal
  // below, not tied to any particular payment method.
  const [otpStatus, setOtpStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendOtp = async () => {
    if (!addressData?.email) return;
    setOtpStatus('sending');
    setOtpError(null);
    try {
      await apiFetch('/orders/verification/request', {
        method: 'POST',
        body: JSON.stringify({ email: addressData.email, name: addressData.fullName }),
      });
      setOtpStatus('sent');
    } catch (e) {
      setOtpStatus('error');
      setOtpError(e instanceof ApiError ? e.message : 'Could not send the verification code.');
    }
  };

  // Auto-send the code the moment the confirm modal opens, so the customer doesn't need an extra click.
  useEffect(() => {
    if (showConfirmOrderModal && otpStatus === 'idle' && addressData?.email) {
      handleSendOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirmOrderModal, addressData?.email]);

  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otpCode;
    if (!addressData?.email || code.length !== 4) return;
    setOtpStatus('verifying');
    setOtpError(null);
    try {
      const { token } = await apiFetch<{ token: string }>('/orders/verification/verify', {
        method: 'POST',
        body: JSON.stringify({ email: addressData.email, code }),
      });
      setOtpStatus('verified');
      await confirmAndPlaceOrder(token);
    } catch (e) {
      setOtpStatus('sent');
      setOtpError(e instanceof ApiError ? e.message : 'Could not verify the code.');
      setOtpCode('');
      otpInputRefs.current[0]?.focus();
    }
  };

  // Each box holds one digit - typing advances focus forward, Backspace on an empty box moves
  // back, and a 4th digit auto-submits (with a codeOverride, since the setOtpCode above hasn't
  // necessarily flushed into `otpCode` yet by the time this runs).
  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const chars = otpCode.padEnd(4, ' ').split('');
    chars[index] = digit || ' ';
    const next = chars.join('').replace(/ /g, '');
    setOtpCode(next);
    setOtpError(null);
    if (digit && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
    if (digit && index === 3 && next.length === 4) {
      handleVerifyOtp(next);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerifyOtp();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    e.preventDefault();
    setOtpCode(pasted);
    setOtpError(null);
    const lastIndex = Math.min(pasted.length, 4) - 1;
    otpInputRefs.current[lastIndex]?.focus();
    if (pasted.length === 4) handleVerifyOtp(pasted);
  };

  // Autofocus the first box the moment the code has actually been sent, so the customer can start typing right away.
  useEffect(() => {
    if (otpStatus === 'sent') {
      otpInputRefs.current[0]?.focus();
    }
  }, [otpStatus]);

  const buildWhatsAppMessage = (order: Order) => {
    const lines = [
      `*${t('cart_whatsapp_msg_header', { orderNumber: order.orderNumber || order.id })}*`,
      '',
      `${t('cart_whatsapp_msg_customer')}: ${order.customerName}`,
      `${t('cart_whatsapp_msg_phone')}: ${order.deliveryAddress.phoneNumber}`,
      '',
      `${t('cart_whatsapp_msg_items')}:`,
      ...order.items.map((item) => {
        const variant = [item.selectedColor, item.selectedSize].filter(Boolean).join(', ');
        return `- ${item.name}${variant ? ` (${variant})` : ''} x${item.quantity} - ${getFormattedPrice(item.price * item.quantity)}`;
      }),
      '',
      `${t('cart_whatsapp_msg_address')}: ${[order.deliveryAddress.streetAddress, order.deliveryAddress.cityTown, order.deliveryAddress.district].filter(Boolean).join(', ')}`,
      `${t('cart_whatsapp_msg_subtotal')}: ${getFormattedPrice(order.subtotal ?? 0)}`,
      `${t('cart_whatsapp_msg_delivery_fee')}: ${getFormattedPrice(order.shippingFee ?? 0)}`,
      ...(order.discountAmount ? [`${t('cart_whatsapp_msg_discount')}: -${getFormattedPrice(order.discountAmount)}`] : []),
      `*${t('cart_whatsapp_msg_total')}: ${getFormattedPrice(order.total)}*`,
      '',
      t('cart_whatsapp_msg_footer'),
    ];
    return lines.join('\n');
  };

  const handleWhatsAppCheckout = async (verificationToken: string) => {
    setIsPlacingOrder(true);
    const order = await addOrder({
      customerName: addressData?.fullName || 'Guest User',
      deliveryAddress: addressData,
      items: checkoutItems,
      paymentMethod: WHATSAPP_METHOD_NAME,
      couponCode: appliedCoupon?.code,
      verificationToken,
    });
    setIsPlacingOrder(false);
    if (!order) return; // addOrder already surfaced the error via toast

    window.open(`https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(buildWhatsAppMessage(order))}`, '_blank', 'noopener,noreferrer');
    setPlacedOrderId(order.orderNumber || order.id);
    if (!directBuy) clearCart();
    setStep(4);
  };

  // Both providers' request/status endpoints return the same shape (`{ referenceId }` /
  // `{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }`), so one flow drives either of them off a
  // provider-specific path prefix.
  const pollMobileMoneyStatus = async (provider: 'momo' | 'paypack', referenceId: string, order: Order) => {
    const statusPath = provider === 'momo' ? `/momo/status/${referenceId}` : `/paypack/status/${referenceId}`;
    const maxAttempts = 40; // ~2 minutes at 3s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (cancelledRef.current) return;
      try {
        const { status } = await apiFetch<{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }>(statusPath);
        if (cancelledRef.current) return;
        if (status === 'SUCCESSFUL') {
          setMobileMoneyFlow('idle');
          setPlacedOrderId(order.orderNumber || order.id);
          if (!directBuy) clearCart();
          setStep(4);
          return;
        }
        if (status === 'FAILED') {
          setMobileMoneyFlow('failed');
          return;
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setMobileMoneyFlow('error');
        setMobileMoneyError(e instanceof ApiError ? e.message : 'Could not check payment status.');
        return;
      }
    }
    setMobileMoneyFlow('failed');
    setMobileMoneyError(t('cart_momo_timeout'));
  };

  const startMobileMoneyPayment = async (provider: 'momo' | 'paypack', order: Order) => {
    setPendingProvider(provider);
    setMobileMoneyFlow('requesting');
    setMobileMoneyError(null);
    try {
      const requestPath = provider === 'momo' ? '/momo/request-to-pay' : '/paypack/cashin';
      const { referenceId } = await apiFetch<{ referenceId: string }>(requestPath, {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, phoneNumber: mobileMoneyPhone }),
      });
      setMobileMoneyFlow('awaiting-approval');
      await pollMobileMoneyStatus(provider, referenceId, order);
    } catch (e) {
      setMobileMoneyFlow('error');
      setMobileMoneyError(e instanceof ApiError ? e.message : 'Could not start the mobile money payment.');
    }
  };

  const handleMobileMoneyCheckout = async (verificationToken: string) => {
    if (!mobileMoneyPhone.trim()) {
      setMobileMoneyError(t('cart_momo_enter_phone'));
      setMobileMoneyFlow('error');
      return;
    }
    setIsPlacingOrder(true);
    const order = await addOrder({
      customerName: addressData?.fullName || 'Guest User',
      deliveryAddress: addressData,
      items: checkoutItems,
      couponCode: appliedCoupon?.code,
      verificationToken,
    });
    setIsPlacingOrder(false);
    if (!order) return; // addOrder already surfaced the error via toast

    setPendingOrder(order);
    await startMobileMoneyPayment(isPaypackSelected ? 'paypack' : 'momo', order);
  };

  const retryMobileMoneyPayment = () => {
    if (pendingOrder && pendingProvider) startMobileMoneyPayment(pendingProvider, pendingOrder);
  };

  const handleCheckout = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    // Step 3 ("Place Order"): verify the customer's email first - there's no live payment gateway
    // yet to gate placing an order on instead.
    setShowConfirmOrderModal(true);
  };

  const confirmAndPlaceOrder = async (verificationToken: string) => {
    setShowConfirmOrderModal(false);
    if (isMobileMoneySelected) {
      await handleMobileMoneyCheckout(verificationToken);
      return;
    }
    if (isWhatsAppSelected) {
      await handleWhatsAppCheckout(verificationToken);
      return;
    }
    // Manual/pay-on-delivery methods - payment is confirmed by the admin later
    setIsPlacingOrder(true);
    const order = await addOrder({
      customerName: addressData?.fullName || 'Guest User',
      deliveryAddress: addressData,
      items: checkoutItems,
      paymentMethod: selectedPayment || undefined,
      couponCode: appliedCoupon?.code,
      verificationToken,
    });
    setIsPlacingOrder(false);

    if (order) {
      setPlacedOrderId(order.orderNumber || order.id);
      if (!directBuy) {
        clearCart();
      }
      setStep(4);
    }
  };

  if (checkoutItems.length === 0 && step !== 4) {
    return (
      <div className="max-w-7xl mx-auto px-2 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 text-slate-400">
          <ShoppingBag size={32} className="sm:w-12 sm:h-12" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 sm:mb-4">{t('cart_empty_title')}</h2>
        <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-8">{t('cart_empty_subtitle')}</p>
        <Link to="/shop" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all">
          {t('cart_start_shopping')}
        </Link>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 sm:py-24 text-center animate-fade-in">
        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 text-emerald-600">
          <CheckCircle size={36} className="sm:w-14 sm:h-14" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 sm:mb-4">{t('cart_order_confirmed')}</h2>
        <p className="text-sm sm:text-base text-slate-600 mb-6 sm:mb-8 leading-relaxed">
          {t('cart_thank_you', { name: user?.name?.split(' ')[0] || 'customer', id: placedOrderId || '' })}
        </p>
        <div className="space-y-3 sm:space-y-4">
          <Link to="/dashboard" className="block w-full bg-slate-900 text-white py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-bold hover:bg-slate-800 transition-colors">
            {t('cart_track_order')}
          </Link>
          <Link to="/" className="block w-full text-emerald-600 py-3 sm:py-4 text-sm sm:text-base font-bold">
            {t('cart_back_to_home')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-10">
      {showContactCard && !user ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-full max-w-xl bg-gradient-to-br from-orange-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-orange-200 dark:border-slate-700 rounded-2xl shadow p-5 sm:p-8 flex flex-col items-center transition-colors duration-300">
            <h3 className="text-lg sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-4 sm:mb-6 text-center">
              {t('cart_sign_in_to_checkout')}
            </h3>
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center mb-4">
              <button
                className="flex-1 py-3 rounded-xl border border-emerald-700 dark:border-emerald-500 text-sm sm:text-base text-emerald-900 dark:text-emerald-100 font-bold bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-slate-800 transition"
                onClick={() => window.location.href = '/signin'}
              >
                {t('cart_sign_in')}
              </button>
            </div>
            <div className="flex items-center w-full my-4">
              <div className="flex-1 border-t border-emerald-200 dark:border-slate-700"></div>
              <span className="mx-4 text-sm text-slate-400 font-bold">{t('cart_or')}</span>
              <div className="flex-1 border-t border-emerald-200 dark:border-slate-700"></div>
            </div>
            <button className="w-full py-3 sm:py-4 rounded-xl border-2 border-emerald-700 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold text-sm sm:text-lg bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-slate-800 transition mb-2" onClick={() => setShowContactCard(false)}>{t('cart_continue_as_guest')}</button>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
              <span role="img" aria-label="bulb">💡</span> {t('cart_guest_checkout_hint')}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center mb-6 sm:mb-10">
            {[t('cart_step_cart'), t('cart_step_address'), t('cart_step_payment')].map((label, idx) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm
                    ${step >= idx + 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <span className={`mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-bold ${step >= idx + 1 ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>
                </div>
                {idx < 2 && <div className={`w-8 sm:w-16 h-1 mx-1.5 sm:mx-2 rounded-full ${step > idx + 1 ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            <div className="lg:col-span-2 flex flex-col gap-6">
              {step === 1 && (
                <>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-6 transition-colors duration-300">
                    <h2 className="flex items-center gap-2 text-lg sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-4 sm:mb-6">
                      <ShoppingBag size={20} className="sm:w-6 sm:h-6" /> {t('cart_your_cart')}
                    </h2>
                    {checkoutItems.map(item => {
                      return (
                      <div key={item.id} className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6">
                        <img src={item.selectedImage || item.images[0]} alt={item.name} className="w-14 h-14 sm:w-20 sm:h-20 shrink-0 rounded-xl object-contain p-1 sm:p-1.5 bg-white border border-slate-100 dark:border-slate-800" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-sm sm:text-lg text-emerald-900 dark:text-emerald-100 truncate">{item.name.split(' - ')[0]}</div>
                            <div className="font-bold text-sm sm:text-lg text-emerald-900 dark:text-emerald-100 shrink-0">
                              {getFormattedPrice((Number(item.price) || 0) * (1 - (item.discount || 0) / 100) * item.quantity)}
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t('cart_category_label')}: {tCategory(item.category)}</div>
                          {(item as any).selectedColor && (
                            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t('cart_color_label')}: {(item as any).selectedColor}</div>
                          )}
                          {(item as any).selectedSize && (
                            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t('cart_size_label')}: {(item as any).selectedSize}</div>
                          )}
                          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1">{t('cart_price_label')}: {getFormattedPrice(Number(item.price) || 0)}</div>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-100 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 font-bold text-sm sm:text-base">-</button>
                            <span className="mx-1 sm:mx-2 text-sm sm:text-base dark:text-emerald-100">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-100 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 font-bold text-sm sm:text-base">+</button>
                            <button onClick={() => removeFromCart(item.id)} className="ml-2 sm:ml-4 text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-semibold hover:underline">{t('cart_remove')}</button>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                    <div className="flex justify-between items-center mt-6 sm:mt-8">
                      <Link to="/shop" className="text-sm sm:text-base text-emerald-900 dark:text-emerald-300 font-semibold flex items-center gap-1 hover:underline">
                        &larr; {t('cart_continue_shopping')}
                      </Link>
                    </div>
                  </div>
                </>
              )}
              {step === 2 && (
                <AddressForm ref={addressFormRef} onProceed={() => setStep(3)} setAddressData={setAddressData} />
              )}
              {step === 3 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-8 shadow-sm transition-colors duration-300">
                  <h2 className="text-lg sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-4 sm:mb-6">{t('cart_payment')}</h2>

                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-emerald-100 mb-3 sm:mb-4">{t('cart_select_payment_method')}</h3>
                    <div className="space-y-2.5 sm:space-y-3">
                      {(paymentMethods || []).filter(m => m.enabled).map((method) => (
                        <button
                          key={method.name + method.detail}
                          onClick={() => setSelectedPayment(method.name)}
                          className={`w-full flex items-center gap-2.5 sm:gap-3 text-left p-3 sm:p-4 rounded-xl border-2 transition ${selectedPayment === method.name ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-500' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-slate-600'}`}
                        >
                          {/mtn/i.test(method.name) && <MtnBadge />}
                          <span className="text-sm sm:text-base text-slate-900 dark:text-emerald-100">{method.name} ({method.detail})</span>
                        </button>
                      ))}
                      {WHATSAPP_CHECKOUT_ENABLED && !!whatsappNumber && (
                        <button
                          onClick={() => setSelectedPayment(WHATSAPP_METHOD_NAME)}
                          className={`w-full flex items-center gap-2.5 sm:gap-3 text-left p-3 sm:p-4 rounded-xl border-2 transition ${isWhatsAppSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-500' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-slate-600'}`}
                        >
                          <WhatsAppIcon size={18} className="text-green-600 dark:text-green-400" />
                          <span className="text-sm sm:text-base text-slate-900 dark:text-emerald-100">{WHATSAPP_METHOD_NAME} ({whatsappNumber})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isWhatsAppSelected && (
                    <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 mb-4 sm:mb-6 -mt-2 sm:-mt-4">
                      {t('cart_whatsapp_option_hint')}
                    </p>
                  )}

                  {isMobileMoneySelected && (
                    <div className="mb-4 sm:mb-6">
                      <label htmlFor="mobileMoneyPhone" className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">
                        {t('cart_momo_phone_label')}
                      </label>
                      <input
                        id="mobileMoneyPhone"
                        type="tel"
                        value={mobileMoneyPhone}
                        onChange={(e) => setMobileMoneyPhone(e.target.value)}
                        placeholder="07XXXXXXXX"
                        className="w-full p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm sm:text-base text-slate-900 dark:text-emerald-100"
                      />
                      <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {t('cart_momo_prompt_hint', { amount: getFormattedPrice(total) })}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 sm:gap-4">
                    <button onClick={() => setStep(2)} className="flex-1 py-3 sm:py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{t('cart_back')}</button>
                    <button onClick={handleCheckout} disabled={isPlacingOrder || mobileMoneyFlow !== 'idle'} className="flex-1 py-3 sm:py-4 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-bold hover:bg-orange-600 transition-all shadow-lg active:scale-95 disabled:opacity-60">
                      {isPlacingOrder ? t('cart_placing_order') : isWhatsAppSelected ? t('cart_whatsapp_continue') : t('cart_place_order')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 sm:p-8 shadow-md lg:sticky lg:top-[var(--header-offset,6rem)] transition-colors duration-300">
                <h3 className="text-base sm:text-lg font-bold text-emerald-900 dark:text-emerald-50 mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400"><ShoppingBag size={18} className="sm:w-5 sm:h-5" /></span> {t('cart_order_summary')}
                </h3>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span>{t('cart_subtotal_items', { n: checkoutItems.reduce((a, b) => a + b.quantity, 0) })}</span>
                  <span className="font-bold text-slate-900 dark:text-emerald-100">{getFormattedPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950 rounded-lg px-3 py-2 mb-4 text-xs sm:text-sm">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 min-w-0">
                    <CheckCircle size={14} className="sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">{t('cart_delivery')}{shipping ? ` (${shipping.zoneName})` : ''}</span>
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                    {!addressData ? t('cart_calculated_next_step') : shipping ? (shipping.isFreeShipping ? t('cart_free') : getFormattedPrice(shipping.fee)) : '...'}
                  </span>
                </div>

                <div className="mb-4">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950 rounded-lg px-3 py-2">
                      <span className="text-orange-700 dark:text-orange-300 font-bold text-sm">{t('cart_coupon_applied_label', { code: appliedCoupon.code })}</span>
                      <button onClick={handleRemoveCoupon} className="text-xs font-bold text-orange-700 dark:text-orange-300 hover:underline">{t('cart_remove')}</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value); setCouponError(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyCoupon(); } }}
                        placeholder={t('cart_coupon_placeholder')}
                        className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 dark:bg-emerald-700 text-white hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors disabled:opacity-60"
                      >
                        {isApplyingCoupon ? '...' : t('cart_apply')}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="text-rose-600 dark:text-rose-400 text-xs mt-1.5">{couponError}</p>}
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-sm sm:text-base text-orange-600 dark:text-orange-400 font-semibold mb-2">
                    <span>{t('cart_discount')}</span>
                    <span>-{getFormattedPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg sm:text-2xl font-black text-emerald-900 dark:text-emerald-100 mb-2">
                  <span>{t('cart_total')}</span>
                  <span>{getFormattedPrice(total)}</span>
                </div>
                {step === 1 && (
                  <button
                    onClick={handleCheckout}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 sm:py-4 rounded-xl text-sm sm:text-lg transition-all shadow-lg active:scale-95"
                  >
                    {t('cart_proceed_to_checkout')} <ArrowRight size={18} className="inline ml-2 sm:w-5 sm:h-5" />
                  </button>
                )}
                {step === 2 && (
                  <div className="flex gap-3 sm:gap-4">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-3 sm:py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t('addr_back_to_cart')}
                    </button>
                    <button
                      onClick={() => addressFormRef.current?.submit()}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 sm:py-4 rounded-xl text-sm sm:text-base transition-all shadow-lg active:scale-95"
                    >
                      {t('addr_proceed_to_payment')}
                    </button>
                  </div>
                )}
                {step === 3 && (
                  <button
                    onClick={handleCheckout}
                    disabled={isPlacingOrder || mobileMoneyFlow !== 'idle'}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 sm:py-4 rounded-xl text-sm sm:text-lg transition-all shadow-lg active:scale-95 disabled:opacity-60"
                  >
                    {isPlacingOrder ? t('cart_placing_order') : isWhatsAppSelected ? t('cart_whatsapp_continue') : t('cart_place_order')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showConfirmOrderModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-9 max-w-sm w-full text-center shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Mail size={28} className="text-white" />
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-emerald-50 mb-2">{t('cart_otp_verify_title')}</h3>
            {otpStatus === 'sending' && (
              <div className="py-6">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t('cart_otp_sending_code')}</p>
              </div>
            )}
            {otpStatus !== 'sending' && otpStatus !== 'idle' && (
              <>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  {t('cart_otp_code_sent_prefix')} <span className="font-bold text-slate-700 dark:text-emerald-200">{addressData?.email || ''}</span>
                </p>
                <div className="flex justify-center gap-2.5 sm:gap-3 mb-2" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { otpInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={otpCode[i] || ''}
                      onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={otpStatus === 'verifying'}
                      className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-extrabold rounded-2xl border-2 outline-none transition-all text-slate-900 dark:text-emerald-100 bg-slate-50 dark:bg-slate-950 disabled:opacity-60 ${otpError ? 'border-rose-400 dark:border-rose-600' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15'}`}
                    />
                  ))}
                </div>
                <div className="h-5 mb-4">
                  {otpError && <p className="text-rose-600 dark:text-rose-400 text-xs font-semibold">{otpError}</p>}
                </div>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => { setShowConfirmOrderModal(false); setOtpStatus('idle'); setOtpCode(''); setOtpError(null); }}
                    className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t('cart_confirm_order_cancel')}
                  </button>
                  <button
                    onClick={() => handleVerifyOtp()}
                    disabled={otpStatus === 'verifying' || otpCode.length !== 4}
                    className="flex-1 py-2.5 sm:py-3 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-60 disabled:shadow-none"
                  >
                    {otpStatus === 'verifying' ? '...' : t('cart_otp_verify_button')}
                  </button>
                </div>
                <button onClick={handleSendOtp} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                  <RotateCw size={12} /> {t('cart_otp_resend_code')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {mobileMoneyFlow !== 'idle' && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-8 max-w-sm w-full text-center shadow-2xl">
            {(mobileMoneyFlow === 'requesting' || mobileMoneyFlow === 'awaiting-approval') && (
              <>
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                  <Smartphone size={24} className="sm:w-7 sm:h-7 text-emerald-700 dark:text-emerald-400" />
                </div>
                {/mtn/i.test(selectedPayment) && <MtnBadge className="mb-3" />}
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-emerald-50 mb-2">{t('cart_momo_check_phone')}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {mobileMoneyFlow === 'requesting'
                    ? t('cart_momo_sending')
                    : t('cart_momo_awaiting', { amount: getFormattedPrice(total), phone: mobileMoneyPhone })}
                </p>
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              </>
            )}
            {mobileMoneyFlow === 'failed' && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-rose-600 mb-2">{t('cart_momo_not_approved')}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">{mobileMoneyError || t('cart_momo_declined')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setMobileMoneyFlow('idle')} className="flex-1 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300">{t('cart_close')}</button>
                  <button onClick={retryMobileMoneyPayment} className="flex-1 py-2.5 sm:py-3 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-bold hover:bg-orange-600 transition-all">{t('cart_try_again')}</button>
                </div>
              </>
            )}
            {mobileMoneyFlow === 'error' && (
              <>
                <h3 className="text-base sm:text-lg font-bold text-rose-600 mb-2">{t('cart_something_wrong')}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">{mobileMoneyError}</p>
                <button onClick={() => setMobileMoneyFlow('idle')} className="w-full py-2.5 sm:py-3 rounded-xl bg-slate-900 text-white text-sm sm:text-base font-bold">{t('cart_close')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartCheckout;
