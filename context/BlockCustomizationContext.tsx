import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BlockCustomizationSettingsV1, PremiumUiMicroOverrides, SkinItem, SkinSettings } from '../types';
import {
  DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS,
  loadBlockCustomizationSettings,
  resolveTileAppearance,
  saveBlockCustomizationSettings,
  type ResolvedTileAppearance
} from '../services/blockCustomization';
import {
  DEFAULT_SKIN_SETTINGS,
  loadSkinSettings,
  saveSkinSettings,
} from '../services/skinService';
import { getFeatureGateDecision, type FeatureGateDecision } from '../services/featureGates';
import { SKIN_CATALOG, FRAGMENT_COST_NORMAL, FRAGMENT_COST_PREMIUM, DAILY_1024_FRAGMENT_CAP } from '../constants';
import { shouldAutoUnlockAllSkinsForDev } from '../utils/deviceDetection';
import { gameEventBus } from '../services/gameEventBus';
import { getKstDateString } from '../services/streakService';
import { getServerAdjustedNow } from '../services/serverTimeService';

type BlockCustomizationContextValue = {
  gate: FeatureGateDecision;
  settings: BlockCustomizationSettingsV1;
  setSettings: React.Dispatch<React.SetStateAction<BlockCustomizationSettingsV1>>;
  resetAll: () => void;
  resolveTileAppearance: (value: number) => ResolvedTileAppearance;
  // 스킨 시스템
  skinSettings: SkinSettings;
  activeSkin: SkinItem | null;
  isPremiumUiThemeActive: boolean;
  premiumUiOverrides: PremiumUiMicroOverrides | null;
  isWin98ThemeActive: boolean;
  addSkin: (skin: SkinItem) => void;
  setActiveSkin: (id: string | null) => void;
  addFragments: (amount: number) => void;
  addScoreMilestoneFragments: (amount: number) => void;
  purchaseSkin: (skinId: string) => void;
};

const BlockCustomizationContext = createContext<BlockCustomizationContextValue | null>(null);
const WIN98_THEME_CLASS = 'theme-win98';
const WIN98_STYLESHEET_ID = 'slidemino-win98-theme-link';
const WIN98_STYLESHEET_HREF = '/vendor/98css/style.css';
const DEFAULT_PREMIUM_UI_OVERRIDES: PremiumUiMicroOverrides = {
  topWindowTitle: '블록 슬라이드\n(Block Slide)',
  menuWindowTitle: '난이도 선택',
  difficultyLegend: '난이도 선택 메뉴',
  utilityLegend: '메뉴',
  languageLegend: '언어',
  menuActionRadioGroupName: 'menu-action-win98',
  difficultyRadioGroupName: 'difficulty-win98',
  languageRadioGroupName: 'menu-language-win98',
  gameWindowTitle: 'Game...',
};

export function BlockCustomizationProvider({ children }: { children: React.ReactNode }) {
  const gate = useMemo(() => getFeatureGateDecision('blockCustomization'), []);
  const [settings, setSettings] = useState<BlockCustomizationSettingsV1>(() => loadBlockCustomizationSettings());
  const [skinSettings, setSkinSettings] = useState<SkinSettings>(() => loadSkinSettings());
  const saveTimeoutRef = useRef<number | null>(null);
  const skinSaveTimeoutRef = useRef<number | null>(null);
  const prevOwnedSkinCountRef = useRef<number>(skinSettings.ownedSkins.length);

  // 서비스 레이어에서 발생한 FRAGMENTS_ADDED 이벤트를 React state에 반영
  useEffect(() => {
    const unsubscribe = gameEventBus.on('FRAGMENTS_ADDED', ({ amount }) => {
      setSkinSettings(prev => ({
        ...prev,
        fragments: prev.fragments + amount,
      }));
    });
    return unsubscribe;
  }, []);

  // 개발용 에뮬레이터에서만 카탈로그 전체 스킨 자동 해금
  useEffect(() => {
    let cancelled = false;
    const timeoutIds: number[] = [];

    const tryUnlockAllSkins = async (): Promise<void> => {
      const allowAutoUnlock = await shouldAutoUnlockAllSkinsForDev();
      if (cancelled || !allowAutoUnlock) return;
      setSkinSettings(prev => {
        const ownedIds = new Set(prev.ownedSkins.map(s => s.id));
        const missing = SKIN_CATALOG.filter(e => !ownedIds.has(e.id));
        if (missing.length === 0) return prev;
        const now = Date.now();
        return {
          ...prev,
          ownedSkins: [
            ...prev.ownedSkins,
            ...missing.map(e => ({ id: e.id, hex: e.hex, acquiredAt: now })),
          ],
        };
      });
    };

    // Capacitor bridge 초기화 타이밍을 고려해 짧게 재시도한다.
    [0, 500, 1500].forEach((delayMs) => {
      const timeoutId = window.setTimeout(() => {
        void tryUnlockAllSkins();
      }, delayMs);
      timeoutIds.push(timeoutId);
    });

    return () => {
      cancelled = true;
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // 블록 커스터마이징 설정 자동 저장
  useEffect(() => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      saveBlockCustomizationSettings(settings);
      saveTimeoutRef.current = null;
    }, 200);
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [settings]);

  // 스킨 설정 자동 저장
  useEffect(() => {
    if (skinSaveTimeoutRef.current) {
      window.clearTimeout(skinSaveTimeoutRef.current);
      skinSaveTimeoutRef.current = null;
    }
    skinSaveTimeoutRef.current = window.setTimeout(() => {
      saveSkinSettings(skinSettings);
      skinSaveTimeoutRef.current = null;
    }, 200);
    return () => {
      if (skinSaveTimeoutRef.current) {
        window.clearTimeout(skinSaveTimeoutRef.current);
        skinSaveTimeoutRef.current = null;
      }
    };
  }, [skinSettings]);

  // 신규 스킨 획득 이벤트 발행 (XP 시스템 연동)
  useEffect(() => {
    const prevCount = prevOwnedSkinCountRef.current;
    const currentCount = skinSettings.ownedSkins.length;
    if (currentCount > prevCount) {
      gameEventBus.emit('SKIN_ACQUIRED', { count: currentCount - prevCount });
    }
    prevOwnedSkinCountRef.current = currentCount;
  }, [skinSettings.ownedSkins.length]);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS);
  }, []);

  const activeSkin = useMemo(() => {
    if (!skinSettings.activeSkinId) return null;
    const owned = skinSettings.ownedSkins.find(s => s.id === skinSettings.activeSkinId);
    if (owned) return owned;
    const catalogSkin = SKIN_CATALOG.find(s => s.id === skinSettings.activeSkinId);
    if (!catalogSkin) return null;
    return {
      id: catalogSkin.id,
      hex: catalogSkin.hex,
      acquiredAt: 0,
    };
  }, [skinSettings.activeSkinId, skinSettings.ownedSkins]);

  const activeSkinCatalogEntry = useMemo(() => {
    if (!skinSettings.activeSkinId) return null;
    return SKIN_CATALOG.find((skin) => skin.id === skinSettings.activeSkinId) ?? null;
  }, [skinSettings.activeSkinId]);

  // 기본 UI는 항상 일반 테마를 사용하고,
  // 스킨별 개별 테마 오버라이드가 정의된 경우에만 특수 UI 테마를 활성화한다.
  const isPremiumUiThemeActive = Boolean(activeSkinCatalogEntry?.premiumUiOverrides);
  const premiumUiOverrides = useMemo<PremiumUiMicroOverrides | null>(() => {
    if (!isPremiumUiThemeActive) return null;
    return {
      ...DEFAULT_PREMIUM_UI_OVERRIDES,
      ...(activeSkinCatalogEntry?.premiumUiOverrides ?? {}),
    };
  }, [isPremiumUiThemeActive, activeSkinCatalogEntry]);

  // 하위호환: 기존 컴포넌트 분기명을 유지한다.
  const isWin98ThemeActive = isPremiumUiThemeActive;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    htmlEl.classList.toggle(WIN98_THEME_CLASS, isPremiumUiThemeActive);
    bodyEl.classList.toggle(WIN98_THEME_CLASS, isPremiumUiThemeActive);

    const existingLink = document.getElementById(WIN98_STYLESHEET_ID) as HTMLLinkElement | null;
    if (isPremiumUiThemeActive) {
      if (!existingLink) {
        const linkEl = document.createElement('link');
        linkEl.id = WIN98_STYLESHEET_ID;
        linkEl.rel = 'stylesheet';
        linkEl.href = WIN98_STYLESHEET_HREF;
        document.head.appendChild(linkEl);
      }
    } else if (existingLink) {
      existingLink.remove();
    }

    return () => {
      if (!isPremiumUiThemeActive) return;
      htmlEl.classList.remove(WIN98_THEME_CLASS);
      bodyEl.classList.remove(WIN98_THEME_CLASS);
      const mountedLink = document.getElementById(WIN98_STYLESHEET_ID);
      if (mountedLink) mountedLink.remove();
    };
  }, [isPremiumUiThemeActive]);

  const addSkin = useCallback((skin: SkinItem) => {
    setSkinSettings(prev => {
      if (prev.ownedSkins.some(existing => existing.id === skin.id)) {
        return prev;
      }
      return {
        ...prev,
        ownedSkins: [...prev.ownedSkins, skin],
      };
    });
  }, []);

  const addFragments = useCallback((amount: number) => {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (safeAmount <= 0) return;
    setSkinSettings(prev => ({
      ...prev,
      fragments: prev.fragments + safeAmount,
    }));
  }, []);

  const addScoreMilestoneFragments = useCallback((amount: number) => {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (safeAmount <= 0) return;
    const today = getKstDateString(getServerAdjustedNow());
    setSkinSettings(prev => {
      // 날짜가 바뀌면 일일 카운터 리셋
      const prevEarned = prev.daily1024Date === today ? prev.daily1024Earned : 0;
      // 일일 캐 적용: 남은 허용치만큼만 지급
      const allowed = Math.max(0, DAILY_1024_FRAGMENT_CAP - prevEarned);
      const actual = Math.min(safeAmount, allowed);
      if (actual <= 0) return prev;
      return {
        ...prev,
        fragments: prev.fragments + actual,
        scoreMilestoneCredits: prev.scoreMilestoneCredits + actual,
        daily1024Date: today,
        daily1024Earned: prevEarned + actual,
      };
    });
  }, []);

  const purchaseSkin = useCallback((skinId: string) => {
    setSkinSettings(prev => {
      if (prev.ownedSkins.some(s => s.id === skinId)) return prev;
      const entry = SKIN_CATALOG.find(e => e.id === skinId);
      if (!entry) return prev;
      const cost = entry.premium ? FRAGMENT_COST_PREMIUM : FRAGMENT_COST_NORMAL;
      if (prev.fragments < cost) return prev;
      const newSkin: SkinItem = { id: entry.id, hex: entry.hex, acquiredAt: Date.now() };
      return {
        ...prev,
        fragments: prev.fragments - cost,
        ownedSkins: [...prev.ownedSkins, newSkin],
      };
    });
  }, []);

  const setActiveSkin = useCallback((id: string | null) => {
    setSkinSettings(prev => ({ ...prev, activeSkinId: id }));
  }, []);

  const resolver = useCallback(
    (value: number) =>
      resolveTileAppearance(
        value,
        gate.allowed ? settings : DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS,
        skinSettings,
      ),
    [gate.allowed, settings, skinSettings]
  );

  const value = useMemo<BlockCustomizationContextValue>(
    () => ({
      gate,
      settings,
      setSettings,
      resetAll,
      resolveTileAppearance: resolver,
      skinSettings,
      activeSkin,
      isPremiumUiThemeActive,
      premiumUiOverrides,
      isWin98ThemeActive,
      addSkin,
      setActiveSkin,
      addFragments,
      addScoreMilestoneFragments,
      purchaseSkin,
    }),
    [gate, settings, resetAll, resolver, skinSettings, activeSkin, isPremiumUiThemeActive, premiumUiOverrides, isWin98ThemeActive, addSkin, setActiveSkin, addFragments, addScoreMilestoneFragments, purchaseSkin]
  );

  return (
    <BlockCustomizationContext.Provider value={value}>
      {children}
    </BlockCustomizationContext.Provider>
  );
}

export const useBlockCustomization = (): BlockCustomizationContextValue => {
  const ctx = useContext(BlockCustomizationContext);
  if (!ctx) throw new Error('useBlockCustomization must be used within BlockCustomizationProvider');
  return ctx;
};
