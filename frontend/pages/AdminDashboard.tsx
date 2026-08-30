

import React, { useEffect } from 'react';
// Fix: Ensure correct `react-router-dom` named imports for v6+.
// The existing import statement is correct for `react-router-dom` v6+.
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const AdminDashboard: React.FC = () => {
  const { user } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if not logged in or not an admin
    if (!user || user.role !== 'admin') {
      navigate('/signin');
    }
    // If logged in and is admin, this component is part of a nested route
    // where AdminLayout is the parent and renders the Outlet.
    // No direct rendering needed here for the content as it's handled by AdminDashboardContent
    // which is the default child of /admin route under AdminLayout.
  }, [user, navigate]);

  // This component acts as a guard. If the user is not an admin, they are redirected.
  // If they are an admin, the MainLayout renders AdminLayout, which in turn renders
  // the appropriate child component (AdminDashboardContent for '/', AdminManageProducts for '/products')
  // via its <Outlet />.
  return null; 
};

export default AdminDashboard;
