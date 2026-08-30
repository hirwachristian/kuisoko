import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, ChevronLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import { ChatMessage, ChatConversation } from '../types';

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 5000;

const formatTime = (dateString: string) => {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const AdminMessages: React.FC = () => {
  const { token, showToast } = useAppContext();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversation list, refreshed periodically so new customer threads show up without a reload.
  useEffect(() => {
    let cancelled = false;
    const fetchConversations = async () => {
      try {
        const { conversations: fetched } = await apiFetch<{ conversations: ChatConversation[] }>('/chat/conversations', {}, token);
        if (!cancelled) setConversations(fetched);
      } catch (e) {
        console.error('Error fetching conversations:', e);
      }
    };
    fetchConversations();
    const interval = setInterval(fetchConversations, LIST_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  // Selected thread, refreshed while open - the GET marks the customer's messages as read by admin.
  useEffect(() => {
    if (!selectedUserId) return;
    let cancelled = false;
    const fetchMessages = async () => {
      try {
        const { messages: fetched } = await apiFetch<{ messages: ChatMessage[] }>(`/chat/messages/${selectedUserId}`, {}, token);
        if (!cancelled) {
          setMessages(fetched);
          setConversations(prev => prev.map(c => c.userId === selectedUserId ? { ...c, unreadCount: 0 } : c));
        }
      } catch (e) {
        console.error('Error fetching conversation:', e);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, THREAD_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedUserId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || !selectedUserId || isSending) return;
    setIsSending(true);
    setInput('');
    try {
      const { message } = await apiFetch<{ message: ChatMessage }>(`/chat/messages/${selectedUserId}`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }, token);
      setMessages(prev => [...prev, message]);
      setConversations(prev => prev.map(c => c.userId === selectedUserId
        ? { ...c, lastMessageBody: body, lastMessageAt: message.createdAt, lastMessageSenderRole: 'admin' }
        : c));
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not send the reply.', 'error');
      setInput(body);
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

  const selectedConversation = conversations.find(c => c.userId === selectedUserId) || null;

  return (
    <>
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-6 sticky top-0 z-10 transition-colors duration-300">
        <div className="flex flex-col gap-1 max-w-[1200px] mx-auto w-full">
          <h1 className="text-3xl font-black text-slate-900 dark:text-emerald-50 tracking-tight">Messages</h1>
          <p className="text-slate-500 dark:text-emerald-300 text-sm mt-1">Chat with customers who've reached out for support.</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full dark:bg-slate-950 transition-colors duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex h-[calc(100vh_-_220px)] min-h-[480px]">
          {/* Conversation list - on mobile this and the thread pane are mutually exclusive (a
              master-detail pattern) since there isn't room to show both side by side; sm+ shows
              both panes together as before. */}
          <div className={`${selectedUserId ? 'hidden sm:block' : 'block'} w-full sm:w-72 border-r border-slate-100 dark:border-slate-800 overflow-y-auto shrink-0`}>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">No conversations yet.</div>
            ) : conversations.map((c) => (
              <button
                key={c.userId}
                onClick={() => setSelectedUserId(c.userId)}
                className={`w-full text-left px-5 py-4 border-b border-slate-50 dark:border-slate-800 transition-colors ${
                  selectedUserId === c.userId ? 'bg-emerald-50 dark:bg-emerald-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-slate-900 dark:text-emerald-50 truncate">{c.name}</p>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full">
                      {c.unreadCount > 9 ? '9+' : c.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatTime(c.lastMessageAt)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                  {c.lastMessageSenderRole === 'admin' ? 'You: ' : ''}{c.lastMessageBody}
                </p>
              </button>
            ))}
          </div>

          {/* Selected conversation */}
          <div className={`${selectedUserId ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0`}>
            {!selectedConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 gap-3">
                <MessageCircle size={48} />
                <p className="text-sm text-slate-400 dark:text-slate-500">Select a conversation to view messages.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="sm:hidden -ml-2 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-emerald-50">{selectedConversation.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{selectedConversation.email}</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-slate-50 dark:bg-slate-950">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.senderRole === 'admin'
                          ? 'bg-emerald-700 text-white rounded-br-md'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className={`text-[10px] mt-1 ${msg.senderRole === 'admin' ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a reply..."
                    disabled={isSending}
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-emerald-100 disabled:opacity-60"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isSending || !input.trim()}
                    className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                    aria-label="Send reply"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminMessages;
