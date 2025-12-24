import React, { useEffect, useState } from 'react';
import { loadAdSenseScript } from '../services/adsense';

const AdBanner: React.FC = () => {
    const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null);

    useEffect(() => {
        const readConsent = () => {
            try {
                const stored = localStorage.getItem('slidemino-cookie-consent');
                if (stored === 'accepted' || stored === 'declined') {
                    setConsent(stored);
                    return;
                }
                setConsent(null);
            } catch {
                setConsent(null);
            }
        };

        readConsent();

        const handleConsentChange = () => readConsent();
        window.addEventListener('slidemino-consent-change', handleConsentChange);
        return () => window.removeEventListener('slidemino-consent-change', handleConsentChange);
    }, []);

    useEffect(() => {
        if (!consent) return;
        const mode = consent === 'declined' ? 'nonPersonalized' : 'personalized';
        loadAdSenseScript(mode);
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error('AdSense error:', err);
        }
    }, [consent]);

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
