import React, { useEffect, useMemo, useState } from 'react';
import { loadAdSenseScript } from '../services/adsense';
import { acquireNativeBannerAd, releaseNativeBannerAd } from '../services/admob';
import { isNativeApp } from '../utils/platform';

import { getCookieConsent, onCookieConsentChange } from '../services/adConsent';

const AdBanner: React.FC = () => {
    const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null);

    const native = isNativeApp();

    const getNativeBannerHeightPx = (): number => {
        if (typeof window === 'undefined') return 50;
        // Standard banner heights: phone ~50dp, tablet ~90dp.
        // We approximate based on viewport width.
        return window.innerWidth >= 768 ? 90 : 50;
    };

    const [nativeBannerHeightPx, setNativeBannerHeightPx] = useState(() => getNativeBannerHeightPx());

    useEffect(() => {
        if (!native) return;
        const handleResize = () => setNativeBannerHeightPx(getNativeBannerHeightPx());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [native]);

    useEffect(() => {
        if (!native) return;
        // Native (iOS/Android): use AdMob banner only.
        // The banner is drawn by native SDK, not by <ins />.
        void acquireNativeBannerAd();
        return () => {
            void releaseNativeBannerAd();
        };
    }, [native]);

    useEffect(() => {
        if (native) return;
        const readConsent = () => setConsent(getCookieConsent());

        readConsent();

        const unsubscribe = onCookieConsentChange(readConsent);
        return unsubscribe;
    }, [native]);

    useEffect(() => {
        if (native) return;
        if (!consent) return;
        const mode = consent === 'declined' ? 'nonPersonalized' : 'personalized';
        loadAdSenseScript(mode);
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error('AdSense error:', err);
        }
    }, [consent, native]);

    if (native) {
        // Reserve minimal space so bottom UI isn't covered by the native banner.
        return (
            <div
                className="w-full"
                style={{ height: `calc(${nativeBannerHeightPx}px + var(--app-safe-bottom))` }}
            />
        );
    }

    return (
        <div className="relative w-full flex justify-center items-center bg-gray-50/50 min-h-[50px] transition-all duration-300">
            {/* 
            Google AdSense Display Unit 
            Replace YOUR_AD_SLOT_ID with your actual Ad Slot ID from Google AdSense dashboard 
        */}
            <ins
                className="adsbygoogle"
                style={{ display: 'block', width: '100%' }}
                data-ad-client="ca-pub-5319827978116991"
                data-ad-slot="YOUR_AD_SLOT_ID"
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
            {/* Placeholder for development/preview when ad blocks usage or ID is invalid */}
            {process.env.NODE_ENV === 'development' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 border border-gray-300 text-gray-400 text-xs text-center p-2 opacity-50 pointer-events-none">
                    {consent ? 'AdBanner (Slot ID Required)' : 'AdBanner (Awaiting Consent)'}
                </div>
            )}
        </div>
    );
};

export default AdBanner;
