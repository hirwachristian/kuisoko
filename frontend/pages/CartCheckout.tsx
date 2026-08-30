

import React, { useState, useEffect, useRef } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { Trash2, Plus, Minus, CreditCard, Truck, CheckCircle, ArrowRight, ShoppingBag, Smartphone } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import AddressForm from '../components/AddressForm';
import MtnBadge from '../components/MtnBadge';
import { Order } from '../types';

// A payment method is treated as MTN MoMo (triggering the real "Request to Pay" phone prompt)
// when its admin-configured name mentions momo/mobile money/mtn - see AdminPaymentMethods.tsx.
const isMomoMethodName = (name: string) => /momo|mobile money|mtn/i.test(name);

const CartCheckout: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, user, addOrder, getFormattedPrice, paymentMethods, t, tCategory } = useAppContext();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const directBuy = location.state as { directBuyProduct: any; quantity: number } | null;

  const stepParam = searchParams.get('step');
  const [step, setStep] = useState(stepParam ? parseInt(stepParam, 10) : 1);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [showContactCard, setShowContactCard] = useState(!user);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Payment state - selectedPayment holds the payment method's name (from admin-configured paymentMethods)
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [addressData, setAddressData] = useState<any>(null); // State to store address data from AddressForm

  // MTN MoMo "Request to Pay" flow state
  const [momoPhone, setMomoPhone] = useState('');
  const [momoFlow, setMomoFlow] = useState<'idle' | 'requesting' | 'awaiting-approval' | 'failed' | 'error'>('idle');
  const [momoError, setMomoError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Shipping fee - based on the delivery district, calculated once the address step is complete
  const [shipping, setShipping] = useState<{ fee: number; zoneName: string; isFreeShipping: boolean } | null>(null);

  // Coupon code
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const checkoutItems = directBuy
    ? [{ ...directBuy.directBuyProduct, quantity: directBuy.quantity }]
    : cart;

  // All prices are in RWF
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
    if (addressData?.phoneNumber && !momoPhone) setMomoPhone(addressData.phoneNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressData]);

  const isMomoSelected = isMomoMethodName(selectedPayment);

  const pollMomoStatus = async (referenceId: string, order: Order) => {
    const maxAttempts = 40; // ~2 minutes at 3s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (cancelledRef.current) return;
      try {
        const { status } = await apiFetch<{ status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }>(`/momo/status/${referenceId}`);
        if (cancelledRef.current) return;
        if (status === 'SUCCESSFUL') {
          setMomoFlow('idle');
          setPlacedOrderId(order.orderNumber || order.id);
          if (!directBuy) clearCart();
          setStep(4);
          return;
        }
        if (status === 'FAILED') {
          setMomoFlow('failed');
          return;
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setMomoFlow('error');
        setMomoError(e instanceof ApiError ? e.message : 'Could not check payment status.');
        return;
      }
    }
    setMomoFlow('failed');
    setMomoError(t('cart_momo_timeout'));
  };

  const startMomoPayment = async (order: Order) => {
    setMomoFlow('requesting');
    setMomoError(null);
    try {
      const { referenceId } = await apiFetch<{ referenceId: string }>('/momo/request-to-pay', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, phoneNumber: momoPhone }),
      });
      setMomoFlow('awaiting-approval');
      await pollMomoStatus(referenceId, order);
    } catch (e) {
      setMomoFlow('error');
      setMomoError(e instanceof ApiError ? e.message : 'Could not start the mobile money payment.');
    }
  };

  const handleMomoCheckout = async () => {
    if (!momoPhone.trim()) {
      setMomoError(t('cart_momo_enter_phone'));
      setMomoFlow('error');
      return;
    }
    setIsPlacingOrder(true);
    const order = await addOrder({
      customerName: addressData?.fullName || 'Guest User',
      deliveryAddress: addressData,
      items: checkoutItems,
      couponCode: appliedCoupon?.code,
    });
    setIsPlacingOrder(false);
    if (!order) return; // addOrder already surfaced the error via toast

    setPendingOrder(order);
    await startMomoPayment(order);
  };

  const retryMomoPayment = () => {
    if (pendingOrder) startMomoPayment(pendingOrder);
  };

  const handleCheckout = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (isMomoSelected) {
      await handleMomoCheckout();
      return;
    }
    // Step 3: Place Order (manual/pay-on-delivery methods - payment is confirmed by the admin later)
    setIsPlacingOrder(true);
    const order = await addOrder({
      customerName: addressData?.fullName || 'Guest User',
      deliveryAddress: addressData,
      items: checkoutItems,
      paymentMethod: selectedPayment || undefined,
      couponCode: appliedCoupon?.code,
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
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
          <ShoppingBag size={48} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">{t('cart_empty_title')}</h2>
        <p className="text-slate-500 mb-8">{t('cart_empty_subtitle')}</p>
        <Link to="/shop" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all">
          {t('cart_start_shopping')}
        </Link>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-600">
          <CheckCircle size={56} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">{t('cart_order_confirmed')}</h2>
        <p className="text-slate-600 mb-8 leading-relaxed">
          {t('cart_thank_you', { name: user?.name?.split(' ')[0] || 'customer', id: placedOrderId || '' })}
        </p>
        <div className="space-y-4">
          <Link to="/dashboard" className="block w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-colors">
            {t('cart_track_order')}
          </Link>
          <Link to="/" className="block w-full text-emerald-600 py-4 font-bold">
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
          <div className="w-full max-w-xl bg-gradient-to-br from-orange-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 border border-orange-200 dark:border-slate-700 rounded-2xl shadow p-8 flex flex-col items-center transition-colors duration-300">
            <h3 className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-6 text-center">
              {t('cart_sign_in_to_checkout')}
            </h3>
            <div className="flex flex-col md:flex-row gap-4 w-full justify-center mb-4">
              <button
                className="flex-1 py-3 rounded-xl border border-emerald-700 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-slate-800 transition"
                onClick={() => window.location.href = '/signin'}
              >
                {t('cart_sign_in')}
              </button>
            </div>
            <div className="flex items-center w-full my-4">
              <div className="flex-1 border-t border-emerald-200 dark:border-slate-700"></div>
              <span className="mx-4 text-slate-400 font-bold">{t('cart_or')}</span>
              <div className="flex-1 border-t border-emerald-200 dark:border-slate-700"></div>
            </div>
            <button className="w-full py-4 rounded-xl border-2 border-emerald-700 dark:border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold text-lg bg-white dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-slate-800 transition mb-2" onClick={() => setShowContactCard(false)}>{t('cart_continue_as_guest')}</button>
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
              <span role="img" aria-label="bulb">💡</span> {t('cart_guest_checkout_hint')}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stepper */}
          <div className="flex items-center justify-center mb-10">
            {[t('cart_step_cart'), t('cart_step_address'), t('cart_step_payment')].map((label, idx) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${step >= idx + 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {idx + 1}
                  </div>
                  <span className={`mt-2 text-xs font-bold ${step >= idx + 1 ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>
                </div>
                {idx < 2 && <div className={`w-16 h-1 mx-2 rounded-full ${step > idx + 1 ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Checkout Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-6">
              {step === 1 && (
                <>
                  {/* Cart Items */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 transition-colors duration-300">
                    <h2 className="flex items-center gap-2 text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-6">
                      <ShoppingBag size={24} /> {t('cart_your_cart')}
                    </h2>
                    {checkoutItems.map(item => {
                      return (
                      <div key={item.id} className="flex items-center gap-4 mb-6">
                        <img src={item.images[0]} alt={item.name} className="w-20 h-20 rounded-xl object-contain p-1.5 bg-white border border-slate-100 dark:border-slate-800" />
                        <div className="flex-1">
                          <div className="font-bold text-lg text-emerald-900 dark:text-emerald-100">{item.name.split(' - ')[0]}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{t('cart_category_label')}: {tCategory(item.category)}</div>
                          {(item as any).selectedColor && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">{t('cart_color_label')}: {(item as any).selectedColor}</div>
                          )}
                          {(item as any).selectedSize && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">{t('cart_size_label')}: {(item as any).selectedSize}</div>
                          )}
                          <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">{t('cart_price_label')}: {getFormattedPrice(Number(item.price) || 0)}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 font-bold">-</button>
                            <span className="mx-2 dark:text-emerald-100">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-emerald-900 dark:text-emerald-300 font-bold">+</button>
                            <button onClick={() => removeFromCart(item.id)} className="ml-4 text-rose-600 dark:text-rose-400 font-semibold hover:underline">{t('cart_remove')}</button>
                          </div>
                        </div>
                        <div className="font-bold text-lg text-emerald-900 dark:text-emerald-100">
                          {getFormattedPrice((Number(item.price) || 0) * (1 - (item.discount || 0) / 100) * item.quantity)}
                        </div>
                      </div>
                      )
                    })}
                    <div className="flex justify-between items-center mt-8">
                      <Link to="/shop" className="text-emerald-900 dark:text-emerald-300 font-semibold flex items-center gap-1 hover:underline">
                        &larr; {t('cart_continue_shopping')}
                      </Link>
                    </div>
                  </div>
                </>
              )}
              {step === 2 && (
                <AddressForm onBack={() => setStep(1)} onProceed={() => setStep(3)} setAddressData={setAddressData} />
              )}
              {step === 3 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm transition-colors duration-300">
                  <h2 className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-50 mb-6">{t('cart_payment')}</h2>

                  {/* Payment Method Selection */}
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-emerald-100 mb-4">{t('cart_select_payment_method')}</h3>
                    <div className="space-y-3">
                      {(paymentMethods || []).filter(m => m.enabled).map((method) => (
                        <button
                          key={method.name + method.detail}
                          onClick={() => setSelectedPayment(method.name)}
                          className={`w-full flex items-center gap-3 text-left p-4 rounded-xl border-2 transition ${selectedPayment === method.name ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-500' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-slate-600'}`}
                        >
                          {/mtn/i.test(method.name) && <MtnBadge />}
                          <span className="text-slate-900 dark:text-emerald-100">{method.name} ({method.detail})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {isMomoSelected && (
                    <div className="mb-6">
                      <label htmlFor="momoPhone" className="block text-sm font-bold text-slate-700 dark:text-emerald-300 mb-2">
                        {t('cart_momo_phone_label')}
                      </label>
                      <input
                        id="momoPhone"
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="07XXXXXXXX"
                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 text-slate-900 dark:text-emerald-100"
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                        {t('cart_momo_prompt_hint', { amount: getFormattedPrice(total) })}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">{t('cart_back')}</button>
                    <button onClick={handleCheckout} disabled={isPlacingOrder || momoFlow !== 'idle'} className="flex-1 py-4 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all shadow-lg active:scale-95 disabled:opacity-60">
                      {isPlacingOrder ? t('cart_placing_order') : t('cart_place_order')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Order Summary */}
            <div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 shadow-md sticky top-24 transition-colors duration-300">
                <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-50 mb-6 flex items-center gap-2">
                  <span className="text-emerald-700 dark:text-emerald-400"><ShoppingBag size={20} /></span> {t('cart_order_summary')}
                </h3>
                <div className="flex justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span>{t('cart_subtotal_items', { n: checkoutItems.reduce((a, b) => a + b.quantity, 0) })}</span>
                  <span className="font-bold text-slate-900 dark:text-emerald-100">{getFormattedPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950 rounded-lg px-3 py-2 mb-4">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle size={16} /> {t('cart_delivery')}{shipping ? ` (${shipping.zoneName})` : ''}
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    {!addressData ? t('cart_calculated_next_step') : shipping ? (shipping.isFreeShipping ? t('cart_free') : getFormattedPrice(shipping.fee)) : '...'}
                  </span>
                </div>

                {/* Coupon code */}
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
                  <div className="flex justify-between text-orange-600 dark:text-orange-400 font-semibold mb-2">
                    <span>{t('cart_discount')}</span>
                    <span>-{getFormattedPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-2xl font-black text-emerald-900 dark:text-emerald-100 mb-2">
                  <span>{t('cart_total')}</span>
                  <span>{getFormattedPrice(total)}</span>
                </div>
                {step === 1 && (
                  <button
                    onClick={handleCheckout}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg active:scale-95"
                  >
                    {t('cart_proceed_to_checkout')} <ArrowRight size={20} className="inline ml-2" />
                  </button>
                )}
                {step === 3 && (
                  <button
                    onClick={handleCheckout}
                    disabled={isPlacingOrder || momoFlow !== 'idle'}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg active:scale-95 disabled:opacity-60"
                  >
                    {isPlacingOrder ? t('cart_placing_order') : t('cart_place_order')}
                  </button>
                )}
              </div>
              {/* ... security badges ... */}
            </div>
          </div>
        </>
      )}

      {momoFlow !== 'idle' && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            {(momoFlow === 'requesting' || momoFlow === 'awaiting-approval') && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                  <Smartphone size={28} className="text-emerald-700 dark:text-emerald-400" />
                </div>
                {/mtn/i.test(selectedPayment) && <MtnBadge className="mb-3" />}
                <h3 className="text-lg font-bold text-slate-900 dark:text-emerald-50 mb-2">{t('cart_momo_check_phone')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {momoFlow === 'requesting'
                    ? t('cart_momo_sending')
                    : t('cart_momo_awaiting', { amount: getFormattedPrice(total), phone: momoPhone })}
                </p>
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              </>
            )}
            {momoFlow === 'failed' && (
              <>
                <h3 className="text-lg font-bold text-rose-600 mb-2">{t('cart_momo_not_approved')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{momoError || t('cart_momo_declined')}</p>
                <div className="flex gap-3">
                  <button onClick={() => setMomoFlow('idle')} className="flex-1 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300">{t('cart_close')}</button>
                  <button onClick={retryMomoPayment} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all">{t('cart_try_again')}</button>
                </div>
              </>
            )}
            {momoFlow === 'error' && (
              <>
                <h3 className="text-lg font-bold text-rose-600 mb-2">{t('cart_something_wrong')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{momoError}</p>
                <button onClick={() => setMomoFlow('idle')} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">{t('cart_close')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartCheckout;
