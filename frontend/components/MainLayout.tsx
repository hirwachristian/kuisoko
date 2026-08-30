


import React from 'react';
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
import { UserDashboard } from '../pages/UserDashboard';
// Fix: Changed from default import to named import for AdminDashboardContent
import { AdminDashboardContent } from './AdminDashboardContent'; // Import AdminDashboardContent
import AdminManageProducts from '../pages/AdminManageProducts';
import AdminManageCategories from '../pages/AdminManageCategories'; // Import new AdminManageCategories
import AdminManageOrders from '../pages/AdminManageOrders'; // New: Import AdminManageOrders
import AdminMessages from '../pages/AdminMessages';
import AdminEnquiries from '../pages/AdminEnquiries';
import AdminManageCoupons from '../pages/AdminManageCoupons';
import AdminManageUsers from '../pages/AdminManageUsers'; // New: Import AdminManageUsers
import AdminAccountAndSecurity from '../pages/AdminAccountAndSecurity'; // New: Consolidated
import AdminStoreConfiguration from '../pages/AdminStoreConfiguration'; // New: Consolidated
import AdminBusinessAndNotifications from '../pages/AdminBusinessAndNotifications'; // New: Consolidated
import AdminSettingsLayout from '../pages/AdminSettingsLayout'; // New: Import AdminSettingsLayout
import SignIn from '../pages/SignIn';
import SignUp from '../pages/SignUp';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import ConfirmEmailChange from '../pages/ConfirmEmailChange';
import AdminLayout from './AdminLayout'; // Import AdminLayout
import Maintenance from '../pages/Maintenance'; // New: Import Maintenance page
import Unsubscribe from '../pages/Unsubscribe';
import Banner from './Banner';
import FAQModal from './FAQModal'; // New: Import FAQModal
import ShippingPolicyModal from './ShippingPolicyModal'; // New: Import ShippingPolicyModal
import TermsOfServiceModal from './TermsOfServiceModal'; // New: Import TermsOfServiceModal
import PrivacyPolicyModal from './PrivacyPolicyModal'; // New: Import PrivacyPolicyModal
import ToastNotification from './ToastNotification'; // Import ToastNotification
import ChatWidget from './ChatWidget';
import { useAppContext } from '../context/AppContext'; // Import useAppContext

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { user, isMaintenanceMode, toastMessage, toastType, hideToast } = useAppContext(); // Get isMaintenanceMode from context
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname === '/dashboard';
  const isSignInOrSignUp = location.pathname === '/signin' || location.pathname === '/signup';

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

  return (
    <div className="min-h-screen flex flex-col">
      {!isAdminRoute && !isDashboardRoute && <Banner />}
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
          <Routes location={location}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardContent />} /> {/* Default child for /admin */}
              <Route path="users" element={<AdminManageUsers />} /> {/* New Users route */}
              <Route path="products" element={<AdminManageProducts />} />
              <Route path="categories" element={<AdminManageCategories />} /> {/* New Categories route */}
              <Route path="orders" element={<AdminManageOrders />} /> {/* New: Orders route */}
              <Route path="messages" element={<AdminMessages />} />
              <Route path="enquiries" element={<AdminEnquiries />} />
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
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
            <Route path="/maintenance" element={<Maintenance />} /> {/* Explicit route for Maintenance page */}
            <Route path="/unsubscribe" element={<Unsubscribe />} />
          </Routes>
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