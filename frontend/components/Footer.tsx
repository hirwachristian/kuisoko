

import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import KuISOKOLogoSVG from './KuISOKOLogoSVG';
import TikTokIcon from './TikTokIcon';
import WhatsAppIcon from './WhatsAppIcon';
import { useAppContext } from '../context/AppContext';

const Footer = () => {
  const { footerSettings, toggleFAQ, toggleShippingPolicy, toggleTermsOfService, togglePrivacyPolicy, user, isSubscribed, subscribeToNewsletter, unsubscribeFromNewsletter, t } = useAppContext();
  const { locationLines, phoneNumber, whatsappNumber, emailAddress, quickLinks, supportLinks, copyrightText } = footerSettings;
  const effectiveWhatsappNumber = whatsappNumber || phoneNumber;
  const whatsappUrl = `https://wa.me/${effectiveWhatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(t('contact_whatsapp_default_message'))}`;
  const [isProcessingSubscription, setIsProcessingSubscription] = React.useState(false);
  const [newsletterEmail, setNewsletterEmail] = React.useState('');

  React.useEffect(() => {
    setNewsletterEmail(user ? user.email : '');
  }, [user]);

  const handleSubscriptionToggle = async () => {
    setIsProcessingSubscription(true);
    if (isSubscribed) {
      await unsubscribeFromNewsletter();
    } else {
      await subscribeToNewsletter();
    }
    setIsProcessingSubscription(false);
  };

  const googleMapsBaseUrl = "https://www.google.com/maps/search/?api=1&query=";
  const encodedLocation = encodeURIComponent(locationLines.join(', '));
  const googleMapsUrl = `${googleMapsBaseUrl}${encodedLocation}`;

  return (
  <footer className="bg-emerald-950 dark:bg-slate-950 text-emerald-100/60 dark:text-slate-400 py-12 transition-colors duration-300">
    <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div className="col-span-1 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <KuISOKOLogoSVG className="h-6 w-auto" />
          </Link>
          <p className="text-sm leading-relaxed text-emerald-100/60 dark:text-slate-400 mb-5">
            {t('footer_tagline')}
          </p>

          {/* Newsletter - small horizontal subscribe bar, always shown in this form; signing in
              is only required at the moment of hitting Subscribe, not to see the form itself. */}
          <div className="flex items-center gap-1.5">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={t('footer_newsletter_placeholder')}
              className="flex-1 min-w-0 px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-orange-400 text-xs text-white placeholder:text-emerald-100/40 dark:placeholder:text-slate-500"
            />
            <button
              onClick={handleSubscriptionToggle}
              disabled={isProcessingSubscription}
              className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white font-black px-4 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-60 text-xs whitespace-nowrap"
            >
              {isProcessingSubscription
                ? (isSubscribed ? t('footer_newsletter_unsubscribing') : t('home_joining'))
                : (isSubscribed ? t('footer_newsletter_unsubscribe') : t('home_subscribe'))}
            </button>
          </div>
          <p className="text-[11px] text-emerald-100/40 dark:text-slate-500 uppercase tracking-wide mt-3">
            {t('footer_newsletter_disclaimer')}
          </p>

          <div className="mt-5">
            <p className="text-[11px] font-semibold text-emerald-100/40 dark:text-slate-500 uppercase tracking-wide mb-2.5">
              {t('footer_follow_us')}
            </p>
            <div className="flex items-center gap-2.5">
              <span
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-emerald-100/40 dark:text-slate-500 cursor-default"
                aria-label={t('footer_instagram_aria')}
                title={t('footer_instagram_aria')}
              >
                <Instagram size={16} />
              </span>
              <span
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-emerald-100/40 dark:text-slate-500 cursor-default"
                aria-label={t('footer_tiktok_aria')}
                title={t('footer_tiktok_aria')}
              >
                <TikTokIcon size={15} />
              </span>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-emerald-100/60 dark:text-slate-400 hover:bg-green-500 hover:text-white transition-colors"
                aria-label={t('footer_whatsapp_aria')}
                title={t('footer_whatsapp_aria')}
              >
                <WhatsAppIcon size={16} />
              </a>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-white dark:text-emerald-50 font-semibold mb-4">{t('footer_quick_links')}</h4>
          <ul className="space-y-2 text-sm">
            {quickLinks.map((link, index) => (
              <li key={index}><Link to={link.to} className="hover:text-orange-400 dark:hover:text-emerald-400">{link.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white dark:text-emerald-50 font-semibold mb-4">{t('footer_support')}</h4>
          <ul className="space-y-2 text-sm">
            {supportLinks.map((link, index) => (
              <li key={index}>
                {link.label === 'FAQ' ? (
                  <button onClick={toggleFAQ} className="hover:text-orange-400 dark:hover:text-emerald-400">
                    {link.label}
                  </button>
                ) : link.label === 'Shipping Policy' ? (
                  <button onClick={toggleShippingPolicy} className="hover:text-orange-400 dark:hover:text-emerald-400">
                    {link.label}
                  </button>
                ) : link.label === 'Terms of Service' ? (
                  <button onClick={toggleTermsOfService} className="hover:text-orange-400 dark:hover:text-emerald-400">
                    {link.label}
                  </button>
                ) : link.label === 'Privacy Policy' ? (
                  <button onClick={togglePrivacyPolicy} className="hover:text-orange-400 dark:hover:text-emerald-400">
                    {link.label}
                  </button>
                ) : (
                  <a href={link.to} className="hover:text-orange-400 dark:hover:text-emerald-400">
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white dark:text-emerald-50 font-semibold mb-4">{t('footer_contact_info')}</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <p className="font-medium text-white dark:text-emerald-50">{t('footer_location')}</p>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-orange-400 dark:hover:text-emerald-400"
                aria-label={t('footer_view_location_aria')}
              >
                {locationLines.map((line, index) => (
                  <p key={index} className="text-emerald-100/60 dark:text-slate-400">{line}</p>
                ))}
              </a>
            </li>
            <li className="pt-2">
              <p className="font-medium text-white dark:text-emerald-50">{t('footer_call_us')}</p>
              <a href={`tel:${phoneNumber}`} className="hover:text-orange-400 dark:hover:text-emerald-400 text-emerald-100/60 dark:text-slate-400" aria-label={`${t('footer_call_us')} ${phoneNumber}`}>
                {phoneNumber}
              </a>
            </li>
            <li className="pt-2">
              <p className="font-medium text-white dark:text-emerald-50">{t('footer_email')}</p>
              <a href={`mailto:${emailAddress}`} className="hover:text-orange-400 dark:hover:text-emerald-400 text-emerald-100/60 dark:text-slate-400" aria-label={`${t('footer_email')} ${emailAddress}`}>
                {emailAddress}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-emerald-900 dark:border-slate-800 pt-8 text-center text-xs text-emerald-100/20 dark:text-slate-600">
        {copyrightText}
      </div>
    </div>
  </footer>
);
}

export default Footer;
