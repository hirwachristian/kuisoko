


import React, { Suspense, lazy } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Navbar from './Navbar';
import Footer from './Footer';
import Home from '../pages/Home';
import AboutUs from '../pages/AboutUs';
import ContactUs from '../pages/ContactUs';
import ProductListing from '../pages/ProductListing';
import ProductDetail from '../pages/ProductDetail';
import CartCheckout from '../pages/CartCheckout';
import Wishlist from '../pages/Wishlist';
import SignIn from '../pages/SignIn';
import SignUp from '../pages/SignUp';
import Maintenance from '../pages/Maintenance'; // New: Import Maintenance page

// Everything below is only ever needed after a login, a password-reset link, or a visit to
// /admin - splitting it into its own chunks keeps the first page a regular shopper loads (Home,
// the shop, a product) from paying for admin-only code (recharts, all the admin CRUD screens).
const UserDashboard = lazy(() => import('../pages/UserDashboard').then(m => ({ default: m.UserDashboard })));
const AdminDashboardContent = lazy(() => import('./AdminDashboardContent').then(m => ({ default: m.AdminDashboardContent })));
const AdminManageProducts = lazy(() => import('../pages/AdminManageProducts'));
const AdminManageCategories = lazy(() => import('../pages/AdminManageCategories'));
const AdminManageOrders = lazy(() => import('../pages/AdminManageOrders'));
const AdminMessages = lazy(() => import('../pages/AdminMessages'));
const AdminEnquiries = lazy(() => import('../pages/AdminEnquiries'));
const AdminManageReturns = lazy(() => import('../pages/AdminManageReturns'));
const AdminManageCoupons = lazy(() => import('../pages/AdminManageCoupons'));
const AdminManageUsers = lazy(() => import('../pages/AdminManageUsers'));
const AdminAccountAndSecurity = lazy(() => import('../pages/AdminAccountAndSecurity'));
const AdminStoreConfiguration = lazy(() => import('../pages/AdminStoreConfiguration'));
const AdminBusinessAndNotifications = lazy(() => import('../pages/AdminBusinessAndNotifications'));
const AdminSettingsLayout = lazy(() => import('../pages/AdminSettingsLayout'));
const AdminLayout = lazy(() => import('./AdminLayout'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const ConfirmEmailChange = lazy(() => import('../pages/ConfirmEmailChange'));
const Unsubscribe = lazy(() => import('../pages/Unsubscribe'));
const RiderDashboard = lazy(() => import('../pages/RiderDashboard'));
const GroupOrderPage = lazy(() => import('../pages/GroupOrderPage'));
import FAQModal from './FAQModal'; // New: Import FAQModal
import ShippingPolicyModal from './ShippingPolicyModal'; // New: Import ShippingPolicyModal
import TermsOfServiceModal from './TermsOfServiceModal'; // New: Import TermsOfServiceModal
import PrivacyPolicyModal from './PrivacyPolicyModal'; // New: Import PrivacyPolicyModal
import ToastNotification from './ToastNotification'; // Import ToastNotification
import ChatWidget from './ChatWidget';
import { useAppContext } from '../context/AppContext'; // Import useAppContext

const RouteLoadingFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center py-24">
    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
  </div>
);

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { user, isMaintenanceMode, toastMessage, toastType, hideToast } = useAppContext(); // Get isMaintenanceMode from context
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname === '/dashboard' || location.pathname === '/rider';
  const isSignInOrSignUp = location.pathname === '/signin' || location.pathname === '/signup';
  const isAdmin = user?.role === 'admin';
  // Own-account email links an admin might still need to click even though every other public
  // page is off-limits to them below (forgot/reset password, confirming an email change, or
  // unsubscribing themselves from marketing mail).
  const ADMIN_ALLOWED_PUBLIC_PATHS = ['/forgot-password', '/reset-password', '/confirm-email-change', '/unsubscribe'];
  const isAdminAllowedPublicPath = ADMIN_ALLOWED_PUBLIC_PATHS.includes(location.pathname);

  React.useEffect(() => {
    // Navbar sets this when it navigates to Home specifically to smooth-scroll to a section
    // (About/Contact clicked from another page) - this effect is a sibling of Navbar's own
    // effects and runs after them, so without this check its instant reset would snap the page
    // back to the top mid-animation, right after Navbar had just started scrolling it to the
    // section, fighting over the final resting position.
    if ((location.state as { skipScrollReset?: boolean } | null)?.skipScrollReset) return;
    // Instant, not smooth: animating this at the same moment the page content swaps underneath
    // it (old page's height disappearing mid-transition) is what caused the visible "jump".
    // Same-page section scrolling (About/Contact from Home) uses its own smooth scrollIntoView
    // and isn't affected by this.
    window.scrollTo(0, 0);
  }, [location.pathname, location.state]);

  // If maintenance mode is on AND user is NOT admin AND current route is NOT an admin route,
  // AND not on sign-in/sign-up (which should typically be accessible to new users to register, or admins to log in)
  // then redirect to maintenance page.
  // Admins can always access all pages.
  if (isMaintenanceMode && (!user || user.role !== 'admin') && !isAdminRoute && !isSignInOrSignUp) {
    // Render Maintenance page directly
    return (
      <>
        <Maintenance />
        {toastMessage && toastType && (
          <ToastNotification message={toastMessage} type={toastType} onClose={hideToast} />
        )}
      </>
    );
  }

  // Admins are confined to their dashboard - no browsing the public storefront from an admin
  // session. Bounced straight to /admin instead of the page they tried to reach.
  if (isAdmin && !isAdminRoute && !isAdminAllowedPublicPath) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdminRoute && !isDashboardRoute && <Navbar />}
      {/* Admin routes use AdminLayout with nested children */}
      <AnimatePresence mode="wait">
        <motion.div
          className="flex flex-col flex-1 w-full"
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes location={location}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardContent />} /> {/* Default child for /admin */}
              <Route path="users" element={<AdminManageUsers />} /> {/* New Users route */}
              <Route path="products" element={<AdminManageProducts />} />
              <Route path="categories" element={<AdminManageCategories />} /> {/* New Categories route */}
              <Route path="orders" element={<AdminManageOrders />} /> {/* New: Orders route */}
              <Route path="messages" element={<AdminMessages />} />
              <Route path="enquiries" element={<AdminEnquiries />} />
              <Route path="returns" element={<AdminManageReturns />} />
              <Route path="coupons" element={<AdminManageCoupons />} />
              <Route path="settings" element={<AdminSettingsLayout />}> {/* Admin Settings Layout */}
                <Route index element={<Navigate to="account-security" replace />} /> {/* Default to account-security */}
                <Route path="account-security" element={<AdminAccountAndSecurity />} />
                <Route path="store-configuration" element={<AdminStoreConfiguration />} />
                <Route path="business-notifications" element={<AdminBusinessAndNotifications />} />
              </Route>
            </Route>
            {/* Public/User routes */}
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/shop" element={<ProductListing />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<CartCheckout />} />
            <Route path="/group/:code" element={<GroupOrderPage />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/rider" element={<RiderDashboard />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
            <Route path="/maintenance" element={<Maintenance />} /> {/* Explicit route for Maintenance page */}
            <Route path="/unsubscribe" element={<Unsubscribe />} />
          </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      {!isAdminRoute && !isDashboardRoute && <Footer />}
      {!isAdminRoute && <ChatWidget />}
      <FAQModal />
      <ShippingPolicyModal />
      <TermsOfServiceModal />
      <PrivacyPolicyModal />

      {/* Global Toast Notification */}
      {toastMessage && toastType && (
        <ToastNotification message={toastMessage} type={toastType} onClose={hideToast} />
      )}
    </div>
  );
};

export default MainLayout;