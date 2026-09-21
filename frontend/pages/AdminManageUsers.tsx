
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, User as UserIcon, UserCheck, UserMinus, Search, Bike } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { User } from '../types';
import { apiFetch, ApiError } from '../api';
import { formatDate, getInitials } from '../utils';
import ConfirmationModal from '../components/ConfirmationModal';
import AdminPagination from '../components/AdminPagination';

const USERS_PER_PAGE = 10;

const AdminManageUsers: React.FC = () => {
  const context = useAppContext();
  const { token, user: loggedInUser } = context;
  const showToast = context.showToast;

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { users: fetched } = await apiFetch<{ users: User[] }>('/users', {}, token);
        if (cancelled) return;
        setAllUsers(fetched);

        // Mark any unread registrations as read now that the admin is viewing them
        const unread = fetched.filter(u => u.unread);
        unread.forEach(u => {
          apiFetch(`/users/${u.id}/read`, { method: 'PATCH' }, token).catch(() => {});
        });
        if (unread.length > 0) {
          const unreadIds = new Set(unread.map(u => u.id));
          setAllUsers(prev => prev.map(u => unreadIds.has(u.id) ? { ...u, unread: false } : u));
        }
      } catch (e) {
        showToast(e instanceof ApiError ? e.message : 'Could not load users.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin' | 'rider'>('user');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [addUserFormErrors, setAddUserFormErrors] = useState<Record<string, string>>({});

  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingUserPhoneNumber, setEditingUserPhoneNumber] = useState('');
  const [editingUserAddress, setEditingUserAddress] = useState('');
  const [editingUserRole, setEditingUserRole] = useState<'user' | 'admin' | 'rider'>('user');
  const [editUserFormErrors, setEditUserFormErrors] = useState<Record<string, string>>({});

  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const filteredUsers = useMemo(() => {
    let currentUsers = [...(allUsers || [])];

    if (searchQuery) {
      currentUsers = currentUsers.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return currentUsers.sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getUserRoleTag = (role: 'user' | 'admin' | 'rider') => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
          <UserCheck size={13} className="mr-1" /> Admin
        </span>
      );
    }
    if (role === 'rider') {
      return (
        <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-orange-700 dark:text-orange-300 whitespace-nowrap">
          <Bike size={13} className="mr-1" /> Rider
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-emerald-200 whitespace-nowrap">
        <UserIcon size={13} className="mr-1" /> User
      </span>
    );
  };

  const handleAddUserClick = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('user');
    setNewUserPassword('');
    setShowNewUserPassword(false);
    setAddUserFormErrors({});
    setShowAddUserModal(true);
  };

  const validateAddUserForm = () => {
    const errors: Record<string, string> = {};
    if (!newUserName.trim()) errors.name = 'Full name is required.';
    if (!newUserEmail.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(newUserEmail)) errors.email = 'Invalid email format.';
    else if (allUsers.some(u => u.email.toLowerCase() === newUserEmail.toLowerCase())) errors.email = 'Email already exists.';
    if (!newUserPassword) errors.password = 'Password is required.';
    else if (newUserPassword.length < 6) errors.password = 'Password must be at least 6 characters.';

    setAddUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveNewUser = async () => {
    if (!validateAddUserForm()) {
      showToast('Please correct the form errors first.', 'error');
      return;
    }

    try {
      const { user: created } = await apiFetch<{ user: User }>('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          password: newUserPassword,
        }),
      }, token);
      setAllUsers(prev => [...prev, created]);
      showToast(`User "${created.name}" added.`, 'success');
      setShowAddUserModal(false);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not add user.', 'error');
    }
  };

  const handleEditUserClick = (user: User) => {
    setEditingUserId(user.id);
    setEditingUserName(user.name);
    setEditingUserEmail(user.email);
    setEditingUserPhoneNumber(user.phoneNumber || '');
    setEditingUserAddress(user.address || '');
    setEditingUserRole(user.role);
    setEditUserFormErrors({});
    setShowEditUserModal(true);
  };

  const validateEditUserForm = () => {
    const errors: Record<string, string> = {};
    if (!editingUserName.trim()) errors.name = 'Full name is required.';
    if (!editingUserEmail.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(editingUserEmail)) errors.email = 'Invalid email format.';
    else if (allUsers.some(u => u.email.toLowerCase() === editingUserEmail.toLowerCase() && u.id !== editingUserId)) errors.email = 'Email already exists.';

    setEditUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEditedUser = async () => {
    if (!validateEditUserForm()) {
      showToast('Please correct the form errors first.', 'error');
      return;
    }

    if (!editingUserId) {
      showToast('No user selected for editing.', 'error');
      return;
    }

    try {
      const { user: updated } = await apiFetch<{ user: User }>(`/users/${editingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editingUserName.trim(),
          email: editingUserEmail.trim(),
          phoneNumber: editingUserPhoneNumber.trim(),
          address: editingUserAddress.trim(),
          role: editingUserRole,
        }),
      }, token);
      setAllUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      showToast(`User "${updated.name}" updated.`, 'success');
      setShowEditUserModal(false);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update user.', 'error');
    }
  };

  const handleDeleteUserClick = (user: User) => {
    // Prevent admin from deleting their own account
    if (loggedInUser && loggedInUser.id === user.id) {
      showToast('You cannot delete your own account.', 'error');
      return;
    }
    setUserToDelete(user);
    setShowDeleteUserConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await apiFetch(`/users/${userToDelete.id}`, { method: 'DELETE' }, token);
      setAllUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      showToast(`User "${userToDelete.name}" deleted.`, 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete user.', 'error');
    } finally {
      setShowDeleteUserConfirm(false);
      setUserToDelete(null);
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    if (loggedInUser && loggedInUser.id === targetUser.id) {
      showToast('You cannot deactivate your own account.', 'error');
      return;
    }
    const nextIsActive = targetUser.isActive === false;
    try {
      const { user: updated } = await apiFetch<{ user: User }>(`/users/${targetUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextIsActive }),
      }, token);
      setAllUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      showToast(`User "${updated.name}" ${nextIsActive ? 'activated' : 'deactivated'}.`, nextIsActive ? 'success' : 'info');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not update user status.', 'error');
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-wrap justify-between items-end gap-3 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Manage Users</h1>
            <p className="text-slate-500 dark:text-emerald-300 text-xs sm:text-sm mt-1">Add, edit, and manage users for your store.</p>
          </div>
          <button
            onClick={handleAddUserClick}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
          >
            <Plus size={18} className="sm:w-5 sm:h-5" /> Add User
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 sm:gap-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-2 sm:mb-4 transition-colors duration-300">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search users by name, email, or role"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 outline-none text-sm text-slate-900 dark:text-emerald-100 transition-all"
              />
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Avatar</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">User ID</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Name</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Email</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Phone Number</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Address</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Role</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Registered</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-sm sm:text-lg text-slate-500 dark:text-emerald-300">Loading users...</td>
                  </tr>
                ) : paginatedUsers.length > 0 ? paginatedUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {user.profileImage ? (
                        <img src={user.profileImage} alt={user.name} className="w-7 h-7 sm:w-9 sm:h-9 rounded-full object-cover" />
                      ) : (
                        <span className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-emerald-700 dark:bg-emerald-800 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">
                          {getInitials(user.name)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-bold font-mono tracking-wide text-slate-700 dark:text-emerald-200 whitespace-nowrap">
                        {user.id}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 max-w-[140px] sm:max-w-[180px]">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-emerald-50 truncate" title={user.name}>
                        {user.name}
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 truncate" title={`@${user.username}`}>
                        @{user.username}
                      </p>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 max-w-[160px] sm:max-w-[220px] truncate" title={user.email}>
                      {user.email}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 whitespace-nowrap">
                      {user.phoneNumber || '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 max-w-[140px] sm:max-w-[200px] truncate" title={user.address || undefined}>
                      {user.address || '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">{getUserRoleTag(user.role)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-emerald-200 whitespace-nowrap">
                      {user.registrationDate ? formatDate(user.registrationDate) : '—'}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      {loggedInUser && loggedInUser.id === user.id ? (
                        <span
                          className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                          title="You cannot deactivate your own account."
                        >
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`inline-flex items-center rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap ${
                            user.isActive !== false
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/70'
                              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/70'
                          }`}
                          title={user.isActive !== false ? 'Click to deactivate this user' : 'Click to reactivate this user'}
                        >
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                      <div className="flex items-center justify-end gap-2 sm:gap-3">
                        <button 
                          onClick={() => handleEditUserClick(user)}
                          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          aria-label={`Edit ${user.name}`}
                          title={`Edit ${user.name}`}
                        >
                          <Pencil size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                        {loggedInUser && loggedInUser.id !== user.id ? ( // Prevent admin from deleting their own account
                          <button 
                            onClick={() => handleDeleteUserClick(user)}
                            className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            aria-label={`Delete ${user.name}`}
                            title={`Delete ${user.name}`}
                          >
                            <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                        ) : (
                          <span className="p-1.5 sm:p-2 text-slate-300 dark:text-slate-700 cursor-not-allowed" title="You cannot delete your own account.">
                            <UserMinus size={16} className="sm:w-[18px] sm:h-[18px]" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-sm sm:text-lg text-slate-500 dark:text-emerald-300">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={filteredUsers.length}
            itemsPerPage={USERS_PER_PAGE}
            itemLabel="users"
          />
        </div>
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 w-full max-w-2xl shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 pr-8">Add New User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
              <div className="col-span-full">
                <label htmlFor="newUserName" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Full Name</label>
                <input
                  id="newUserName"
                  type="text"
                  placeholder="Enter user's full name"
                  value={newUserName}
                  onChange={(e) => { setNewUserName(e.target.value); setAddUserFormErrors(prev => ({ ...prev, name: '' })); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {addUserFormErrors.name && <p className="text-red-500 text-xs mt-1">{addUserFormErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="newUserEmail" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Email Address</label>
                <input
                  id="newUserEmail"
                  type="email"
                  placeholder="example@kuisoko.com"
                  value={newUserEmail}
                  onChange={(e) => { setNewUserEmail(e.target.value); setAddUserFormErrors(prev => ({ ...prev, email: '' })); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {addUserFormErrors.email && <p className="text-red-500 text-xs mt-1">{addUserFormErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="newUserRole" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Role</label>
                <select
                  id="newUserRole"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin' | 'rider')}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="rider">Rider</option>
                </select>
              </div>

              <div className="col-span-full">
                <label htmlFor="newUserPassword" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Password</label>
                <div className="relative">
                  <input
                    id="newUserPassword"
                    type={showNewUserPassword ? 'text' : 'password'}
                    placeholder="Enter a password for the user"
                    value={newUserPassword}
                    onChange={(e) => { setNewUserPassword(e.target.value); setAddUserFormErrors(prev => ({ ...prev, password: '' })); }}
                    className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm pr-12 text-slate-900 dark:text-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showNewUserPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewUserPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {addUserFormErrors.password && <p className="text-red-500 text-xs mt-1">{addUserFormErrors.password}</p>}
              </div>

            </div>

            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 sm:mt-8">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewUser}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Add User
              </button>
            </div>
            <button
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {showEditUserModal && editingUserId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 w-full max-w-2xl shadow-xl border border-slate-100 dark:border-slate-800 relative">
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-emerald-50 mb-4 sm:mb-6 pr-8">Edit User: {editingUserName}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-3 sm:gap-y-4">
              <div className="col-span-full">
                <label htmlFor="editUserName" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Full Name</label>
                <input
                  id="editUserName"
                  type="text"
                  placeholder="Enter user's full name"
                  value={editingUserName}
                  onChange={(e) => { setEditingUserName(e.target.value); setEditUserFormErrors(prev => ({ ...prev, name: '' })); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {editUserFormErrors.name && <p className="text-red-500 text-xs mt-1">{editUserFormErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="editUserEmail" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Email Address</label>
                <input
                  id="editUserEmail"
                  type="email"
                  placeholder="example@kuisoko.com"
                  value={editingUserEmail}
                  onChange={(e) => { setEditingUserEmail(e.target.value); setEditUserFormErrors(prev => ({ ...prev, email: '' })); }}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
                {editUserFormErrors.email && <p className="text-red-500 text-xs mt-1">{editUserFormErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="editUserPhoneNumber" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Phone Number</label>
                <input
                  id="editUserPhoneNumber"
                  type="tel"
                  placeholder="e.g. 0783655163"
                  value={editingUserPhoneNumber}
                  onChange={(e) => setEditingUserPhoneNumber(e.target.value)}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
              </div>

              <div>
                <label htmlFor="editUserRole" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Role</label>
                <select
                  id="editUserRole"
                  value={editingUserRole}
                  onChange={(e) => setEditingUserRole(e.target.value as 'user' | 'admin' | 'rider')}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="rider">Rider</option>
                </select>
              </div>

              <div className="col-span-full">
                <label htmlFor="editUserAddress" className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-1.5 sm:mb-2">Address</label>
                <input
                  id="editUserAddress"
                  type="text"
                  placeholder="Enter user's address"
                  value={editingUserAddress}
                  onChange={(e) => setEditingUserAddress(e.target.value)}
                  className="w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100"
                />
              </div>

            </div>

            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 sm:mt-8">
              <button
                onClick={() => setShowEditUserModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedUser}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-lg active:scale-95"
              >
                Save Changes
              </button>
            </div>
            <button
              onClick={() => setShowEditUserModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteUserConfirm}
        onClose={() => setShowDeleteUserConfirm(false)}
        onConfirm={confirmDeleteUser}
        title="Delete User?"
        message={`Are you sure you want to delete the user "${userToDelete?.name}"? This action cannot be undone.`}
        confirmButtonText="Delete User"
        confirmButtonClass="bg-rose-500 text-white hover:bg-rose-600"
      />
    </>
  );
};

export default AdminManageUsers;
