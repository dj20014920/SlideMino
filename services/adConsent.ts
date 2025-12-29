export type ConsentChoice = 'accepted' | 'declined' | null;

const CONSENT_KEY = 'slidemino-cookie-consent';
const CONSENT_EVENT = 'slidemino-consent-change';

export const getCookieConsent = (): ConsentChoice => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'declined') return value;
    return null;
  } catch {
    return null;
  }
};

export const setCookieConsent = (choice: Exclude<ConsentChoice, null>): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Ignore storage errors and proceed for this session.
  }
};

export const notifyCookieConsentChange = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_EVENT));
};

export const onCookieConsentChange = (handler: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONSENT_EVENT, handler);
  return () => window.removeEventListener(CONSENT_EVENT, handler);
};
