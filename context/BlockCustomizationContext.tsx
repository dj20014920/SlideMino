import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BlockCustomizationSettingsV1,
  PremiumUiMicroOverrides,
  PremiumUiObjectMap,
  PremiumUiThemeConfig,
  SkinItem,
  SkinSettings,
} from '../types';
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
import {
  DEFAULT_PREMIUM_UI_OBJECTS,
  DEFAULT_PREMIUM_UI_LABELS,
  getPremiumUiThemeById,
  PREMIUM_UI_THEMES,
} from '../config/premiumUiThemes';

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
  premiumUiTheme: PremiumUiThemeConfig | null;
  premiumUiObjects: PremiumUiObjectMap;
  premiumUiOverrides: PremiumUiMicroOverrides | null;
  addSkin: (skin: SkinItem) => void;
  setActiveSkin: (id: string | null) => void;
  addFragments: (amount: number) => void;
  addScoreMilestoneFragments: (amount: number) => void;
  purchaseSkin: (skinId: string) => void;
};

const BlockCustomizationContext = createContext<BlockCustomizationContextValue | null>(null);

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

  /**
   * 프리미엄 UI 테마 결정 규칙.
   * 1) active skin의 premiumUiThemeId를 우선 사용한다.
   * 2) legacy 데이터 호환: premiumUiOverrides만 있는 과거 스킨은 Win98으로 매핑한다.
   * 3) 둘 다 없으면 기본 UI(null theme)로 동작한다.
   */
  const premiumUiTheme = useMemo<PremiumUiThemeConfig | null>(() => {
    const themeById = getPremiumUiThemeById(activeSkinCatalogEntry?.premiumUiThemeId);
    if (themeById) return themeById;
    if (activeSkinCatalogEntry?.premiumUiOverrides) {
      return getPremiumUiThemeById('retro_windows_98');
    }
    return null;
  }, [activeSkinCatalogEntry]);

  const isPremiumUiThemeActive = Boolean(premiumUiTheme);
  const premiumUiObjects = useMemo<PremiumUiObjectMap>(() => {
    return premiumUiTheme?.objects ?? DEFAULT_PREMIUM_UI_OBJECTS;
  }, [premiumUiTheme]);
  const premiumUiOverrides = useMemo<PremiumUiMicroOverrides | null>(() => {
    if (!isPremiumUiThemeActive) return null;
    return {
      ...DEFAULT_PREMIUM_UI_LABELS,
      ...(premiumUiTheme?.labels ?? {}),
      ...(activeSkinCatalogEntry?.premiumUiOverrides ?? {}),
    };
  }, [isPremiumUiThemeActive, premiumUiTheme, activeSkinCatalogEntry]);



  /**
   * 전역 테마 브릿지 적용.
   * - rootClassName을 html/body에 부여해 테마 CSS 스코프를 활성화한다.
   * - externalStylesheet가 있으면 동적으로 주입/정리한다.
   * - 테마 전환 시 기존 테마 클래스/스타일시트를 먼저 제거해 충돌을 방지한다.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    for (const theme of PREMIUM_UI_THEMES) {
      htmlEl.classList.remove(theme.rootClassName);
      bodyEl.classList.remove(theme.rootClassName);
      const stylesheetId = theme.externalStylesheet?.id;
      if (stylesheetId) {
        const existing = document.getElementById(stylesheetId);
        if (existing) existing.remove();
      }
    }
    // Legacy cleanup: retired premium theme root class
    htmlEl.classList.remove('theme-liquid-glass');
    bodyEl.classList.remove('theme-liquid-glass');

    if (premiumUiTheme) {
      htmlEl.classList.add(premiumUiTheme.rootClassName);
      bodyEl.classList.add(premiumUiTheme.rootClassName);

      const stylesheet = premiumUiTheme.externalStylesheet;
      if (stylesheet) {
        const existing = document.getElementById(stylesheet.id) as HTMLLinkElement | null;
        if (!existing) {
          const linkEl = document.createElement('link');
          linkEl.id = stylesheet.id;
          linkEl.rel = 'stylesheet';
          linkEl.href = stylesheet.href;
          document.head.appendChild(linkEl);
        }
      }
    }

    return () => {
      if (!premiumUiTheme) return;
      htmlEl.classList.remove(premiumUiTheme.rootClassName);
      bodyEl.classList.remove(premiumUiTheme.rootClassName);
      const stylesheetId = premiumUiTheme.externalStylesheet?.id;
      if (stylesheetId) {
        const mounted = document.getElementById(stylesheetId);
        if (mounted) mounted.remove();
      }
    };
  }, [premiumUiTheme]);

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
      premiumUiTheme,
      premiumUiObjects,
      premiumUiOverrides,
      addSkin,
      setActiveSkin,
      addFragments,
      addScoreMilestoneFragments,
      purchaseSkin,
    }),
    [gate, settings, resetAll, resolver, skinSettings, activeSkin, isPremiumUiThemeActive, premiumUiTheme, premiumUiObjects, premiumUiOverrides, addSkin, setActiveSkin, addFragments, addScoreMilestoneFragments, purchaseSkin]
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
