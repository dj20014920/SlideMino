import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Palette, Trophy, ClipboardList, Calendar, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isNativeApp } from '../utils/platform';
import { bannerAdService } from '../services/bannerAdService';
import { useBlockCustomization } from '../context/BlockCustomizationContext';

/** 네이티브 배너 광고 fallback 높이 (표준 배너 50dp) */
function getNativeBannerHeightPx(): number {
  return 50;
}

/** 프리미엄 UI에서 네비 높이를 가져오는 유틸. navHeightPx=0이면 기본값(NAV_HEIGHT_DEFAULT) 사용 */
export const NAV_HEIGHT_DEFAULT = 64;
export const getEstimatedBottomNavHeight = (
  isPremiumUi: boolean,
  navHeightPx: number = 0,
): number =>
  isPremiumUi ? (navHeightPx > 0 ? navHeightPx : NAV_HEIGHT_DEFAULT) : NAV_HEIGHT_DEFAULT;

/**
 * 하단 전체 점유 높이를 CSS 변수로 내보내는 훅.
 * BottomNavBar + AdBanner + safe-area를 합산하여
 * --bottom-chrome-height CSS 변수를 설정한다.
 * 이를 통해 메인 콘텐츠가 동적으로 paddingBottom을 계산할 수 있다.
 */
function useBottomChromeHeight(navHeight: number) {
  const [adHeight, setAdHeight] = useState(() => {
    if (!isNativeApp()) return 0;
    const measured = bannerAdService.getCurrentBannerHeightPx();
    return measured > 0 ? measured : getNativeBannerHeightPx();
  });

  useEffect(() => {
    if (!isNativeApp()) {
      setAdHeight(0);
      return;
    }
    const applyFallback = () => {
      const measured = bannerAdService.getCurrentBannerHeightPx();
      setAdHeight(measured > 0 ? measured : getNativeBannerHeightPx());
    };
    const unsubscribe = bannerAdService.onBannerSizeChange((height) => {
      setAdHeight(height > 0 ? height : getNativeBannerHeightPx());
    });
    const handleResize = () => applyFallback();
    applyFallback();
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  // CSS 변수로 전체 하단 점유 높이를 노출 (콘텐츠 paddingBottom에 사용)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bottom-nav-height', `${Math.max(0, Math.round(navHeight))}px`);
    root.style.setProperty('--bottom-ad-height', `${Math.max(0, Math.round(adHeight))}px`);
    // nav 측정값은 콘텐츠 높이만 포함(safe area 미포함),
    // outer div의 paddingBottom이 safe area를 담당하므로 여기서 합산한다.
    root.style.setProperty(
      '--bottom-chrome-height',
      'calc(var(--bottom-nav-height, 0px) + var(--bottom-ad-height, 0px) + var(--app-safe-bottom, 0px))'
    );
    return () => {
      root.style.removeProperty('--bottom-nav-height');
      root.style.removeProperty('--bottom-ad-height');
      root.style.removeProperty('--bottom-chrome-height');
    };
  }, [navHeight, adHeight]);

  return adHeight;
}

export interface BottomNavBarProps {
  showSkin: boolean;
  showCustomization: boolean;
  customizationLocked: boolean;
  customizationLockReason: string;
  missionUnlocked: boolean;
  calendarUnlocked: boolean;
  dailyMissionCompleted: number;
  calendarPendingCount: number;
  isPremiumUiThemeActive: boolean;
  onSkinPress: () => void;
  onCustomizationPress: () => void;
  onLeaderboardPress: () => void;
  onMissionPress: () => void;
  onCalendarPress: () => void;
  onHeightChange?: (height: number) => void;
}

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  badge?: number | string;
  /** 항상 true — 4개 아이템은 네이티브에서 항상 표시 */
  visible: boolean;
  /** 해금 전 잠금 상태 여부 */
  locked: boolean;
  /** 잠금 시 탭했을 때 표시할 안내 문구 */
  lockMessage?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  showSkin,
  showCustomization,
  missionUnlocked,
  calendarUnlocked,
  customizationLocked,
  customizationLockReason,
  dailyMissionCompleted,
  calendarPendingCount,
  isPremiumUiThemeActive,
  onSkinPress,
  onCustomizationPress,
  onLeaderboardPress,
  onMissionPress,
  onCalendarPress,
  onHeightChange,
}) => {
  const { t } = useTranslation();
  const { premiumUiObjects } = useBlockCustomization();
  const premiumUiTaskbarWrapperClassName = premiumUiObjects.extended.navigation.taskbarWrapperClassName;
  const premiumUiTaskbarClassName = premiumUiObjects.extended.navigation.taskbarClassName;
  const premiumUiTaskbarButtonClassName = premiumUiObjects.extended.navigation.taskbarButtonClassName;
  const premiumUiTaskbarBadgeClassName = premiumUiObjects.extended.navigation.taskbarBadgeClassName;
  const premiumUiLockToastClassName = premiumUiObjects.extended.navigation.lockToastClassName;
  const premiumUiNavHeightPx = premiumUiObjects.extended.navigation.navHeightPx;
  const navMeasureRef = useRef<HTMLElement | null>(null);
  const [navHeight, setNavHeight] = useState<number>(() => getEstimatedBottomNavHeight(isPremiumUiThemeActive, premiumUiNavHeightPx));
  useBottomChromeHeight(navHeight);

  // 잠금 안내 토스트 상태
  const [lockToast, setLockToast] = useState<string | null>(null);
  const lockToastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showLockToast = useCallback((msg: string) => {
    clearTimeout(lockToastTimerRef.current);
    setLockToast(msg);
    lockToastTimerRef.current = setTimeout(() => setLockToast(null), 2000);
  }, []);

  useEffect(() => () => clearTimeout(lockToastTimerRef.current), []);

  const navItems: NavItem[] = [
    {
      id: 'skin',
      icon: <Palette size={20} />,
      label: t('game:actions.skin'),
      onPress: showSkin ? onSkinPress : onCustomizationPress,
      visible: showSkin || showCustomization,
      locked: false,
    },
    {
      id: 'leaderboard',
      icon: <Trophy size={20} />,
      label: t('game:actions.leaderboard'),
      onPress: onLeaderboardPress,
      visible: true,
      locked: false,
    },
    {
      id: 'mission',
      icon: <ClipboardList size={20} />,
      label: t('game:missions.title'),
      onPress: onMissionPress,
      badge: missionUnlocked && dailyMissionCompleted < 3 ? `${dailyMissionCompleted}/3` : undefined,
      visible: true,
      locked: !missionUnlocked,
      lockMessage: String(t('game:actions.missionLocked', { count: 3 } as any)),
    },
    {
      id: 'calendar',
      icon: <Calendar size={20} />,
      label: t('common:calendar.title'),
      onPress: onCalendarPress,
      badge: calendarUnlocked && calendarPendingCount > 0 ? calendarPendingCount : undefined,
      visible: true,
      locked: !calendarUnlocked,
      lockMessage: String(t('game:actions.calendarLocked', { level: 5 } as any)),
    },
  ].filter(item => item.visible);

  const navLabelsKey = navItems.map((item) => item.label).join('|');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fallbackHeight = getEstimatedBottomNavHeight(isPremiumUiThemeActive, premiumUiNavHeightPx);
    const measure = () => {
      const measured = navMeasureRef.current?.getBoundingClientRect().height;
      const nextHeight = Math.max(0, Math.round(measured ?? fallbackHeight));
      setNavHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navMeasureRef.current) {
      observer = new ResizeObserver(measure);
      observer.observe(navMeasureRef.current);
    }

    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [isPremiumUiThemeActive, navItems.length, navLabelsKey]);

  useEffect(() => {
    onHeightChange?.(navHeight);
  }, [navHeight, onHeightChange]);

  // 프리미엄 UI 테마: 하단 태스크바 스타일
  // outer div가 paddingBottom으로 safe area를 담당 → 태스크바 자체 높이는 원래 크기 유지
  if (isPremiumUiThemeActive) {
    return (
      <div
        className={`fixed left-0 right-0 z-[100] premium-nav-wrapper-fallback ${premiumUiTaskbarWrapperClassName}`}
        style={{
          bottom: 0,
          paddingBottom: 0,
          backgroundClip: 'border-box',
        }}
      >
        {/* 잠금 안내 토스트 */}
        {lockToast && (
          <div className="flex justify-center mb-1 px-2">
            <div className={premiumUiLockToastClassName}>
              🔒 {lockToast}
            </div>
          </div>
        )}
        <div
          ref={(node) => {
            navMeasureRef.current = node;
          }}
          className={`premium-bottom-nav-fallback ${premiumUiTaskbarClassName}`}
          style={{
            paddingBottom: 'max(var(--app-safe-bottom, 0px), env(safe-area-inset-bottom))',
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              id={item.id === 'skin' ? 'menu-skin-btn' : undefined}
              data-tutorial-anchor={item.id === 'skin' ? 'menu-skin-btn' : undefined}
              onClick={item.locked ? () => showLockToast(item.lockMessage!) : item.onPress}
              className={`
                relative flex items-center gap-1 px-3 py-1 text-xs font-normal
                ${premiumUiTaskbarButtonClassName}
                ${item.locked ? 'opacity-45' : ''}
              `}
              style={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <span className="shrink-0">
                {item.locked ? <Lock size={14} /> : item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {!item.locked && item.badge != null && (
                <span className={`absolute -top-1 -right-1 ${premiumUiTaskbarBadgeClassName}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 기본 테마: 모던 글래스모피즘 하단 네비게이션
  // outer div: paddingBottom으로 safe area 배경 채움, inline background로 galaxy CSS override 방지
  // nav: 원래 compact 사이즈(py-1.5) 유지
  return (
    <div
      className="fixed left-0 right-0 z-[100]"
      style={{
        bottom: 0,
        paddingBottom: 0,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: '0 -1px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* 잠금 안내 토스트 */}
      {lockToast && (
        <div className="flex justify-center mb-1.5 px-4">
          <div className="px-4 py-1.5 rounded-full bg-gray-900/80 backdrop-blur text-white text-[11px] font-medium shadow-lg">
            🔒 {lockToast}
          </div>
        </div>
      )}
      <nav
        ref={(node) => {
          navMeasureRef.current = node;
        }}
        className="flex items-stretch justify-around px-1 py-1"
        style={{
          background: 'transparent',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderTop: 'none',
          boxShadow: 'none',
          paddingBottom: 'var(--app-safe-bottom, 0px)',
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            id={item.id === 'skin' ? 'menu-skin-btn' : undefined}
            data-tutorial-anchor={item.id === 'skin' ? 'menu-skin-btn' : undefined}
            onClick={item.locked ? () => showLockToast(item.lockMessage!) : item.onPress}
            className={`
              relative flex flex-col items-center justify-center
              gap-0.5 flex-1 py-1 px-1
              rounded-xl
              transition-all duration-150 ease-out
              ${item.locked
                ? 'text-gray-300'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/60 active:scale-95 active:bg-gray-200/60'
              }
            `}
          >
            <span className="relative">
              {item.locked ? <Lock size={18} className="text-gray-300" /> : item.icon}
              {!item.locked && item.badge != null && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="text-[10px] font-semibold leading-tight truncate max-w-[60px]">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};
