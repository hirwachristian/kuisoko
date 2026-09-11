import React, { useEffect, useState } from 'react';
import { RotateCcw, ChevronLeft, Check, X as XIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import { ReturnRequestNotification } from '../types';

const LIST_POLL_MS = 15000;

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_STYLES: Record<ReturnRequestNotification['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
};

const AdminManageReturns: React.FC = () => {
  const { token, showToast, getFormattedPrice } = useAppContext();
  const [requests, setRequests] = useState<ReturnRequestNotification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchRequests = async () => {
      try {
        const { returnRequests } = await apiFetch<{ returnRequests: ReturnRequestNotification[] }>('/returns', {}, token);
        if (!cancelled) setRequests(returnRequests);
      } catch (e) {
        console.error('Error fetching return requests:', e);
      }
    };
    fetchRequests();
    const interval = setInterval(fetchRequests, LIST_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setRejectNote('');
    setRequests(prev => prev.map(r => (r.id === id ? { ...r, unread: false } : r)));
    try {
      await apiFetch(`/returns/${id}/read`, { method: 'PATCH' }, token);
    } catch (e) {
      console.error('Error marking return request as read:', e);
    }
  };

  const selected = requests.find(r => r.id === selectedId) || null;

  const handleApprove = async () => {
    if (!selectedId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { returnRequest } = await apiFetch<{ returnRequest: ReturnRequestNotification }>(`/returns/${selectedId}/approve`, { method: 'POST' }, token);
      setRequests(prev => prev.map(r => (r.id === selectedId ? returnRequest : r)));
      showToast('Return approved - order marked as Returned and stock restored.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not approve the return.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    const note = rejectNote.trim();
    if (!note || !selectedId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { returnRequest } = await apiFetch<{ returnRequest: ReturnRequestNotification }>(`/returns/${selectedId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }, token);
      setRequests(prev => prev.map(r => (r.id === selectedId ? returnRequest : r)));
      setRejectNote('');
      showToast('Return rejected.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not reject the return.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-col gap-1 max-w-[1200px] mx-auto w-full">
          <h1 className="text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Returns</h1>
          <p className="text-slate-500 dark:text-emerald-300 text-sm mt-1">Customer return requests on Delivered orders. Approving restores stock and marks the order Returned.</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex h-[calc(100vh_-_220px)] min-h-[480px]">
          <div className={`${selectedId ? 'hidden sm:block' : 'block'} w-full sm:w-80 border-r border-slate-100 dark:border-slate-800 overflow-y-auto shrink-0`}>
            {requests.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">No return requests yet.</div>
            ) : requests.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                className={`w-full text-left px-5 py-4 border-b border-slate-50 dark:border-slate-800 transition-colors ${
                  selectedId === r.id ? 'bg-emerald-50 dark:bg-emerald-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm text-slate-900 dark:text-emerald-50 truncate ${r.unread ? 'font-black' : 'font-bold'}`}>{r.customerName}</p>
                  {r.unread && <span className="shrink-0 w-2 h-2 rounded-full bg-rose-500" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">#{r.orderNumber} &middot; {getFormattedPrice(r.total)}</p>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(r.requestedAt)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                </div>
              </button>
            ))}
          </div>

          <div className={`${selectedId ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0`}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3">
                <RotateCcw size={48} />
                <p className="text-sm text-slate-400 dark:text-slate-500">Select a return request to review it.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="sm:hidden -ml-2 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Back to return requests"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-emerald-50 truncate">Order #{selected.orderNumber}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{selected.customerName} &middot; {selected.customerEmail}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-slate-50 dark:bg-slate-950">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">Requested {formatDate(selected.requestedAt)} &middot; Order total {getFormattedPrice(selected.total)}</p>
                    <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{selected.reason}</p>
                  </div>

                  {selected.status === 'rejected' && selected.adminNote && (
                    <div className="bg-rose-700 text-white rounded-2xl p-4">
                      <div className="flex items-center gap-1.5 mb-2 text-rose-200 text-[11px]">
                        Rejected {selected.resolvedAt ? formatDate(selected.resolvedAt) : ''}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{selected.adminNote}</p>
                    </div>
                  )}
                  {selected.status === 'approved' && (
                    <div className="bg-emerald-700 text-white rounded-2xl p-4">
                      <p className="text-sm">Approved {selected.resolvedAt ? formatDate(selected.resolvedAt) : ''} - order marked Returned and stock restored.</p>
                    </div>
                  )}
                </div>

                {selected.status === 'pending' && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
                    <button
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors disabled:opacity-50"
                    >
                      <Check size={16} /> Approve Return
                    </button>
                    <textarea
                      rows={2}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Reason for the customer if rejecting..."
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-rose-500 text-sm text-slate-900 dark:text-emerald-100 disabled:opacity-60 resize-none"
                    />
                    <button
                      onClick={handleReject}
                      disabled={isSubmitting || !rejectNote.trim()}
                      className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors disabled:opacity-50"
                    >
                      <XIcon size={16} /> Reject Return
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminManageReturns;
