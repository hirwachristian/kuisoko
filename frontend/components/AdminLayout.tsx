
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Tag, ShoppingCart, Settings, LogOut, Users, Receipt, Calendar, Zap, Sun, Moon, Ticket, MessageCircle, Mail, Menu, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import KuISOKOAdminLogo from './KuISOKOAdminLogo';

const AdminLayout: React.FC = () => {
  const { user, logout, categories, theme, toggleTheme, unreadOrderCount, unreadUserCount, chatAdminUnreadCount, enquiryUnreadCount } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close the mobile sidebar automatically whenever the admin navigates to a new page.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const chartColors = useMemo(() => {
    // Hardcoding light mode colors
    return {
      mainAccent: '#065f46', // emerald-900
      secondaryAccent: '#fb923c', // orange-500
      gridStroke: '#f1f5f9', // slate-100
      tickFill: '#94a3b8', // slate-400
      tooltipBg: '#ffffff', // white
      tooltipBorder: 'none',
      categoryColors: [
        { name: 'Electronics', color: '#065f46' }, // emerald-900
        { name: 'Fashion', color: '#fb923c' },    // orange-500
        { name: 'Home & Living', color: '#10b981' }, // emerald-500
        { name: 'Beauty', color: '#f59e0b' },   // amber-500
        { name: 'Sports', color: '#a3e635' },    // lime-500
      ],
      categoryColors3D: [
        { name: 'Electronics', color: '#033023' }, // Darker emerald-900
        { name: 'Fashion', color: '#e67d26' }, // Darker orange-500
        { name: 'Home & Living', color: '#0a7d5b' }, // Darker emerald-500
        { name: 'Beauty', color: '#d98700' }, // Darker amber-500
        { name: 'Sports', color: '#82b82a' }, // Darker lime-500
      ],
      pieLabelFill: '#1e293b', // slate-900
    };
  }, []); 

  // Redirect if not logged in or not an admin
  if (!user || user.role !== 'admin') {
    // In a real app, you'd navigate or show a proper unauthorized message
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900">
        Unauthorized access. Please
        <Link to="/signin" className="text-emerald-600 underline ml-1">sign in</Link>
        as an admin.
      </div>
    );
  }

  // Adjusted isActive to check if the current path starts with the link's path for settings sub-pages
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-emerald-50 transition-colors duration-300">
      {/* Backdrop - mobile only, shown behind the sidebar drawer while it's open */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation - a fixed slide-in drawer below the lg breakpoint, a normal static
          column at lg and up (matching how the rest of the app switches to its mobile menu). */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 overflow-y-auto border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-8 py-6 px-4">
          {/* Logo/Brand */}
          <div className="flex items-center justify-between">
            <Link to="/">
              <KuISOKOAdminLogo />
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 -mr-2 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            <Link 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin') && location.pathname === '/admin' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`} 
              to="/admin"
            >
              <LayoutDashboard size={20} className={`${isActive('/admin') && location.pathname === '/admin' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-semibold">Dashboard Overview</p>
            </Link>
            {/* New: Users Link */}
            <Link 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/users') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`} 
              to="/admin/users"
            >
              <Users size={20} className={`${isActive('/admin/users') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Users</p>
              {unreadUserCount > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {unreadUserCount > 9 ? '9+' : unreadUserCount}
                </span>
              )}
            </Link>
            <Link 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/products') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`} 
              to="/admin/products"
            >
              <Package size={20} className={`${isActive('/admin/products') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Products</p>
            </Link>
            <Link 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/categories') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`} 
              to="/admin/categories"
            >
              <Tag size={20} className={`${isActive('/admin/categories') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Categories</p>
            </Link>
            <Link 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/orders') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`} 
              to="/admin/orders"
            >
              <ShoppingCart size={20} className={`${isActive('/admin/orders') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Orders</p>
              {unreadOrderCount > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {unreadOrderCount > 9 ? '9+' : unreadOrderCount}
                </span>
              )}
            </Link>
            <Link
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/coupons') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`}
              to="/admin/coupons"
            >
              <Ticket size={20} className={`${isActive('/admin/coupons') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Coupons</p>
            </Link>
            <Link
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/messages') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`}
              to="/admin/messages"
            >
              <MessageCircle size={20} className={`${isActive('/admin/messages') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Messages</p>
              {chatAdminUnreadCount > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {chatAdminUnreadCount > 9 ? '9+' : chatAdminUnreadCount}
                </span>
              )}
            </Link>
            <Link
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/enquiries') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`}
              to="/admin/enquiries"
            >
              <Mail size={20} className={`${isActive('/admin/enquiries') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">Enquiries</p>
              {enquiryUnreadCount > 0 && (
                <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {enquiryUnreadCount > 9 ? '9+' : enquiryUnreadCount}
                </span>
              )}
            </Link>
            <div className="my-4 border-t border-slate-200 dark:border-slate-800"></div>
            <Link
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isActive('/admin/settings') ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50'}`}
              to="/admin/settings/account-security" // Updated to default to account-security sub-section
            >
              <Settings size={20} className={`${isActive('/admin/settings') ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <p className="text-sm font-medium">General Settings</p>
            </Link>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-emerald-50"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              <p className="text-sm font-medium">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</p>
            </button>
          </nav>
        </div>
        {/* Profile & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div
              className="w-10 h-10 rounded-full bg-slate-200 bg-cover bg-center"
              // Use user's profile image if available, otherwise the default avatar
              style={{ backgroundImage: user?.profileImage ? `url('${user.profileImage}')` : `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAqQjhKfTR2-7oaEyTJYUyna9q65rKOdnR22Nzy74hogmbgX6vefHT-V02JxkdgL39p2dNgtCbRTD7sT-KNxHoXx0y4fJz2GOQqFICCRdQJQ')` }}
              aria-label="Admin user avatar portrait"
            ></div>
            <div className="flex flex-col overflow-hidden">
              <p className="text-sm font-bold truncate text-slate-900 dark:text-emerald-50">{user?.name || 'Admin User'}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{user?.role === 'admin' ? 'Store Manager' : 'Guest'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 transition-all text-sm font-bold"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      {/* Main Content Area - min-w-0 lets this flex item actually shrink to the viewport width on
          mobile, instead of stretching to fit whatever wide content (tables etc.) sits inside it.
          overflow-x-hidden matters separately: this <main> is its own scroll container (not the
          page's <html>/<body>), so the site-wide overflow-x:hidden in index.html doesn't reach it -
          without this, any admin table/card even a pixel wider than the viewport lets this specific
          container rubber-band side to side on a touch scroll, same bug as the page-level one. */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden">
        {/* Mobile-only top bar: hamburger to open the sidebar drawer, since the sidebar itself is
            off-screen below the lg breakpoint. */}
        <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 sticky top-0 z-30">
          <Link to="/">
            <KuISOKOAdminLogo />
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
        <Outlet /> {/* Renders the child route component (e.g., AdminDashboardContent or AdminManageProducts) */}
      </main>
    </div>
  );
};

export default AdminLayout;
