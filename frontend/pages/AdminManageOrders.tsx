
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Package, Search, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate } from '../utils';
import { useAppContext } from '../context/AppContext';
import { Order, CartItem } from '../types';
import { ORDER_STATUS_COLORS } from '../constants';
import ConfirmationModal from '../components/ConfirmationModal';
import KuISOKOLogoSVG from '../components/KuISOKOLogoSVG';
import { apiFetch, ApiError } from '../api';

const ORDERS_PER_PAGE = 8;

const AdminManageOrders: React.FC = () => {
  const context = useAppContext();
  const { orders, updateOrder, deleteOrder, confirmOrderPayment, getFormattedPrice, user, token } = context;
  const showToast = context.showToast;
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | Order['status']>('All');
  const [sortBy, setSortBy] = useState<'date' | 'total'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // Default to newest first
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [showDeleteOrderConfirm, setShowDeleteOrderConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const availableStatuses: ('All' | Order['status'])[] = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  const filteredAndSortedOrders = useMemo(() => {
    // Defensive check: ensure orders is an array before spreading
    let currentOrders = [...(orders || [])];

    // Filter by search query
    if (searchQuery) {
      currentOrders = currentOrders.filter(order =>
        (order.orderNumber || order.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by status
    if (filterStatus !== 'All') {
      currentOrders = currentOrders.filter(order => order.status === filterStatus);
    }

    // Sort
    currentOrders.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'total') {
        // Sorting by total uses the stored USD total
        comparison = a.total - b.total;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return currentOrders;
  }, [orders, searchQuery, filterStatus, sortBy, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredAndSortedOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  );

  // No scroll-to-top here (unlike a plain page navigation) - Users and Products' pagination
  // already just swap the table's contents in place without moving the viewport, this matches
  // that instead of jumping back to the top of the page on every "Next" click.
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSort = (key: 'date' | 'total') => {
    if (sortBy === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDirection('desc'); // Default to descending for new sort key
    }
    setCurrentPage(1);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetailsModal(true);
    if (order.status === 'Pending') {
      updateOrder({ ...order, status: 'Processing' });
    }
  };

  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (orderToUpdate) {
      updateOrder({ ...orderToUpdate, status: newStatus });
    }
  };

  const handleDeleteOrderClick = (order: Order) => {
    setOrderToDelete(order);
    setShowDeleteOrderConfirm(true);
  };

  const confirmDeleteOrder = async () => {
    if (orderToDelete) {
      const success = await deleteOrder(orderToDelete.id);
      if (success) {
        setShowDeleteOrderConfirm(false);
        setOrderToDelete(null);
      }
    }
  };

  const getStatusClasses = (status: Order['status']) => {
    const colors = ORDER_STATUS_COLORS[status];
    return `${colors.bg} ${colors.text}`;
  };

  return (
    <>
      {/* Page Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-wrap justify-between items-end gap-3 max-w-[1200px] mx-auto w-full">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Manage Orders</h1>
            <p className="text-slate-500 dark:text-emerald-300 text-xs sm:text-sm mt-1">View and manage all customer orders here.</p>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 sm:gap-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        {/* Filters and Search */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-colors duration-300">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by Order ID or Product Name"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 outline-none text-sm text-slate-900 dark:text-emerald-100 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value as 'All' | Order['status']); setCurrentPage(1); }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-slate-700 dark:text-emerald-100 w-full sm:w-auto"
            >
              {availableStatuses.map(status => (
                <option key={status} value={status}>{status === 'All' ? 'All Orders' : status}</option>
              ))}
            </select>
            <select
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [key, direction] = e.target.value.split('-');
                setSortBy(key as 'date' | 'total');
                setSortDirection(direction as 'asc' | 'desc');
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-slate-700 dark:text-emerald-100 w-full sm:w-auto"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="total-desc">Total: High to Low</option>
              <option value="total-asc">Total: Low to High</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Order ID</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Customer</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer whitespace-nowrap" onClick={() => handleSort('date')}>
                    Date {sortBy === 'date' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer whitespace-nowrap" onClick={() => handleSort('total')}>
                    Total {sortBy === 'total' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">Status</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-300">{paginatedOrders.length > 0 ? paginatedOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-semibold text-slate-700 dark:text-emerald-50">#{order.orderNumber || order.id}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-600 dark:text-emerald-200">{order.customerName}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-slate-600 dark:text-emerald-200">{formatDate(order.date)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base font-bold text-slate-900 dark:text-emerald-100">{getFormattedPrice(order.total)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                        className={`inline-flex items-center rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold outline-none border-none ${getStatusClasses(order.status)}`}
                      >
                        {availableStatuses.filter(s => s !== 'All').map(statusOption => (
                          <option key={statusOption} value={statusOption}>{statusOption}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                      <div className="flex items-center justify-end gap-2 sm:gap-3">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          aria-label={`View details for order #${order.orderNumber || order.id}`}
                          title={`View details for order #${order.orderNumber || order.id}`}
                        >
                          <Package size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrderClick(order)}
                          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                          aria-label={`Delete order #${order.orderNumber || order.id}`}
                          title={`Delete order #${order.orderNumber || order.id}`}
                        >
                          <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-sm sm:text-lg text-slate-500 dark:text-emerald-300">No orders found.</td>
                  </tr>
                )}</tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredAndSortedOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
              <span className="text-xs sm:text-sm text-slate-600 dark:text-emerald-300 order-2 sm:order-1">
                {`Showing ${Math.min(filteredAndSortedOrders.length, (currentPage - 1) * ORDERS_PER_PAGE + 1)}-${Math.min(filteredAndSortedOrders.length, currentPage * ORDERS_PER_PAGE)} of ${filteredAndSortedOrders.length} orders`}
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2 flex-wrap justify-center">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-xs sm:text-sm font-semibold ${currentPage === page ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrder && (
        <div id="print-modal" className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div id="invoice-content" className="bg-white rounded-[2.5rem] p-5 sm:p-8 w-full max-w-2xl shadow-xl border border-slate-100 relative">
            {/* PDF Invoice Structure */}
            <div id="pdf-wrapper" className="absolute top-0 left-0 w-full opacity-0 pointer-events-none">
              <div id="invoice-content-for-pdf" className="w-[800px] p-8 text-black bg-white">
              <div className="invoice" style={{ maxWidth: '760px', margin: '0 auto', background: '#ffffff', padding: '64px 56px 48px', color: '#1a1a1a', fontFamily: 'sans-serif' }}>
                <div style={{ marginBottom: '36px' }}>
                  <KuISOKOLogoSVG className="h-10 w-auto block" />
                </div>
                <div className="top" style={{ marginBottom: '28px' }}>
                  <div className="date-block" style={{ fontSize: '15px' }}>
                    <div>{formatDate(selectedOrder.date)}</div>
                    <div className="inv-no"><strong>Invoice No. {selectedOrder.orderNumber || selectedOrder.id}</strong></div>
                  </div>
                </div>
                <hr style={{ borderTop: '1px solid #1a1a1a', border: 'none' }} />

                <div className="bill-to">
                  <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 18px' }}>BILL TO:</h2>
                  <p style={{ fontSize: '17px', margin: '0 0 4px' }}>{selectedOrder.customerName}</p>
                  {selectedOrder.deliveryAddress?.phoneNumber && <p className="phone" style={{ fontSize: '17px', margin: '0 0 4px' }}>{selectedOrder.deliveryAddress.phoneNumber}</p>}
                  {selectedOrder.deliveryAddress && (
                    <p style={{ fontSize: '17px', margin: '0 0 4px' }}>{selectedOrder.deliveryAddress.streetAddress}, {selectedOrder.deliveryAddress.cityTown}</p>
                  )}
                </div>

                <table className="items" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '44px' }}>
                  <thead>
                    <tr>
                      <th colSpan={2} style={{ textAlign: 'left', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', fontSize: '21px' }}>DESCRIPTION</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', fontSize: '21px' }}>PRICE</th>
                      <th style={{ textAlign: 'right', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', fontSize: '21px' }}>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map(item => (
                      <tr key={item.id}>
                        <td className="qty" style={{ width: '40px', padding: '12px 0', fontSize: '16px', borderBottom: '1px solid #eee' }}>{item.quantity}x</td>
                        <td style={{ padding: '12px 0', fontSize: '16px', borderBottom: '1px solid #eee' }}>{item.name} {item.selectedSize && `(${item.selectedSize})`} {item.selectedColor && `(${item.selectedColor})`}</td>
                        <td style={{ padding: '12px 0', fontSize: '16px', borderBottom: '1px solid #eee' }}>{getFormattedPrice(item.price)}</td>
                        <td style={{ textAlign: 'right', padding: '12px 0', fontSize: '16px', borderBottom: '1px solid #eee' }}>{getFormattedPrice(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <table className="totals-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '44px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', fontSize: '21px' }}>SUBTOTAL</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', fontSize: '21px' }}>DELIVERY FEE</th>
                      <th style={{ textAlign: 'right', borderBottom: '2px solid #1a1a1a', paddingBottom: '14px', fontSize: '21px' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ paddingTop: '14px', fontSize: '17px' }}>{getFormattedPrice(selectedOrder.subtotal ?? selectedOrder.total)}</td>
                      <td style={{ paddingTop: '14px', fontSize: '17px' }}>{getFormattedPrice(selectedOrder.shippingFee ?? 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '18px', paddingTop: '14px' }}>{getFormattedPrice(selectedOrder.total)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: '40px', fontSize: '14px', color: '#666' }}>
                  <p><strong>Issued by:</strong> {user?.name || 'Admin'}</p>
                  <p><strong>Email:</strong> {user?.email || 'admin@example.com'}</p>
                  <p><strong>Date Issued:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
                <div style={{ marginTop: '56px', paddingTop: '32px', borderTop: '2px solid #0B5D3B', textAlign: 'center' }}>
                  <p style={{ fontSize: '26px', fontWeight: '900', margin: '0 0 6px', color: '#0B5D3B', letterSpacing: '0.02em' }}>
                    Thank you for choosing KuISOKO!
                  </p>
                  <p style={{ fontSize: '14px', margin: 0, color: '#888' }}>
                    We're grateful for your trust. See you again soon.
                  </p>
                </div>
              </div>
            </div>
            </div>

            {/* Detailed UI for on-screen viewing */}
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 mb-4 sm:mb-6 pr-8">Order Details #{selectedOrder.orderNumber || selectedOrder.id}</h3>
            <div className="space-y-3 sm:space-y-4 text-slate-700 text-xs sm:text-sm">
              <p><strong>Date:</strong> {formatDate(selectedOrder.date)}</p>
              <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
              {selectedOrder.deliveryAddress ? (
                <>
                  <p><strong>Delivery Address:</strong> {selectedOrder.deliveryAddress.streetAddress}, {selectedOrder.deliveryAddress.cityTown}, {selectedOrder.deliveryAddress.district}, {selectedOrder.deliveryAddress.country}</p>
                  <p><strong>Phone Number:</strong> {selectedOrder.deliveryAddress.phoneNumber}</p>
                  {selectedOrder.deliveryAddress.houseBuildingNumber && <p><strong>Building/House:</strong> {selectedOrder.deliveryAddress.houseBuildingNumber}</p>}
                  {selectedOrder.deliveryAddress.additionalInfo && <p><strong>Additional Info:</strong> {selectedOrder.deliveryAddress.additionalInfo}</p>}
                </>
              ) : (
                <p><strong>Delivery Address:</strong> Not provided</p>
              )}
              <p><strong>Status:</strong> <span className={`font-bold ${getStatusClasses(selectedOrder.status)} rounded-full px-2 py-0.5 text-xs`}>{selectedOrder.status}</span></p>
              <p>
                <strong>Payment:</strong>{' '}
                <span className={`font-bold rounded-full px-2 py-0.5 text-xs ${selectedOrder.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : selectedOrder.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selectedOrder.paymentStatus === 'paid' ? 'Paid' : selectedOrder.paymentStatus === 'failed' ? 'Failed' : 'Unpaid'}
                </span>
              </p>

              <h4 className="text-lg font-bold text-slate-900 mt-6 mb-3">Order Items:</h4>
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {selectedOrder.items.map(item => (
                  <li key={item.id} className="flex items-center gap-4 py-3 px-4">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-slate-100 flex-shrink-0">
                      <img src={item.images[0]} alt={item.name} className="w-full h-full object-contain p-1" />
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.category}
                        {item.selectedSize && ` | Size: ${item.selectedSize}`}
                        {item.selectedColor && ` | Color: ${item.selectedColor}`}
                        {` | Qty: ${item.quantity}`}
                      </p>
                    </div>
                    <p className="font-bold text-slate-900">{getFormattedPrice(item.price * item.quantity)}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center py-4 px-4 font-bold text-slate-900 border-t border-slate-100">
                <span>Grand Total:</span>
                <span>{getFormattedPrice(selectedOrder.total)}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 sm:mt-8 no-print">
              {selectedOrder.paymentStatus !== 'paid' && (
                <button
                  onClick={async () => {
                    setIsConfirmingPayment(true);
                    const success = await confirmOrderPayment(selectedOrder.id);
                    setIsConfirmingPayment(false);
                    if (success) {
                      setSelectedOrder(prev => prev ? { ...prev, paymentStatus: 'paid' } : prev);
                    }
                  }}
                  disabled={isConfirmingPayment}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {isConfirmingPayment ? 'Confirming...' : 'Confirm Payment'}
                </button>
              )}
              <button
                onClick={() => {
                  const element = document.getElementById('invoice-content-for-pdf');
                  if (!element) return;
                  import('html2pdf.js').then((html2pdf) => {
                    const opt = {
                      margin: 0.5,
                      filename: `Invoice-${selectedOrder.orderNumber || selectedOrder.id}.pdf`,
                      image: { type: 'jpeg' as const, quality: 0.98 },
                      html2canvas: { scale: 2 },
                      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
                    };
                    html2pdf.default().set(opt).from(element as HTMLElement).save();
                  });
                }}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Download Invoice
              </button>
              <button
                onClick={async () => {
                  const email = selectedOrder.deliveryAddress?.email;
                  if (!email) {
                    showToast('This order has no email address on file.', 'error');
                    return;
                  }
                  const element = document.getElementById('invoice-content-for-pdf');
                  if (!element) return;
                  setIsSendingInvoice(true);
                  try {
                    const html2pdf = await import('html2pdf.js');
                    const opt = {
                      margin: 0.5,
                      filename: `Invoice-${selectedOrder.orderNumber || selectedOrder.id}.pdf`,
                      image: { type: 'jpeg' as const, quality: 0.98 },
                      html2canvas: { scale: 2 },
                      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
                    };
                    const dataUri: string = await html2pdf.default().set(opt).from(element as HTMLElement).outputPdf('datauristring');
                    const pdfBase64 = dataUri.split(',')[1];
                    await apiFetch(`/orders/${selectedOrder.id}/send-invoice`, {
                      method: 'POST',
                      body: JSON.stringify({ pdfBase64 }),
                    }, token);
                    showToast(`Invoice sent to ${email}.`, 'success');
                  } catch (e) {
                    showToast(e instanceof ApiError ? e.message : 'Could not send the invoice email.', 'error');
                  } finally {
                    setIsSendingInvoice(false);
                  }
                }}
                disabled={isSendingInvoice}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {isSendingInvoice ? 'Sending...' : 'Send Invoice'}
              </button>
              <button
                onClick={() => setShowOrderDetailsModal(false)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
            <button
              onClick={() => setShowOrderDetailsModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteOrderConfirm}
        onClose={() => setShowDeleteOrderConfirm(false)}
        onConfirm={confirmDeleteOrder}
        title="Delete Order?"
        message={`Are you sure you want to delete order #${orderToDelete?.orderNumber || orderToDelete?.id}? This action cannot be undone.`}
        confirmButtonText="Delete Order"
        confirmButtonClass="bg-rose-500 text-white hover:bg-rose-600"
      />
    </>
  );
};

export default AdminManageOrders;
