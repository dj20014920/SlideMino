import React, { useEffect, useState } from 'react';
import { loadAdSenseScript } from '../services/adsense';
import { isNativeApp, isAppIntoS } from '../utils/platform';
import { getCookieConsent, onCookieConsentChange } from '../services/adConsent';
import { bannerAdService } from '../services/bannerAdService';
import { isVirtualDevice } from '../services/admob';

const AdBanner: React.FC = () => {
    const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null);

    const native = isNativeApp();
    const appIntoS = isAppIntoS();

    const getNativeBannerHeightPx = (): number => {
        if (typeof window === 'undefined') return 50;
        // Standard banner heights: phone ~50dp, tablet ~90dp.
        // We approximate based on viewport width.
        return window.innerWidth >= 768 ? 90 : 50;
    };

    const [nativeBannerHeightPx, setNativeBannerHeightPx] = useState(() => getNativeBannerHeightPx());
    const [nativeBannerAllowed, setNativeBannerAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        if (!native) return;
        const handleResize = () => setNativeBannerHeightPx(getNativeBannerHeightPx());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [native]);

    useEffect(() => {
        if (!native) return;
        let mounted = true;
        isVirtualDevice()
            .then((virtual) => {
                if (mounted) setNativeBannerAllowed(!virtual);
            })
            .catch(() => {
                if (mounted) setNativeBannerAllowed(true);
            });
        return () => {
            mounted = false;
        };
    }, [native]);

    useEffect(() => {
        // 🆕 앱인토스 또는 네이티브: 중앙집중형 배너 서비스 사용
        if (appIntoS || native) {
            if (native && nativeBannerAllowed === false) return;
            if (native && nativeBannerAllowed === null) return;
            bannerAdService.showBanner();
            return () => {
                bannerAdService.hideBanner();
            };
        }
    }, [native, appIntoS, nativeBannerAllowed]);

    useEffect(() => {
        // 앱인토스에서는 AdSense 쿠키 동의 불필요
        if (appIntoS) return;
        if (native) return;
        const readConsent = () => setConsent(getCookieConsent());

        readConsent();

        const unsubscribe = onCookieConsentChange(readConsent);
        return unsubscribe;
    }, [native, appIntoS]);

    useEffect(() => {
        // 앱인토스에서는 AdSense 로드하지 않음
        if (appIntoS) return;
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
    }, [consent, native, appIntoS]);

    // 네이티브(앱인토스 포함): 네이티브 SDK가 직접 배너를 그리므로 공간만 확보
    if (native || appIntoS) {
        if (native && nativeBannerAllowed === false) return null;
        if (native && nativeBannerAllowed === null) return null;
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
