import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BlockCustomizationSettingsV1, SkinItem, SkinSettings } from '../types';
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
import { SKIN_CATALOG, FRAGMENT_COST_NORMAL, FRAGMENT_COST_PREMIUM } from '../constants';
import { isDevDevice } from '../utils/deviceDetection';

type BlockCustomizationContextValue = {
  gate: FeatureGateDecision;
  settings: BlockCustomizationSettingsV1;
  setSettings: React.Dispatch<React.SetStateAction<BlockCustomizationSettingsV1>>;
  resetAll: () => void;
  resolveTileAppearance: (value: number) => ResolvedTileAppearance;
  // 스킨 시스템
  skinSettings: SkinSettings;
  activeSkin: SkinItem | null;
  isWin98ThemeActive: boolean;
  addSkin: (skin: SkinItem) => void;
  setActiveSkin: (id: string | null) => void;
  addFragments: (amount: number) => void;
  purchaseSkin: (skinId: string) => void;
};

const BlockCustomizationContext = createContext<BlockCustomizationContextValue | null>(null);
const WIN98_THEME_CLASS = 'theme-win98';
const WIN98_STYLESHEET_ID = 'slidemino-win98-theme-link';
const WIN98_STYLESHEET_HREF = '/vendor/98css/style.css';

export function BlockCustomizationProvider({ children }: { children: React.ReactNode }) {
  const gate = useMemo(() => getFeatureGateDecision('blockCustomization'), []);
  const [settings, setSettings] = useState<BlockCustomizationSettingsV1>(() => loadBlockCustomizationSettings());
  const [skinSettings, setSkinSettings] = useState<SkinSettings>(() => loadSkinSettings());
  const saveTimeoutRef = useRef<number | null>(null);
  const skinSaveTimeoutRef = useRef<number | null>(null);

  // 개발 디바이스: 모든 스킨 자동 해금
  useEffect(() => {
    let cancelled = false;
    isDevDevice().then(isDev => {
      if (cancelled || !isDev) return;
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
    });
    return () => { cancelled = true; };
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
  const isWin98ThemeActive = skinSettings.activeSkinId === 'skin_digital_win98';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    htmlEl.classList.toggle(WIN98_THEME_CLASS, isWin98ThemeActive);
    bodyEl.classList.toggle(WIN98_THEME_CLASS, isWin98ThemeActive);

    const existingLink = document.getElementById(WIN98_STYLESHEET_ID) as HTMLLinkElement | null;
    if (isWin98ThemeActive) {
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
      if (!isWin98ThemeActive) return;
      htmlEl.classList.remove(WIN98_THEME_CLASS);
      bodyEl.classList.remove(WIN98_THEME_CLASS);
      const mountedLink = document.getElementById(WIN98_STYLESHEET_ID);
      if (mountedLink) mountedLink.remove();
    };
  }, [isWin98ThemeActive]);

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
    setSkinSettings(prev => ({
      ...prev,
      fragments: prev.fragments + amount,
    }));
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
      isWin98ThemeActive,
      addSkin,
      setActiveSkin,
      addFragments,
      purchaseSkin,
    }),
    [gate, settings, resetAll, resolver, skinSettings, activeSkin, isWin98ThemeActive, addSkin, setActiveSkin, addFragments, purchaseSkin]
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
