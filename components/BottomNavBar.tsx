import React, { useState, useEffect, useRef } from 'react';
import { Palette, Trophy, ClipboardList, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isNativeApp } from '../utils/platform';

/** 네이티브 배너 광고 높이 (폰 50dp, 태블릿 90dp) */
function getNativeBannerHeightPx(): number {
  if (typeof window === 'undefined') return 50;
  return window.innerWidth >= 768 ? 90 : 50;
}

/** 네비게이션 바 기본 추정 높이 (Win98: 32px, 기본: 64px) */
export const NAV_HEIGHT_DEFAULT = 64;
export const NAV_HEIGHT_WIN98 = 32;
export const getEstimatedBottomNavHeight = (isWin98: boolean): number =>
  isWin98 ? NAV_HEIGHT_WIN98 : NAV_HEIGHT_DEFAULT;

/**
 * 하단 전체 점유 높이를 CSS 변수로 내보내는 훅.
 * BottomNavBar + AdBanner + safe-area를 합산하여
 * --bottom-chrome-height CSS 변수를 설정한다.
 * 이를 통해 메인 콘텐츠가 동적으로 paddingBottom을 계산할 수 있다.
 */
function useBottomChromeHeight(navHeight: number) {
  const [adHeight, setAdHeight] = useState(() => isNativeApp() ? getNativeBannerHeightPx() : 0);

  useEffect(() => {
    if (!isNativeApp()) {
      setAdHeight(0);
      return;
    }
    const handleResize = () => setAdHeight(getNativeBannerHeightPx());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // CSS 변수로 전체 하단 점유 높이를 노출 (콘텐츠 paddingBottom에 사용)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bottom-nav-height', `${Math.max(0, Math.round(navHeight))}px`);
    root.style.setProperty('--bottom-ad-height', `${Math.max(0, Math.round(adHeight))}px`);
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
  isWin98ThemeActive: boolean;
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
  visible: boolean;
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
  isWin98ThemeActive,
  onSkinPress,
  onCustomizationPress,
  onLeaderboardPress,
  onMissionPress,
  onCalendarPress,
  onHeightChange,
}) => {
  const { t } = useTranslation();
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const [navHeight, setNavHeight] = useState<number>(() => getEstimatedBottomNavHeight(isWin98ThemeActive));
  useBottomChromeHeight(navHeight);

  const navItems: NavItem[] = [
    {
      id: 'skin',
      icon: <Palette size={20} />,
      label: t('game:actions.skin'),
      onPress: showSkin ? onSkinPress : onCustomizationPress,
      visible: showSkin || showCustomization,
    },
    {
      id: 'leaderboard',
      icon: <Trophy size={20} />,
      label: t('game:actions.leaderboard'),
      onPress: onLeaderboardPress,
      visible: true,
    },
    {
      id: 'mission',
      icon: <ClipboardList size={20} />,
      label: t('game:missions.title'),
      onPress: onMissionPress,
      badge: dailyMissionCompleted < 3 ? `${dailyMissionCompleted}/3` : undefined,
      visible: missionUnlocked,
    },
    {
      id: 'calendar',
      icon: <Calendar size={20} />,
      label: t('common:calendar.title'),
      onPress: onCalendarPress,
      badge: calendarPendingCount > 0 ? calendarPendingCount : undefined,
      visible: calendarUnlocked,
    },
  ].filter(item => item.visible);

  const navLabelsKey = navItems.map((item) => item.label).join('|');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fallbackHeight = getEstimatedBottomNavHeight(isWin98ThemeActive);
    const measure = () => {
      const measured = navContainerRef.current?.getBoundingClientRect().height;
      const nextHeight = Math.max(0, Math.round(measured ?? fallbackHeight));
      setNavHeight((prev) => (Math.abs(prev - nextHeight) > 0.5 ? nextHeight : prev));
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navContainerRef.current) {
      observer = new ResizeObserver(measure);
      observer.observe(navContainerRef.current);
    }

    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [isWin98ThemeActive, navItems.length, navLabelsKey]);

  useEffect(() => {
    onHeightChange?.(navHeight);
  }, [navHeight, onHeightChange]);

  const bottomOffset = '0px';

  // Win98 테마: 클래식 윈도우 스타일 하단 태스크바
  if (isWin98ThemeActive) {
    return (
      <div
        ref={navContainerRef}
        className="fixed left-0 right-0 z-[100]"
        style={{ bottom: bottomOffset }}
      >
        <div
          className="flex items-center gap-0.5 px-1 py-0.5"
          style={{
            background: '#c0c0c0',
            borderTop: '2px solid #fff',
            boxShadow: 'inset 0 1px 0 #dfdfdf',
          }}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onPress}
              className="relative flex items-center gap-1 px-3 py-1 text-xs font-normal"
              style={{
                background: '#c0c0c0',
                border: '2px outset #fff',
                fontFamily: '"MS Sans Serif", "Microsoft Sans Serif", Arial, sans-serif',
                minWidth: 0,
                flex: 1,
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.badge != null && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
                  style={{ background: '#ff0000' }}
                >
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
  return (
    <div
      ref={navContainerRef}
      className="fixed left-0 right-0 z-[100]"
      style={{ bottom: bottomOffset }}
    >
      <div className="mx-auto max-w-md px-3">
        <nav
          className="
            flex items-stretch justify-around
            bg-white/80 backdrop-blur-xl
            border border-white/60
            rounded-2xl
            shadow-lg shadow-black/5
            px-1 py-1.5
          "
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onPress}
              className="
                relative flex flex-col items-center justify-center
                gap-0.5 flex-1 py-2 px-1
                rounded-xl
                text-gray-500
                hover:text-gray-900 hover:bg-gray-100/60
                active:scale-95 active:bg-gray-200/60
                transition-all duration-150 ease-out
              "
            >
              <span className="relative">
                {item.icon}
                {item.badge != null && (
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
    </div>
  );
};
