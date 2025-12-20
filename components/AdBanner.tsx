import React, { useEffect } from 'react';

const AdBanner: React.FC = () => {
    useEffect(() => {
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error('AdSense error:', err);
        }
    }, []);

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
                    AdBanner (Slot ID Required)
                </div>
            )}
        </div>
    );
};

export default AdBanner;
