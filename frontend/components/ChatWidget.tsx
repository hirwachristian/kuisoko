import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Paperclip, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import { ChatMessage } from '../types';
import ChatAttachment from '../components/ChatAttachment';

const CLOSED_POLL_MS = 20000;
const OPEN_POLL_MS = 4000;
const STATUS_POLL_MS = 30000;

const formatTime = (dateString: string) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const ChatWidget: React.FC = () => {
  const { user, token, t } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adminOnline, setAdminOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEligible = !!user && user.role === 'user';

  // Poll whether an admin is currently active, so the header can show a live "online" indicator.
  useEffect(() => {
    if (!isEligible) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const { online } = await apiFetch<{ online: boolean }>('/chat/admin-status', {}, token);
        if (!cancelled) setAdminOnline(online);
      } catch (e) {
        console.error('Error fetching admin status:', e);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, STATUS_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isEligible, token]);

  // Poll the unread count while the widget is closed, so the badge stays current without opening it.
  useEffect(() => {
    if (!isEligible || isOpen) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const { count } = await apiFetch<{ count: number }>('/chat/unread-count', {}, token);
        if (!cancelled) setUnreadCount(count);
      } catch (e) {
        console.error('Error fetching chat unread count:', e);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, CLOSED_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isEligible, isOpen, token]);

  // While open, fetch (and poll) the full conversation - the GET marks admin replies as read server-side.
  useEffect(() => {
    if (!isEligible || !isOpen) return;
    let cancelled = false;
    const fetchMessages = async () => {
      try {
        const { messages: fetched } = await apiFetch<{ messages: ChatMessage[] }>('/chat/messages', {}, token);
        if (!cancelled) {
          setMessages(fetched);
          setUnreadCount(0);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : t('chat_error_load'));
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, OPEN_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEligible, isOpen, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setInput('');
    try {
      const { message } = await apiFetch<{ message: ChatMessage }>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ body }),
      }, token);
      setMessages(prev => [...prev, message]);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : t('chat_error_send'));
      setInput(body); // give the message back so nothing typed is lost
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || isUploading || isSending) return;

    setIsUploading(true);
    setLoadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await apiFetch<{ url: string; originalName: string }>('/uploads', {
        method: 'POST',
        body: formData,
      }, token);
      const { message } = await apiFetch<{ message: ChatMessage }>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ attachmentUrl: url, attachmentType: file.type, attachmentName: file.name }),
      }, token);
      setMessages(prev => [...prev, message]);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : t('chat_error_send'));
    } finally {
      setIsUploading(false);
    }
  };

  if (!isEligible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[calc(100vw_-_2.5rem)] max-w-sm h-[70vh] max-h-[520px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-emerald-800 dark:bg-emerald-900 px-5 py-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-white font-black text-sm">{t('chat_widget_title')}</h3>
              {adminOnline ? (
                <p className="text-emerald-200 text-xs flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex w-2 h-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-green-400" />
                  </span>
                  {t('chat_admin_online')}
                </p>
              ) : (
                <p className="text-emerald-200 text-xs">{t('chat_widget_subtitle')}</p>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-emerald-100 hover:bg-emerald-700/50 transition-colors"
              aria-label={t('chat_close')}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-slate-950">
            {messages.length === 0 && !loadError && (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">{t('chat_empty_state')}</p>
            )}
            {loadError && (
              <p className="text-center text-sm text-rose-500 mt-2">{loadError}</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.senderRole === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-md'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-bl-md'
                }`}>
                  {msg.attachmentUrl && (
                    <ChatAttachment url={msg.attachmentUrl} type={msg.attachmentType} name={msg.attachmentName} />
                  )}
                  {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                  <p className={`text-[10px] mt-1 ${msg.senderRole === 'user' ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-colors disabled:opacity-50"
              aria-label={t('chat_attach_file')}
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat_placeholder')}
              disabled={isSending}
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-emerald-100 disabled:opacity-60"
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              aria-label={t('chat_send')}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-14 h-14 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xl shadow-emerald-900/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label={isOpen ? t('chat_close') : t('chat_open')}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && adminOnline && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white dark:border-slate-950" />
        )}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
