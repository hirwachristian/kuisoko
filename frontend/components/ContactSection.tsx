import React, { useState } from 'react';
import { MapPin, Phone, Mail, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { apiFetch, ApiError } from '../api';
import WhatsAppIcon from './WhatsAppIcon';

const ContactSection: React.FC = () => {
  const { footerSettings, showToast, t } = useAppContext();
  const { locationLines, phoneNumber, whatsappNumber, emailAddress } = footerSettings;
  const effectiveWhatsappNumber = whatsappNumber || phoneNumber;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLines.join(', '))}`;
  const whatsappUrl = `https://wa.me/${effectiveWhatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(t('contact_whatsapp_default_message'))}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      showToast(t('contact_form_error'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiFetch('/enquiries', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });
      showToast(t('contact_form_success'), 'success');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('contact_form_submit_error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const infoCards = [
    { icon: MapPin, labelKey: 'contact_info_location', content: locationLines.join(', '), href: googleMapsUrl, iconClassName: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' },
    { icon: Phone, labelKey: 'contact_info_phone', content: phoneNumber, href: `tel:${phoneNumber}`, iconClassName: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' },
    { icon: Mail, labelKey: 'contact_info_email', content: emailAddress, href: `mailto:${emailAddress}`, iconClassName: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' },
    { icon: WhatsAppIcon, labelKey: 'contact_info_whatsapp', content: effectiveWhatsappNumber, href: whatsappUrl, iconClassName: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400' },
  ];

  return (
    <section id="contact" className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8" style={{ scrollMarginTop: 'var(--header-offset, 112px)' }}>
      <div className="flex flex-col items-center text-center mb-10">
        <span className="text-emerald-800 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-1.5 block">{t('contact_hero_title')}</span>
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-emerald-50 tracking-tighter mb-3">{t('contact_form_title')}</h2>
        <p className="text-slate-500 dark:text-emerald-300 text-sm md:text-base max-w-xl">{t('contact_hero_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          {infoCards.map((card, i) => (
            <a
              key={i}
              href={card.href}
              target={card.href.startsWith('http') ? '_blank' : undefined}
              rel={card.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="flex items-start gap-4 bg-white dark:bg-slate-900 rounded-[1.75rem] p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${card.iconClassName}`}>
                <card.icon size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t(card.labelKey)}</p>
                <p className="font-bold text-slate-900 dark:text-emerald-50 break-words">{card.content}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-10 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-section-name" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">{t('contact_form_name')}</label>
                <input
                  id="contact-section-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 transition-all"
                />
              </div>
              <div>
                <label htmlFor="contact-section-email" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">{t('contact_form_email')}</label>
                <input
                  id="contact-section-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 transition-all"
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-section-subject" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">{t('contact_form_subject')}</label>
              <input
                id="contact-section-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 transition-all"
              />
            </div>
            <div>
              <label htmlFor="contact-section-message" className="block text-sm font-semibold text-slate-700 dark:text-emerald-300 mb-2">{t('contact_form_message')}</label>
              <textarea
                id="contact-section-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('contact_form_message_placeholder')}
                className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-800 dark:focus:ring-emerald-600 text-sm text-slate-900 dark:text-emerald-100 transition-all resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-black transition-all shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? t('contact_form_submitting') : t('contact_form_submit')}
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
