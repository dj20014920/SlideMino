import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAdSenseScript } from '../services/adsense';
import { isNativeApp, isAppIntoS } from '../utils/platform';
import { getCookieConsent, onCookieConsentChange } from '../services/adConsent';
import { bannerAdService } from '../services/bannerAdService';
import { isScreenshotMode } from '../services/adConfig';
import { trackAnalyticsEvent } from '../services/analyticsService';

interface AdBannerProps {
    /** 네이티브 배너를 하단 고정 UI 위로 띄우기 위한 margin (px) */
    nativeBottomMarginPx?: number;
    /** 네이티브 배너 공간을 현재 레이아웃에 인라인으로 예약할지 여부 */
    reserveNativeSpace?: boolean;
    /** 인라인 예약 공간에 safe-bottom을 포함할지 여부 */
    includeSafeBottomInReservedSpace?: boolean;
    /** 배너를 fixed로 배치하여 특정 요소 바로 위에 붙일지 여부 */
    fixedPosition?: 'above-bottom-nav' | 'above-bottom-nav-no-safe';
}

const AdBanner: React.FC<AdBannerProps> = ({
    nativeBottomMarginPx = 0,
    reserveNativeSpace = true,
    includeSafeBottomInReservedSpace = true,
    fixedPosition,
}) => {
    if (isScreenshotMode()) return null;
    const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null);

    const native = isNativeApp();
    const appIntoS = isAppIntoS();

    const getNativeBannerFallbackHeightPx = (): number => 50;

    const [nativeBannerHeightPx, setNativeBannerHeightPx] = useState(() => {
        const measured = bannerAdService.getCurrentBannerHeightPx();
        return measured > 0 ? measured : getNativeBannerFallbackHeightPx();
    });
    const adSlotRef = useRef<HTMLElement | null>(null);
    const webImpressionTrackedRef = useRef(false);

    const handleResize = useCallback(() => {
        setNativeBannerHeightPx((prev) => (prev > 0 ? prev : getNativeBannerFallbackHeightPx()));
    }, []);

    useEffect(() => {
        if (!native) return;
        const applyFallback = () => {
            setNativeBannerHeightPx((prev) => (prev > 0 ? prev : getNativeBannerFallbackHeightPx()));
        };
        const unsubscribe = bannerAdService.onBannerSizeChange((height) => {
            setNativeBannerHeightPx(height > 0 ? height : getNativeBannerFallbackHeightPx());
        });

        applyFallback();
        window.addEventListener('resize', handleResize);
        window.visualViewport?.addEventListener('resize', handleResize);
        return () => {
            unsubscribe();
            window.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('resize', handleResize);
        };
    }, [native, handleResize]);

    const nativeBottomMarginForSdk = useMemo(() => {
        const normalized = Math.max(0, Math.round(nativeBottomMarginPx));
        return normalized;
    }, [nativeBottomMarginPx]);

    useEffect(() => {
        // 🆕 앱인토스 또는 네이티브: 중앙집중형 배너 서비스 사용
        if (appIntoS || native) {
            bannerAdService.showBanner({ bottomMarginPx: nativeBottomMarginForSdk });
            return () => {
                bannerAdService.hideBanner();
            };
        }
    }, [native, appIntoS, nativeBottomMarginForSdk]);

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
            if (import.meta.env.DEV) console.error('AdSense error:', err);
        }
        const slotElement = adSlotRef.current;
        if (!slotElement || webImpressionTrackedRef.current) return;

        if (typeof IntersectionObserver === 'undefined') {
            webImpressionTrackedRef.current = true;
            trackAnalyticsEvent({
                name: 'ad_banner_impression',
                meta: { source: 'adsense-web' },
            });
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (webImpressionTrackedRef.current) return;
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                webImpressionTrackedRef.current = true;
                trackAnalyticsEvent({
                    name: 'ad_banner_impression',
                    meta: { source: 'adsense-web' },
                });
                observer.disconnect();
                break;
            }
        }, { threshold: 0.2 });

        observer.observe(slotElement);
        return () => observer.disconnect();
    }, [consent, native, appIntoS]);

    // 네이티브(앱인토스 포함): 네이티브 SDK가 직접 배너를 그리므로 공간만 확보
    if (native || appIntoS) {
        if (!reserveNativeSpace && !fixedPosition) return null;
        
        // fixed 모드: BottomNavBar 바로 위에 딱 붙임
        if (fixedPosition) {
            const bottomValue = fixedPosition === 'above-bottom-nav-no-safe'
                ? 'var(--bottom-nav-height, 64px)'
                : 'calc(var(--bottom-nav-height, 64px) + var(--app-safe-bottom, 0px))';
            return (
                <div
                    className="w-full"
                    style={{
                        position: 'fixed',
                        left: 0,
                        right: 0,
                        bottom: bottomValue,
                        height: `${nativeBannerHeightPx}px`,
                        zIndex: 99,
                    }}
                />
            );
        }
        
        return (
            <div
                className="w-full"
                style={{
                    height: includeSafeBottomInReservedSpace
                        ? `calc(${nativeBannerHeightPx}px + var(--app-safe-bottom))`
                        : `${nativeBannerHeightPx}px`,
                }}
            />
        );
    }

    // 웹용 AdSense 렌더링
    const adContent = (
        <div className="relative w-full flex justify-center items-center min-h-[50px] transition-all duration-300">
            {/*
            Google AdSense Display Unit
            Replace YOUR_AD_SLOT_ID with your actual Ad Slot ID from Google AdSense dashboard
        */}
            <ins
                ref={(node) => {
                    adSlotRef.current = node;
                }}
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

    // fixed 모드: BottomNavBar 바로 위에 딱 붙임
    if (fixedPosition) {
        const bottomValue = fixedPosition === 'above-bottom-nav-no-safe'
            ? 'var(--bottom-nav-height, 64px)'
            : 'calc(var(--bottom-nav-height, 64px) + var(--app-safe-bottom, 0px))';
        return (
            <div
                className="w-full"
                style={{
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: bottomValue,
                    zIndex: 99,
                }}
            >
                {adContent}
            </div>
        );
    }

    return adContent;
};

export default AdBanner;
