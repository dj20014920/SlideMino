const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5319827978116991';

export type AdSenseMode = 'personalized' | 'nonPersonalized';

export const loadAdSenseScript = (mode: AdSenseMode = 'personalized'): void => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const win = window as unknown as { adsbygoogle?: { requestNonPersonalizedAds?: number }[] };
  win.adsbygoogle = win.adsbygoogle || [];
  win.adsbygoogle.requestNonPersonalizedAds = mode === 'nonPersonalized' ? 1 : 0;

  if (document.querySelector('script[data-adsense="true"]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = ADSENSE_SRC;
  script.crossOrigin = 'anonymous';
  script.setAttribute('data-adsense', 'true');
  document.head.appendChild(script);
};
