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

type BlockCustomizationContextValue = {
  gate: FeatureGateDecision;
  settings: BlockCustomizationSettingsV1;
  setSettings: React.Dispatch<React.SetStateAction<BlockCustomizationSettingsV1>>;
  resetAll: () => void;
  resolveTileAppearance: (value: number) => ResolvedTileAppearance;
  // 스킨 시스템
  skinSettings: SkinSettings;
  activeSkin: SkinItem | null;
  addSkin: (skin: SkinItem) => void;
  setActiveSkin: (id: string | null) => void;
};

const BlockCustomizationContext = createContext<BlockCustomizationContextValue | null>(null);

export function BlockCustomizationProvider({ children }: { children: React.ReactNode }) {
  const gate = useMemo(() => getFeatureGateDecision('blockCustomization'), []);
  const [settings, setSettings] = useState<BlockCustomizationSettingsV1>(() => loadBlockCustomizationSettings());
  const [skinSettings, setSkinSettings] = useState<SkinSettings>(() => loadSkinSettings());
  const saveTimeoutRef = useRef<number | null>(null);
  const skinSaveTimeoutRef = useRef<number | null>(null);

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
    return skinSettings.ownedSkins.find(s => s.id === skinSettings.activeSkinId) ?? null;
  }, [skinSettings.activeSkinId, skinSettings.ownedSkins]);

  const addSkin = useCallback((skin: SkinItem) => {
    setSkinSettings(prev => ({
      ...prev,
      ownedSkins: [...prev.ownedSkins, skin],
    }));
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
      addSkin,
      setActiveSkin,
    }),
    [gate, settings, resetAll, resolver, skinSettings, activeSkin, addSkin, setActiveSkin]
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
