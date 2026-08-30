
import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, Shield, Bell, CreditCard, Settings, ChevronRight, Sliders } from 'lucide-react'; // Import Sliders icon for General Settings
import { useAppContext } from '../context/AppContext';

const AdminSettingsLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppContext();

  // Redirect if not logged in or not an admin
  if (!user || user.role !== 'admin') {
    navigate('/signin'); // Or show an unauthorized message
    return null;
  }

  const settingsNavItems = [
    {
      id: 'account-security',
      label: 'Account & Security',
      icon: Shield,
      path: '/admin/settings/account-security',
      description: 'Manage your profile, password, 2FA, and device sessions.',
    },
    {
      id: 'store-configuration',
      label: 'Store Configuration',
      icon: Settings,
      path: '/admin/settings/store-configuration',
      description: 'Manage storefront customization, localization, and preferences.',
    },
    {
      id: 'business-notifications',
      label: 'Business & Notifications',
      icon: Bell,
      path: '/admin/settings/business-notifications',
      description: 'Control notifications, payment gateways, and billing.',
    },
  ];

  const breadcrumbs = [
    { label: 'Settings', path: '/admin/settings/account-security' },
    { label: settingsNavItems.find(item => location.pathname.startsWith(item.path))?.label || '', path: location.pathname }
  ].filter(crumb => crumb.label !== ''); // Filter out empty breadcrumbs if no match


  return (
    <div className="flex-1 flex flex-col dark:bg-slate-950 transition-colors duration-300">
      {/* Page Header (replicated from AdminDashboardContent for consistency) */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-wrap justify-between items-end gap-3 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Settings</h1>
            <p className="text-slate-500 dark:text-emerald-300 text-sm mt-1">Manage your preferences.</p>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <aside className="w-full md:w-72 flex-shrink-0 bg-white dark:bg-slate-900 rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors duration-300">
          <h3 className="text-base font-bold text-slate-900 dark:text-emerald-50 mb-6">Manage your preferences</h3>
          <nav className="space-y-2">
            {settingsNavItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive ? 'bg-emerald-800 dark:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800 hover:text-emerald-800 dark:hover:text-emerald-300'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content Area for Nested Settings Routes */}
        <div className="flex-1">
          {/* Breadcrumbs for internal settings pages */}
          <div className="flex items-center text-sm font-medium text-slate-500 dark:text-emerald-400 mb-6">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <Link to={crumb.path} className="hover:text-emerald-700 dark:hover:text-emerald-300">
                  {crumb.label}
                </Link>
                {index < breadcrumbs.length - 1 && (
                  <ChevronRight size={14} className="mx-2 text-slate-400 dark:text-slate-600" />
                )}
              </React.Fragment>
            ))}
          </div>
          <Outlet /> {/* Renders the specific settings component (Profile, Account Security, etc.) */}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsLayout;