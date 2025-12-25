import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadAdSenseScript } from '../services/adsense';

type ConsentChoice = 'accepted' | 'declined' | null;

const CONSENT_KEY = 'slidemino-cookie-consent';

const getConsent = (): ConsentChoice => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'declined') return value;
    return null;
  } catch {
    return null;
  }
};

const notifyConsentChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('slidemino-consent-change'));
};

export const CookieConsent: React.FC = () => {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = getConsent();
    if (consent === 'accepted') {
      loadAdSenseScript('personalized');
      return;
    }
    if (consent === 'declined') {
      loadAdSenseScript('nonPersonalized');
      return;
    }
    const timer = window.setTimeout(() => setShowBanner(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch {
      // Ignore storage errors and proceed for this session.
    }
    loadAdSenseScript('personalized');
    notifyConsentChange();
    setShowBanner(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'declined');
    } catch {
      // Ignore storage errors and proceed for this session.
    }
    loadAdSenseScript('nonPersonalized');
    notifyConsentChange();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      <div className="mx-auto w-full max-w-2xl px-4 pb-4">
        <div className="rounded-2xl border border-white/50 bg-white/80 backdrop-blur-glass shadow-glass p-4 md:p-5 text-sm text-gray-700">
          <div className="font-semibold text-gray-900 mb-2">{t('modals:cookie.title')}</div>
          <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
            {t('modals:cookie.message')}{' '}
            <a href="#/privacy" className="underline text-gray-800 hover:text-gray-900">
              {t('modals:cookie.learnMore')}
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-xs font-semibold text-gray-700 border border-gray-300/80 rounded-full hover:bg-gray-100 transition"
            >
              {t('common:buttons.decline')}
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 text-xs font-semibold text-white bg-gray-900 rounded-full hover:bg-black transition"
            >
              {t('common:buttons.accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
