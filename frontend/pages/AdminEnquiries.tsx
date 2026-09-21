import React, { useEffect, useState } from 'react';
import { Mail, ChevronLeft, Send, Trash2, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import { Enquiry } from '../types';

const LIST_POLL_MS = 15000;

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const AdminEnquiries: React.FC = () => {
  const { token, showToast } = useAppContext();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // List, refreshed periodically so new submissions show up without a reload.
  useEffect(() => {
    let cancelled = false;
    const fetchEnquiries = async () => {
      try {
        const { enquiries: fetched } = await apiFetch<{ enquiries: Enquiry[] }>('/enquiries', {}, token);
        if (!cancelled) setEnquiries(fetched);
      } catch (e) {
        console.error('Error fetching enquiries:', e);
      }
    };
    fetchEnquiries();
    const interval = setInterval(fetchEnquiries, LIST_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  // Opening one marks it read on the backend - reflect that locally right away.
  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setReplyBody('');
    setEnquiries(prev => prev.map(e => (e.id === id ? { ...e, unread: false } : e)));
    try {
      await apiFetch(`/enquiries/${id}`, {}, token);
    } catch (e) {
      console.error('Error marking enquiry as read:', e);
    }
  };

  const selected = enquiries.find(e => e.id === selectedId) || null;

  const handleSendReply = async () => {
    const body = replyBody.trim();
    if (!body || !selectedId || isSending) return;
    setIsSending(true);
    try {
      const { enquiry } = await apiFetch<{ enquiry: Enquiry }>(`/enquiries/${selectedId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ replyBody: body }),
      }, token);
      setEnquiries(prev => prev.map(e => (e.id === selectedId ? enquiry : e)));
      setReplyBody('');
      showToast('Reply sent.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not send the reply.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/enquiries/${id}`, { method: 'DELETE' }, token);
      setEnquiries(prev => prev.filter(e => e.id !== id));
      if (selectedId === id) setSelectedId(null);
      showToast('Enquiry deleted.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete the enquiry.', 'error');
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-col gap-1 max-w-[1200px] mx-auto w-full">
          <h1 className="text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Enquiries</h1>
          <p className="text-slate-500 dark:text-emerald-300 text-sm mt-1">Messages submitted through the Contact Us form. Replies go straight to the email address provided.</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex h-[calc(100vh_-_220px)] min-h-[480px]">
          {/* List - master-detail on mobile, side-by-side at sm+, matching AdminMessages. */}
          <div className={`${selectedId ? 'hidden sm:block' : 'block'} w-full sm:w-80 border-r border-slate-100 dark:border-slate-800 overflow-y-auto shrink-0`}>
            {enquiries.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">No enquiries yet.</div>
            ) : enquiries.map((e) => (
              <button
                key={e.id}
                onClick={() => handleSelect(e.id)}
                className={`w-full text-left px-5 py-4 border-b border-slate-50 dark:border-slate-800 transition-colors ${
                  selectedId === e.id ? 'bg-emerald-50 dark:bg-emerald-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm text-slate-900 dark:text-emerald-50 truncate ${e.unread ? 'font-black' : 'font-bold'}`}>{e.name}</p>
                  {e.unread && <span className="shrink-0 w-2 h-2 rounded-full bg-rose-500" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{e.subject}</p>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(e.createdAt)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    e.status === 'replied' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                  }`}>
                    {e.status === 'replied' ? 'Replied' : 'New'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className={`${selectedId ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0`}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3">
                <Mail size={48} />
                <p className="text-sm text-slate-400 dark:text-slate-500">Select an enquiry to view its message.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="sm:hidden -ml-2 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Back to enquiries"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-emerald-50 truncate">{selected.subject}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{selected.name} &middot; {selected.email}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="shrink-0 p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400 transition-colors"
                    aria-label="Delete enquiry"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-slate-50 dark:bg-slate-950">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">{formatDate(selected.createdAt)}</p>
                    <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">{selected.message}</p>
                  </div>

                  {selected.status === 'replied' && selected.replyBody && (
                    <div className="bg-emerald-700 text-white rounded-2xl p-4">
                      <div className="flex items-center gap-1.5 mb-2 text-emerald-200 text-[11px]">
                        <CheckCircle2 size={13} /> Sent {selected.repliedAt ? formatDate(selected.repliedAt) : ''}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{selected.replyBody}</p>
                    </div>
                  )}
                </div>

                {selected.status !== 'replied' && (
                  <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
                    <textarea
                      rows={3}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={`Reply to ${selected.name}...`}
                      disabled={isSending}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-emerald-100 disabled:opacity-60 resize-none"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={isSending || !replyBody.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                    >
                      <Send size={16} />
                      {isSending ? 'Sending...' : 'Send Reply by Email'}
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

export default AdminEnquiries;
