
import React, { createContext, useContext, useState, ReactNode, PropsWithChildren, useEffect, useRef, useMemo } from 'react';
import { Product, CartItem, User as UserType, Category, Order, FooterLink, ReviewNotification, SubscriberNotification, Enquiry } from '../types'; // Import Order and FooterLink
import { apiFetch, ApiError } from '../api';
import {
  CategorySection,
  INITIAL_FOOTER_SETTINGS,
  INITIAL_MAINTENANCE_MODE,
} from '../constants'; // Corrected import path
import { playNotificationSound } from '../utils';
import { translate, translateCategory, Language } from '../translations';

interface CategoryWithId {
  id: string;
  name: string;
  sections: { id: string; title: string; items: string[] }[];
}

interface SiteAnnouncement {
  id: string;
  message: string;
  expiresAt: string | null;
  createdAt: string;
}


interface AppContextType {
  cart: CartItem[];
  addToCart: (product: Product & { selectedColor?: string; selectedSize?: string }, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  user: UserType | null; // Currently logged-in user
  token: string | null; // JWT for the currently logged-in user
  login: (email: string, password: string) => Promise<boolean>;
  signup: (fullName: string, email: string, phoneNumber: string, password: string) => Promise<boolean>;
  logout: () => void;
  categories: Category[]; // Dynamic categories
  categoryHierarchy: Record<Category, CategorySection[]>; // Dynamic category hierarchy
  addCategory: (name: string) => Promise<boolean>;
  updateCategoryName: (oldName: string, newName: string) => Promise<boolean>;
  deleteCategory: (name: string) => Promise<boolean>;
  addCategorySection: (categoryName: string, sectionTitle: string, items: string[]) => Promise<boolean>;
  updateCategorySection: (categoryName: string, oldSectionTitle: string, newSection: { title: string, items: string[] }) => Promise<boolean>;
  deleteCategorySection: (categoryName: string, sectionTitle: string) => Promise<boolean>;
  // Product Management
  products: Product[];
  popularProductIds: Set<string>; // Most-reviewed product id within each category, for the "Popular" badge
  refreshProduct: (productId: string) => Promise<void>;
  addProduct: (newProduct: Omit<Product, 'id' | 'rating' | 'reviews'>) => Promise<boolean>;
  updateProduct: (updatedProduct: Product) => Promise<boolean>;
  deleteProduct: (productId: string) => Promise<boolean>;
  // Order Management
  orders: Order[]; // New: orders state
  // Subtotal/shipping/tax/total are computed server-side from items + delivery district; only pass the inputs.
  addOrder: (orderInput: { customerName: string; deliveryAddress: Order['deliveryAddress']; items: CartItem[]; currency?: string; paymentMethod?: string; couponCode?: string }) => Promise<Order | null>;
  updateOrder: (updatedOrder: Order) => Promise<boolean>; // New: updateOrder function
  deleteOrder: (orderId: string) => Promise<boolean>; // New: deleteOrder function
  confirmOrderPayment: (orderId: string) => Promise<boolean>;
  unreadOrderCount: number; // New: count of pending orders
  unreadUserCount: number; // New: count of unread users
  unreadReviewCount: number; // count of unread review notifications
  unreadSubscriberCount: number; // count of unread new-subscriber notifications
  chatAdminUnreadCount: number; // count of unread customer chat messages, across every conversation
  enquiryUnreadCount: number; // count of unread Contact Us submissions (admin sidebar badge)
  unreadNotificationCount: number; // New: count of pending orders + unread users + unread reviews + unread subscribers + unread chat messages
  reviewNotifications: ReviewNotification[]; // recent reviews across all products, for the notification bell
  subscriberNotifications: SubscriberNotification[]; // recent newsletter signups, for the notification bell
  markUserAsRead: (userId: string) => Promise<void>; // New: mark user as read
  markOrderAsRead: (orderId: string) => Promise<void>; // New: mark order as read
  markReviewAsRead: (reviewId: string) => Promise<void>;
  markSubscriberAsRead: (subscriberId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>; // New: mark all notifications as read
  hiddenNotificationIds: string[]; // New: list of hidden/deleted notification IDs
  hideNotification: (id: string) => Promise<void>; // New: hide notification
  bulkHideNotifications: (ids: string[]) => Promise<void>; // New: bulk hide notifications
  // Newsletter ("Join our inner circle") - requires a signed-in account
  isSubscribed: boolean;
  subscribeToNewsletter: () => Promise<boolean>;
  unsubscribeFromNewsletter: () => Promise<boolean>;
  // Site-wide announcement banner
  siteAnnouncements: SiteAnnouncement[];
  // User Management (All Users)
  allUsers: UserType[]; // New: all users state for admin panel
  addUser: (newUser: Omit<UserType, 'id'> & { password?: string }) => Promise<void>;
  updateUser: (updatedUser: Partial<UserType> & { id: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  // Toast Notification System
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info' | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  // Footer Settings
  footerSettings: {
    locationLines: string[];
    phoneNumber: string;
    whatsappNumber: string;
    emailAddress: string;
    quickLinks: FooterLink[];
    supportLinks: FooterLink[];
    copyrightText: string;
  };
  updateFooterLocation: (lines: string[]) => void;
  updateFooterPhoneNumber: (number: string) => void;
  updateFooterWhatsappNumber: (number: string) => void;
  updateFooterEmail: (email: string) => void;
  updateFooterQuickLinks: (links: FooterLink[]) => void;
  updateFooterSupportLinks: (links: FooterLink[]) => void;
  updateFooterCopyrightText: (text: string) => void;
  // Admin Profile Management (for the currently logged-in admin)
  updateCurrentUser: (updatedUser: Partial<UserType>) => Promise<void>;
  deleteCurrentUser: () => void;
  // Maintenance Mode
  isMaintenanceMode: boolean;
  toggleMaintenanceMode: (enable: boolean) => void;
  // Pricing (RWF only)
  getFormattedPrice: (price: number) => string; // Formats a stored RWF amount for display
  // Payment Methods
  paymentMethods: { name: string, enabled: boolean, detail: string }[];
  updatePaymentMethods: (methods: { name: string, enabled: boolean, detail: string }[]) => Promise<boolean>;
  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  // FAQ Modal state
  isFAQOpen: boolean;
  toggleFAQ: () => void;
  // Shipping Policy Modal state
  isShippingPolicyOpen: boolean;
  toggleShippingPolicy: () => void;
  // Terms of Service Modal state
  isTermsOfServiceOpen: boolean;
  toggleTermsOfService: () => void;
  // Privacy Policy Modal state
  isPrivacyPolicyOpen: boolean;
  togglePrivacyPolicy: () => void;
  // Theme Management
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tCategory: (name: string | undefined | null) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

// Explicitly define children prop for React 19 to fix the type error
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Guest cart lives fully client-side (a real snapshot of each product, since there's no account
  // to key server rows off of); an authenticated cart is reconstructed from server-persisted lines
  // once the catalog loads - see the effect below, once `products`/`productsLoaded` exist.
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('kuisoko-cart-guest');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [user, setUser] = useState<UserType | null>(() => {
    const savedUser = localStorage.getItem('kuisoko-user');
    try {
      const parsedUser = savedUser ? JSON.parse(savedUser) : null;
      return parsedUser;
    } catch (e) {
      console.error("Error parsing saved user from localStorage:", e);
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kuisoko-token'));

  // Periodically re-fetches admin notification sources (orders/users/reviews) below,
  // so the bell badge + sound reflect new activity without needing a page reload.
  const [notificationPollTick, setNotificationPollTick] = useState(0);
  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    const interval = setInterval(() => setNotificationPollTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, [token, user?.role]);

  // All users - fetched from the database (admin only)
  const [allUsers, setAllUsers] = useState<UserType[]>([]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setAllUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { users: fetched } = await apiFetch<{ users: UserType[] }>('/users', {}, token);
        if (!cancelled) setAllUsers(fetched);
      } catch (e) {
        console.error('Error fetching users:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role, notificationPollTick]);

  // Dynamic category state - fetched from the database
  const [categoriesData, setCategoriesData] = useState<CategoryWithId[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { categories: fetched } = await apiFetch<{ categories: CategoryWithId[] }>('/categories');
        if (!cancelled) setCategoriesData(fetched);
      } catch (e) {
        console.error('Error fetching categories:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => categoriesData.map(c => c.name), [categoriesData]);
  const categoryHierarchy = useMemo(() => {
    const map: Record<Category, CategorySection[]> = {};
    for (const c of categoriesData) {
      map[c.name] = c.sections.map(({ title, items }) => ({ title, items }));
    }
    return map;
  }, [categoriesData]);

  const findCategoryId = (name: string) => categoriesData.find(c => c.name === name)?.id;

  // Product Management State - fetched from the database
  const [products, setProducts] = useState<Product[]>([]);

  // The most-reviewed product within each category is marked "Popular" - but only if it actually has reviews
  const popularProductIds = useMemo(() => {
    const topByCategory = new Map<string, Product>();
    for (const p of products) {
      if (p.reviews <= 0) continue;
      const current = topByCategory.get(p.category);
      if (!current || p.reviews > current.reviews) {
        topByCategory.set(p.category, p);
      }
    }
    return new Set(Array.from(topByCategory.values()).map(p => p.id));
  }, [products]);

  // Flips once regardless of outcome - the cart-reconstruction effect below waits on this (rather
  // than on `products.length > 0`) so a store with a genuinely empty catalog doesn't block forever.
  const [productsLoaded, setProductsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { products: fetched } = await apiFetch<{ products: Product[] }>('/products');
        if (!cancelled) setProducts(fetched);
      } catch (e) {
        console.error('Error fetching products:', e);
      } finally {
        if (!cancelled) setProductsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  interface ServerCartLine {
    productId: string;
    quantity: number;
    selectedColor: string | null;
    selectedSize: string | null;
    unitPrice: number | null;
  }

  // Cart State - server-persisted per account (same reasoning as the wishlist above): each
  // account only ever sees its own cart, and it now survives logout/login and a page refresh,
  // neither of which it did before (it was previously in-memory-only React state with no
  // persistence of any kind). Reconstructs full CartItem objects by joining each server line's
  // productId/quantity/variant against the already-loaded catalog, the same way wishlist joins
  // its ids - waits on `productsLoaded` so it doesn't run before there's anything to join against.
  useEffect(() => {
    if (!token) {
      const saved = localStorage.getItem('kuisoko-cart-guest');
      try { setCart(saved ? JSON.parse(saved) : []); } catch { setCart([]); }
      return;
    }
    if (!productsLoaded) return;
    setCart([]); // clear immediately so the previous account's (or guest's) items never flash on screen
    let cancelled = false;
    (async () => {
      try {
        const { items } = await apiFetch<{ items: ServerCartLine[] }>('/cart', {}, token);
        if (cancelled) return;
        const reconstructed = items.reduce<CartItem[]>((acc, line) => {
          const product = products.find(p => p.id === line.productId);
          if (!product) return acc; // the product behind this line was deleted since it was added
          acc.push({
            ...product,
            quantity: line.quantity,
            selectedColor: line.selectedColor ?? undefined,
            selectedSize: line.selectedSize ?? undefined,
            price: line.unitPrice ?? product.price,
          });
          return acc;
        }, []);
        setCart(reconstructed);
      } catch (e) {
        console.error('Error fetching cart:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, productsLoaded]);

  useEffect(() => {
    if (token) return; // authenticated: the server is the source of truth, don't touch guest storage
    localStorage.setItem('kuisoko-cart-guest', JSON.stringify(cart));
  }, [cart, token]);

  // Fire-and-forget sync to the server cart for a signed-in user - the UI already updated
  // optimistically via setCart, this just persists it. Errors are logged, not surfaced, since the
  // add/remove/quantity toasts already gave the user their feedback for the action itself.
  const syncCartLine = (productId: string, quantity: number, selectedColor?: string, selectedSize?: string, unitPrice?: number) => {
    if (!token) return;
    apiFetch(`/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity, selectedColor: selectedColor ?? null, selectedSize: selectedSize ?? null, unitPrice: unitPrice ?? null }),
    }, token).catch((e) => console.error('Error syncing cart:', e));
  };

  const deleteCartLine = (productId: string) => {
    if (!token) return;
    apiFetch(`/cart/${productId}`, { method: 'DELETE' }, token).catch((e) => console.error('Error syncing cart:', e));
  };

  // Order Management State - fetched from the database (admin sees all, a user sees their own)
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!token) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { orders: fetched } = await apiFetch<{ orders: Order[] }>('/orders', {}, token);
        if (!cancelled) setOrders(fetched);
      } catch (e) {
        console.error('Error fetching orders:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, notificationPollTick]);

  // Total unread customer chat messages, across every conversation (admin inbox badge).
  const [chatAdminUnreadCount, setChatAdminUnreadCount] = useState(0);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setChatAdminUnreadCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { count } = await apiFetch<{ count: number }>('/chat/admin-unread-count', {}, token);
        if (!cancelled) setChatAdminUnreadCount(count);
      } catch (e) {
        console.error('Error fetching chat unread count:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role, notificationPollTick]);

  // Total unread Contact Us submissions (admin sidebar badge).
  const [enquiryUnreadCount, setEnquiryUnreadCount] = useState(0);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setEnquiryUnreadCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { count } = await apiFetch<{ count: number }>('/enquiries/unread-count', {}, token);
        if (!cancelled) setEnquiryUnreadCount(count);
      } catch (e) {
        console.error('Error fetching enquiry unread count:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role, notificationPollTick]);

  const [hiddenNotificationIds, setHiddenNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setHiddenNotificationIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { ids } = await apiFetch<{ ids: string[] }>('/notifications/dismissed', {}, token);
        if (!cancelled) setHiddenNotificationIds(ids);
      } catch (e) {
        console.error('Error fetching dismissed notifications:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role]);

  const hideNotification = async (id: string) => {
    try {
      await apiFetch('/notifications/dismissed', { method: 'POST', body: JSON.stringify({ ids: [id] }) }, token);
      setHiddenNotificationIds(prev => [...prev, id]);
      showToast('Notification deleted.', 'info');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete notification.', 'error');
    }
  };

  const bulkHideNotifications = async (ids: string[]) => {
    try {
      await apiFetch('/notifications/dismissed', { method: 'POST', body: JSON.stringify({ ids }) }, token);
      setHiddenNotificationIds(prev => [...prev, ...ids]);
      showToast('Notifications deleted.', 'info');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete notifications.', 'error');
    }
  };

  // Footer Settings State
  // Footer/contact info ("Contact & Storefront" in admin settings) is site-wide, server-persisted
  // config - every visitor should see the same thing. It used to live only in whichever admin
  // browser last edited it (a localStorage key, never sent to the backend), so a change never
  // reached the database and no one else ever saw it. INITIAL_FOOTER_SETTINGS is just the paint
  // shown before the real fetch below resolves.
  const [footerSettings, setFooterSettings] = useState<AppContextType['footerSettings']>(INITIAL_FOOTER_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await apiFetch<AppContextType['footerSettings']>('/settings/footer');
        if (!cancelled) setFooterSettings(prev => ({ ...prev, ...fetched }));
      } catch (e) {
        console.error('Error fetching footer settings:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Maintenance Mode State
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => {
    const savedMaintenanceMode = localStorage.getItem('kuisoko-maintenance-mode');
    try {
      return savedMaintenanceMode ? JSON.parse(savedMaintenanceMode) : INITIAL_MAINTENANCE_MODE;
    } catch (e) {
      console.error("Error parsing saved maintenance mode from localStorage:", e);
      return INITIAL_MAINTENANCE_MODE;
    }
  });


  // Payment Methods State - fetched from the database
  const [paymentMethods, setPaymentMethods] = useState<{ name: string, enabled: boolean, detail: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { paymentMethods: fetched } = await apiFetch<{ paymentMethods: { name: string, enabled: boolean, detail: string }[] }>('/settings/payment-methods');
        if (!cancelled) setPaymentMethods(fetched);
      } catch (e) {
        console.error('Error fetching payment methods:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updatePaymentMethods = async (methods: { name: string, enabled: boolean, detail: string }[]): Promise<boolean> => {
    try {
      const { paymentMethods: saved } = await apiFetch<{ paymentMethods: { name: string, enabled: boolean, detail: string }[] }>('/settings/payment-methods', {
        method: 'PUT',
        body: JSON.stringify({ methods }),
      }, token);
      setPaymentMethods(saved);
      showToast('Payment methods updated.', 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update payment methods.', 'error');
      return false;
    }
  };

  // Wishlist State - server-persisted per account, so switching who's logged in on this device
  // never shows one account's wishlist to another, and it survives logout/login. Signed-out
  // browsing still works via a separate guest-only localStorage bucket that's never touched
  // while a token is present, so a real account's data can never leak into (or out of) it.
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('kuisoko-wishlist-guest');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  useEffect(() => {
    if (!token) {
      const saved = localStorage.getItem('kuisoko-wishlist-guest');
      try { setWishlist(saved ? JSON.parse(saved) : []); } catch { setWishlist([]); }
      return;
    }
    setWishlist([]); // clear immediately so the previous account's (or guest's) items never flash on screen
    let cancelled = false;
    (async () => {
      try {
        const { productIds } = await apiFetch<{ productIds: string[] }>('/wishlist', {}, token);
        if (!cancelled) setWishlist(productIds);
      } catch (e) {
        console.error('Error fetching wishlist:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (token) return; // authenticated: the server is the source of truth, don't touch guest storage
    localStorage.setItem('kuisoko-wishlist-guest', JSON.stringify(wishlist));
  }, [wishlist, token]);

  const toggleWishlist = async (productId: string) => {
    const isRemoving = wishlist.includes(productId);
    setWishlist(prev => (isRemoving ? prev.filter(id => id !== productId) : [...prev, productId]));
    showToast(isRemoving ? 'Removed from wishlist.' : 'Added to wishlist.', isRemoving ? 'info' : 'success');
    if (!token) return;
    try {
      await apiFetch(`/wishlist/${productId}`, { method: isRemoving ? 'DELETE' : 'POST' }, token);
    } catch (e) {
      // Roll back the optimistic update so local state doesn't drift from what's actually saved.
      setWishlist(prev => (isRemoving ? [...prev, productId] : prev.filter(id => id !== productId)));
      showToast('Could not update wishlist - please try again.', 'error');
    }
  };

  // FAQ Modal State
  const [isFAQOpen, setIsFAQOpen] = useState(false);
  const toggleFAQ = () => setIsFAQOpen(prev => !prev);

  // Shipping Policy Modal State
  const [isShippingPolicyOpen, setIsShippingPolicyOpen] = useState(false);
  const toggleShippingPolicy = () => setIsShippingPolicyOpen(prev => !prev);

  // Terms of Service Modal State
  const [isTermsOfServiceOpen, setIsTermsOfServiceOpen] = useState(false);
  const toggleTermsOfService = () => setIsTermsOfServiceOpen(prev => !prev);

  // Privacy Policy Modal State
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const togglePrivacyPolicy = () => setIsPrivacyPolicyOpen(prev => !prev);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('kuisoko-theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    localStorage.setItem('kuisoko-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Language State (storefront only - EN/KIN)
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('kuisoko-language') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kuisoko-language', lang);
  };

  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const tCategory = (name: string | undefined | null) => translateCategory(language, name);


  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    // Clear any existing timeout to prevent multiple toasts from overlapping
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setToastType(type);
    toastTimeoutRef.current = window.setTimeout(() => {
      hideToast();
    }, 4000); // Auto-hide after 4 seconds
  };

  const hideToast = () => {
    setToastMessage(null);
    setToastType(null);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  };



  // Review notifications (admin only) - shared by the bell badge count and the notification panel
  const [reviewNotifications, setReviewNotifications] = useState<ReviewNotification[]>([]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setReviewNotifications([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { reviews } = await apiFetch<{ reviews: ReviewNotification[] }>('/reviews', {}, token);
        if (!cancelled) setReviewNotifications(reviews);
      } catch (e) {
        console.error('Error fetching review notifications:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role, notificationPollTick]);

  const markReviewAsRead = async (reviewId: string) => {
    setReviewNotifications(prev => prev.map(r => (r.id === reviewId ? { ...r, unread: false } : r)));
    try {
      await apiFetch(`/reviews/${reviewId}/read`, { method: 'PATCH' }, token);
    } catch (e) {
      console.error('Error marking review as read:', e);
    }
  };

  // Newsletter subscriber notifications (admin only) - shared by the bell badge count and the notification panel
  const [subscriberNotifications, setSubscriberNotifications] = useState<SubscriberNotification[]>([]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setSubscriberNotifications([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { subscribers } = await apiFetch<{ subscribers: SubscriberNotification[] }>('/newsletter', {}, token);
        if (!cancelled) setSubscriberNotifications(subscribers);
      } catch (e) {
        console.error('Error fetching subscriber notifications:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.role, notificationPollTick]);

  const markSubscriberAsRead = async (subscriberId: string) => {
    setSubscriberNotifications(prev => prev.map(s => (s.id === subscriberId ? { ...s, unread: false } : s)));
    try {
      await apiFetch(`/newsletter/${subscriberId}/read`, { method: 'PATCH' }, token);
    } catch (e) {
      console.error('Error marking subscriber notification as read:', e);
    }
  };

  // Newsletter subscription state for the currently signed-in user
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsSubscribed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { subscribed } = await apiFetch<{ subscribed: boolean }>('/newsletter/status', {}, token);
        if (!cancelled) setIsSubscribed(subscribed);
      } catch (e) {
        console.error('Error fetching newsletter subscription status:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const subscribeToNewsletter = async (): Promise<boolean> => {
    if (!token) {
      showToast('Please sign in to subscribe.', 'error');
      return false;
    }
    try {
      await apiFetch('/newsletter/subscribe', { method: 'POST' }, token);
      setIsSubscribed(true);
      showToast('You joined the inner circle!', 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not subscribe.', 'error');
      return false;
    }
  };

  const unsubscribeFromNewsletter = async (): Promise<boolean> => {
    if (!token || !user) {
      showToast('Please sign in to unsubscribe.', 'error');
      return false;
    }
    try {
      await apiFetch('/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ email: user.email }) });
      setIsSubscribed(false);
      showToast('You have been unsubscribed.', 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not unsubscribe.', 'error');
      return false;
    }
  };

  // Site-wide announcement banners (public - shown above the navbar); at least 3 can be live at once
  const [siteAnnouncements, setSiteAnnouncements] = useState<SiteAnnouncement[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { banners } = await apiFetch<{ banners: SiteAnnouncement[] }>('/announcements/banners');
        if (!cancelled) setSiteAnnouncements(banners);
      } catch (e) {
        console.error('Error fetching site announcements:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const unreadOrderCount = useMemo(() => orders.filter(o => o.status === 'Pending').length, [orders]);
  const unreadUserCount = useMemo(() => allUsers.filter(u => u.unread).length, [allUsers]);
  const unreadReviewCount = useMemo(() => reviewNotifications.filter(r => r.unread).length, [reviewNotifications]);
  const unreadSubscriberCount = useMemo(() => subscriberNotifications.filter(s => s.unread).length, [subscriberNotifications]);
  const unreadNotificationCount = unreadOrderCount + unreadUserCount + unreadReviewCount + unreadSubscriberCount + chatAdminUnreadCount;

  // Plays a chime whenever the unread count goes up (new order/user/review) - not on initial load or on decreases.
  const prevUnreadNotificationCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnreadNotificationCountRef.current !== null && unreadNotificationCount > prevUnreadNotificationCountRef.current) {
      playNotificationSound();
    }
    prevUnreadNotificationCountRef.current = unreadNotificationCount;
  }, [unreadNotificationCount]);

  // Save user to localStorage whenever it changes (currently logged-in user)
  useEffect(() => {
    if (user) {
      localStorage.setItem('kuisoko-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('kuisoko-user');
    }
  }, [user]);

  // Save auth token to localStorage whenever it changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('kuisoko-token', token);
    } else {
      localStorage.removeItem('kuisoko-token');
    }
  }, [token]);


  // Save maintenance mode to localStorage
  useEffect(() => {
    localStorage.setItem('kuisoko-maintenance-mode', JSON.stringify(isMaintenanceMode));
  }, [isMaintenanceMode]);



  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { user: loggedInUser, token: authToken } = await apiFetch<{ user: UserType; token: string }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) }
      );
      setUser(loggedInUser);
      setToken(authToken);
      showToast(`Welcome, ${loggedInUser.name.split(' ')[0]}!`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Invalid email or password.', 'error');
      return false;
    }
  };

  const signup = async (fullName: string, email: string, phoneNumber: string, password: string): Promise<boolean> => {
    try {
      const { user: newUser, token: authToken } = await apiFetch<{ user: UserType; token: string }>(
        '/auth/signup',
        { method: 'POST', body: JSON.stringify({ fullName, email, phoneNumber, password }) }
      );
      setUser(newUser);
      setToken(authToken);
      showToast(`Welcome, ${newUser.name.split(' ')[0]}!`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not create account.', 'error');
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    showToast('You have been logged out.', 'info');
  };

  const addToCart = (product: Product & { selectedColor?: string; selectedSize?: string }, quantity: number = 1) => {
    if (product.stock <= 0) {
      showToast(`${product.name} is out of stock.`, 'error');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const currentQty = existing?.quantity ?? 0;
      const newQty = Math.min(currentQty + quantity, product.stock);

      if (newQty === currentQty) {
        showToast(`Only ${product.stock} of ${product.name} in stock - you already have the max in your cart.`, 'error');
        return prev;
      }
      if (newQty < currentQty + quantity) {
        showToast(`Only ${product.stock} of ${product.name} in stock - added what's available.`, 'info');
      } else {
        showToast(`${quantity} x ${product.name} added to cart.`, 'success');
      }

      syncCartLine(product.id, newQty, product.selectedColor, product.selectedSize, product.price);

      if (existing) {
        return prev.map(item => (item.id === product.id ? { ...item, quantity: newQty } : item));
      }
      return [...prev, { ...product, quantity: newQty }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const removedItem = prev.find(item => item.id === productId);
      if (removedItem) {
        showToast(`${removedItem.name} removed from cart.`, 'info');
        deleteCartLine(productId);
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, Math.min(item.quantity + delta, item.stock));
        if (newQty !== item.quantity) {
          showToast(`${item.name} quantity updated to ${newQty}.`, 'info');
          syncCartLine(productId, newQty, item.selectedColor, item.selectedSize, item.price);
        } else if (delta > 0) {
          showToast(`Only ${item.stock} of ${item.name} in stock.`, 'error');
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    showToast('Cart cleared.', 'info');
    if (token) {
      apiFetch('/cart', { method: 'DELETE' }, token).catch((e) => console.error('Error syncing cart:', e));
    }
  };

  // Category Management Functions
  const addCategory = async (name: string): Promise<boolean> => {
    try {
      const { category } = await apiFetch<{ category: { id: string; name: string } }>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }, token);
      setCategoriesData(prev => [...prev, { ...category, sections: [] }]);
      showToast(`Category "${category.name}" added.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : `Could not add category "${name}".`, 'error');
      return false;
    }
  };

  const updateCategoryName = async (oldName: string, newName: string): Promise<boolean> => {
    const id = findCategoryId(oldName);
    if (!id) {
      showToast(`Category "${oldName}" not found.`, 'error');
      return false;
    }
    try {
      const { category } = await apiFetch<{ category: { id: string; name: string } }>(`/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      }, token);
      setCategoriesData(prev => prev.map(c => (c.id === id ? { ...c, name: category.name } : c)));
      showToast(`Category renamed from "${oldName}" to "${newName}".`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not rename category.', 'error');
      return false;
    }
  };

  const deleteCategory = async (name: string): Promise<boolean> => {
    const id = findCategoryId(name);
    if (!id) {
      showToast(`Category "${name}" not found.`, 'error');
      return false;
    }
    try {
      await apiFetch(`/categories/${id}`, { method: 'DELETE' }, token);
      setCategoriesData(prev => prev.filter(c => c.id !== id));
      showToast(`Category "${name}" deleted.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete category.', 'error');
      return false;
    }
  };

  const addCategorySection = async (categoryName: string, sectionTitle: string, items: string[]): Promise<boolean> => {
    const id = findCategoryId(categoryName);
    if (!id) {
      showToast(`Category "${categoryName}" not found.`, 'error');
      return false;
    }
    try {
      const { section } = await apiFetch<{ section: { id: string; title: string; items: string[] } }>(`/categories/${id}/sections`, {
        method: 'POST',
        body: JSON.stringify({ title: sectionTitle, items }),
      }, token);
      setCategoriesData(prev => prev.map(c => (c.id === id ? { ...c, sections: [...c.sections, section] } : c)));
      showToast(`Section "${sectionTitle}" added to "${categoryName}".`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not add section.', 'error');
      return false;
    }
  };

  const updateCategorySection = async (categoryName: string, oldSectionTitle: string, newSection: CategorySection): Promise<boolean> => {
    const category = categoriesData.find(c => c.name === categoryName);
    const sectionId = category?.sections.find(s => s.title === oldSectionTitle)?.id;
    if (!category || !sectionId) {
      showToast(`Category "${categoryName}" not found.`, 'error');
      return false;
    }
    try {
      const { section } = await apiFetch<{ section: { id: string; title: string; items: string[] } }>(`/categories/${category.id}/sections/${sectionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newSection.title, items: newSection.items }),
      }, token);
      setCategoriesData(prev => prev.map(c => (c.id === category.id ? { ...c, sections: c.sections.map(s => (s.id === sectionId ? section : s)) } : c)));
      showToast(`Section "${oldSectionTitle}" updated in "${categoryName}".`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update section.', 'error');
      return false;
    }
  };

  const deleteCategorySection = async (categoryName: string, sectionTitle: string): Promise<boolean> => {
    const category = categoriesData.find(c => c.name === categoryName);
    const sectionId = category?.sections.find(s => s.title === sectionTitle)?.id;
    if (!category || !sectionId) {
      showToast(`Category "${categoryName}" not found.`, 'error');
      return false;
    }
    try {
      await apiFetch(`/categories/${category.id}/sections/${sectionId}`, { method: 'DELETE' }, token);
      setCategoriesData(prev => prev.map(c => (c.id === category.id ? { ...c, sections: c.sections.filter(s => s.id !== sectionId) } : c)));
      showToast(`Section "${sectionTitle}" deleted from "${categoryName}".`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete section.', 'error');
      return false;
    }
  };

  // Product Management Functions
  const refreshProduct = async (productId: string) => {
    try {
      const { product } = await apiFetch<{ product: Product }>(`/products/${productId}`);
      setProducts(prev => prev.map(p => (p.id === productId ? product : p)));
    } catch (e) {
      console.error('Error refreshing product:', e);
    }
  };

  const addProduct = async (newProduct: Omit<Product, 'id' | 'rating' | 'reviews'>): Promise<boolean> => {
    try {
      const { product } = await apiFetch<{ product: Product }>('/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      }, token);
      setProducts(prev => [...prev, product]);
      showToast(`Product "${product.name}" added.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : `Could not add product "${newProduct.name}".`, 'error');
      return false;
    }
  };

  const updateProduct = async (updatedProduct: Product): Promise<boolean> => {
    try {
      const { product } = await apiFetch<{ product: Product }>(`/products/${updatedProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updatedProduct),
      }, token);
      setProducts(prev => prev.map(p => (p.id === product.id ? product : p)));
      showToast(`Product "${product.name}" updated.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update product.', 'error');
      return false;
    }
  };

  const deleteProduct = async (productId: string): Promise<boolean> => {
    const deletedProduct = products.find(p => p.id === productId);
    try {
      await apiFetch(`/products/${productId}`, { method: 'DELETE' }, token);
      setProducts(prev => prev.filter(p => p.id !== productId));
      if (deletedProduct) showToast(`Product "${deletedProduct.name}" deleted.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete product.', 'error');
      return false;
    }
  };

  // Order Management Functions
  const addOrder = async (orderInput: { customerName: string; deliveryAddress: Order['deliveryAddress']; items: CartItem[]; currency?: string; paymentMethod?: string; couponCode?: string }): Promise<Order | null> => {
    try {
      const { order } = await apiFetch<{ order: Order }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: orderInput.customerName,
          deliveryAddress: orderInput.deliveryAddress,
          currency: orderInput.currency,
          paymentMethod: orderInput.paymentMethod,
          couponCode: orderInput.couponCode,
          items: orderInput.items.map((item) => ({
            productId: item.id,
            name: item.name,
            image: item.images?.[0],
            price: item.price * (1 - (item.discount || 0) / 100), // effective per-unit price paid
            quantity: item.quantity,
            selectedColor: (item as any).selectedColor,
            selectedSize: (item as any).selectedSize,
          })),
        }),
      }, token);
      setOrders(prev => [...prev, order]);
      showToast(`Order #${order.orderNumber || order.id} placed successfully.`, 'success');
      return order;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not place order.', 'error');
      return null;
    }
  };

  const updateOrder = async (updatedOrder: Order): Promise<boolean> => {
    try {
      const { order } = await apiFetch<{ order: Order }>(`/orders/${updatedOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: updatedOrder.status }),
      }, token);
      setOrders(prev => prev.map((o) => (o.id === order.id ? order : o)));
      showToast(`Order #${order.orderNumber || order.id} status updated to ${order.status}.`, 'info');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update order.', 'error');
      return false;
    }
  };

  const confirmOrderPayment = async (orderId: string): Promise<boolean> => {
    try {
      const { order } = await apiFetch<{ order: Order }>(`/orders/${orderId}/confirm-payment`, { method: 'PATCH' }, token);
      setOrders(prev => prev.map((o) => (o.id === order.id ? order : o)));
      showToast(`Payment confirmed for order #${order.orderNumber || order.id}.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not confirm payment.', 'error');
      return false;
    }
  };

  const deleteOrder = async (orderId: string): Promise<boolean> => {
    const deletedOrder = orders.find((order) => order.id === orderId);
    try {
      await apiFetch(`/orders/${orderId}`, { method: 'DELETE' }, token);
      setOrders(prev => prev.filter((order) => order.id !== orderId));
      if (deletedOrder) showToast(`Order #${deletedOrder.orderNumber || deletedOrder.id} deleted.`, 'success');
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete order.', 'error');
      return false;
    }
  };

  // New: User Management Functions
  const addUser = async (newUser: Omit<UserType, 'id'> & { password?: string }) => {
    try {
      const { user: created } = await apiFetch<{ user: UserType }>('/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      }, token);
      setAllUsers(prev => [...prev, created]);
      showToast(`User "${created.name}" added.`, 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : `Could not add user "${newUser.name}".`, 'error');
    }
  };

  const updateUser = async (updatedUser: Partial<UserType> & { id: string }) => {
    try {
      const { user: updated } = await apiFetch<{ user: UserType }>(`/users/${updatedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updatedUser),
      }, token);
      setAllUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      // If the currently logged-in user is updated, also update the 'user' state
      if (user && user.id === updated.id) {
        setUser(prev => prev ? { ...prev, ...updated } : null);
      }
      showToast(`User "${updated.name}" updated.`, 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update user.', 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    const deletedUser = allUsers.find(u => u.id === userId);
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' }, token);
      setAllUsers(prev => prev.filter(u => u.id !== userId));
      if (deletedUser) showToast(`User "${deletedUser.name}" deleted.`, 'success');
      // If the logged-in user deletes themselves, log them out
      if (user && user.id === userId) {
        logout();
      }
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete user.', 'error');
    }
  };

  const markUserAsRead = async (userId: string) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, unread: false } : u));
    try {
      await apiFetch(`/users/${userId}/read`, { method: 'PATCH' }, token);
    } catch (e) {
      console.error('Error marking user as read:', e);
    }
  };

  const markOrderAsRead = async (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, unread: false } : o));
    try {
      await apiFetch(`/orders/${orderId}/read`, { method: 'PATCH' }, token);
    } catch (e) {
      console.error('Error marking order as read:', e);
    }
  };

  const markAllNotificationsAsRead = async () => {
    setAllUsers(prev => prev.map(u => ({ ...u, unread: false })));
    setOrders(prev => prev.map(o => ({ ...o, unread: false })));
    setReviewNotifications(prev => prev.map(r => ({ ...r, unread: false })));
    setSubscriberNotifications(prev => prev.map(s => ({ ...s, unread: false })));
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' }, token); // also clears reviews server-side
      showToast('All notifications marked as read.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not mark notifications as read.', 'error');
    }
  };

  // Footer Settings Functions - each patches the server (this is site-wide config every visitor
  // sees, not per-user state) and rolls back the optimistic local update if the save fails, so the
  // UI never shows a value that isn't actually persisted.
  const patchFooterSettings = async (patch: Partial<AppContextType['footerSettings']>, successMessage: string) => {
    const previous = footerSettings;
    setFooterSettings(prev => ({ ...prev, ...patch }));
    try {
      await apiFetch('/settings/footer', { method: 'PATCH', body: JSON.stringify(patch) }, token);
      showToast(successMessage, 'success');
    } catch (e) {
      setFooterSettings(previous);
      showToast(e instanceof ApiError ? e.message : 'Could not save footer settings.', 'error');
    }
  };

  const updateFooterLocation = (lines: string[]) => {
    patchFooterSettings({ locationLines: lines }, 'Footer location updated.');
  };

  const updateFooterPhoneNumber = (number: string) => {
    patchFooterSettings({ phoneNumber: number }, 'Footer phone number updated.');
  };

  const updateFooterWhatsappNumber = (number: string) => {
    patchFooterSettings({ whatsappNumber: number }, 'Footer WhatsApp number updated.');
  };

  const updateFooterEmail = (email: string) => {
    patchFooterSettings({ emailAddress: email }, 'Footer email updated.');
  };

  const updateFooterQuickLinks = (links: FooterLink[]) => {
    patchFooterSettings({ quickLinks: links }, 'Footer quick links updated.');
  };

  const updateFooterSupportLinks = (links: FooterLink[]) => {
    patchFooterSettings({ supportLinks: links }, 'Footer support links updated.');
  };

  const updateFooterCopyrightText = (text: string) => {
    patchFooterSettings({ copyrightText: text }, 'Footer copyright text updated.');
  };

  // Admin Profile Management Functions (for the currently logged-in admin)
  const updateCurrentUser = async (updatedUser: Partial<UserType>) => {
    if (!user) {
      showToast('No user logged in to update.', 'error');
      return;
    }
    try {
      const { user: updated } = await apiFetch<{ user: UserType }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(updatedUser),
      }, token);
      setUser(updated);
      setAllUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      showToast('Profile updated.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update profile.', 'error');
    }
  };

  const deleteCurrentUser = () => {
    if (user && user.role === 'admin') {
      deleteUser(user.id); // Use the general deleteUser function
      // logout() is called inside deleteUser if the current user deletes themselves
      showToast('Admin account deleted.', 'info');
    } else {
      showToast('Cannot delete non-admin user.', 'error');
    }
  };

  // Maintenance Mode Functions
  const toggleMaintenanceMode = (enable: boolean) => {
    setIsMaintenanceMode(enable);
    showToast(
      enable ? 'Website maintenance enabled.' : 'Website maintenance disabled.',
      enable ? 'error' : 'success'
    );
  };

  // The store deals exclusively in RWF - prices are stored and displayed in RWF, no conversion.
  const getFormattedPrice = (price: number): string => {
    return `Rwf ${Math.round(price).toLocaleString()}`;
  };


  return (
    <AppContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity, clearCart, user, token, login, signup, logout,
      categories, categoryHierarchy,
      addCategory, updateCategoryName, deleteCategory,
      addCategorySection, updateCategorySection, deleteCategorySection,
      products, popularProductIds, refreshProduct, addProduct, updateProduct, deleteProduct,
      orders, addOrder, updateOrder, deleteOrder, confirmOrderPayment, unreadNotificationCount, unreadOrderCount, unreadUserCount, unreadReviewCount, unreadSubscriberCount, chatAdminUnreadCount, enquiryUnreadCount, reviewNotifications, subscriberNotifications, markUserAsRead, markOrderAsRead, markReviewAsRead, markSubscriberAsRead, markAllNotificationsAsRead,
      hiddenNotificationIds, hideNotification, bulkHideNotifications,
      isSubscribed, subscribeToNewsletter, unsubscribeFromNewsletter, siteAnnouncements,
      allUsers, addUser, updateUser, deleteUser, // New: User management functions
      toastMessage, toastType, showToast, hideToast,
      footerSettings,
      updateFooterLocation, updateFooterPhoneNumber, updateFooterWhatsappNumber, updateFooterEmail,
      updateFooterQuickLinks, updateFooterSupportLinks, updateFooterCopyrightText,
      updateCurrentUser, deleteCurrentUser,
      isMaintenanceMode, toggleMaintenanceMode,
      getFormattedPrice,
      theme, toggleTheme,
      language, setLanguage, t, tCategory,
      paymentMethods, updatePaymentMethods,
      wishlist, toggleWishlist,
      isFAQOpen, toggleFAQ,
      isShippingPolicyOpen, toggleShippingPolicy,
      isTermsOfServiceOpen, toggleTermsOfService,
      isPrivacyPolicyOpen, togglePrivacyPolicy,
    }}>
      {children}
    </AppContext.Provider>
  );
};