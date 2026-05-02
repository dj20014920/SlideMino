import React from 'react';
import { isNativeApp } from '../utils/platform';

interface AppDownloadBannerProps {
  isPremiumUiThemeActive?: boolean;
}

export default function AppDownloadBanner({ isPremiumUiThemeActive }: AppDownloadBannerProps) {
  if (isNativeApp()) return null;

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const isDesktop = !isAndroid && !isIOS;

  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.slidemino.app';
  const appStoreUrl = 'https://apps.apple.com/kr/app/%EB%B8%94%EB%A1%9D-%EC%8A%AC%EB%9D%BC%EC%9D%B4%EB%93%9C-block-slide/id6757861065';
  const storeUrl = isAndroid ? playStoreUrl : isIOS ? appStoreUrl : playStoreUrl;

  if (isDesktop) {
    const desktopTextColor = isPremiumUiThemeActive
      ? 'text-white/60'
      : 'text-gray-500';
    const desktopLinkColor = isPremiumUiThemeActive
      ? 'text-white/80 hover:text-white bg-white/10 hover:bg-white/20'
      : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200';

    return (
      <div className={`w-full max-w-xs flex items-center gap-2 px-3 py-2.5 rounded-2xl ${
        isPremiumUiThemeActive
          ? 'bg-white/10 backdrop-blur-sm border border-white/10'
          : 'bg-gray-50 border border-gray-100'
      }`}>
        <span className={`text-xs ${desktopTextColor} flex-shrink-0`}>앱 다운로드</span>
        <a href={playStoreUrl} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-medium ${desktopLinkColor} px-2 py-1 rounded-lg transition-colors`}>
          Google Play
        </a>
        <a href={appStoreUrl} target="_blank" rel="noopener noreferrer"
          className={`text-xs font-medium ${desktopLinkColor} px-2 py-1 rounded-lg transition-colors`}>
          App Store
        </a>
      </div>
    );
  }

  const storeLabel = isAndroid ? 'Google Play' : 'App Store';

  if (isPremiumUiThemeActive) {
    return (
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-xl
          bg-white/10 backdrop-blur-sm border border-white/15
          hover:bg-white/20 hover:border-white/25
          active:scale-[0.98]
          transition-all duration-200 ease-out
          text-white/90 hover:text-white
          no-underline"
      >
        <span className="flex-1 text-sm font-medium leading-snug">
          {'앱에서 더 많은 기능을 즐겨보세요'}
        </span>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/15 text-white/80 flex-shrink-0">
          {storeLabel}
        </span>
      </a>
    );
  }

  return (
    <a
      href={storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full max-w-xs flex items-center gap-3 px-4 py-3 rounded-2xl
        bg-white/80 backdrop-blur-sm border border-gray-200
        hover:bg-white hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5
        active:translate-y-0 active:shadow-sm
        transition-all duration-200 ease-out
        text-gray-700 hover:text-gray-900
        no-underline shadow-sm"
    >
      <span className="flex-1 text-sm font-medium leading-snug">
        {'앱에서 더 많은 기능을 즐겨보세요'}
      </span>
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
        {storeLabel}
      </span>
    </a>
  );
}