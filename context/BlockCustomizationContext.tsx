import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BlockCustomizationSettingsV1 } from '../types';
import {
  DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS,
  loadBlockCustomizationSettings,
  resolveTileAppearance,
  saveBlockCustomizationSettings,
  type ResolvedTileAppearance
} from '../services/blockCustomization';
import { getFeatureGateDecision, type FeatureGateDecision } from '../services/featureGates';

type BlockCustomizationContextValue = {
  gate: FeatureGateDecision;
  settings: BlockCustomizationSettingsV1;
  setSettings: React.Dispatch<React.SetStateAction<BlockCustomizationSettingsV1>>;
  resetAll: () => void;
  resolveTileAppearance: (value: number) => ResolvedTileAppearance;
};

const BlockCustomizationContext = createContext<BlockCustomizationContextValue | null>(null);

export function BlockCustomizationProvider({ children }: { children: React.ReactNode }) {
  const gate = useMemo(() => getFeatureGateDecision('blockCustomization'), []);
  const [settings, setSettings] = useState<BlockCustomizationSettingsV1>(() => loadBlockCustomizationSettings());
  const saveTimeoutRef = useRef<number | null>(null);

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

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS);
  }, []);

  const resolver = useCallback(
    (value: number) =>
      resolveTileAppearance(value, gate.allowed ? settings : DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS),
    [gate.allowed, settings]
  );

  const value = useMemo<BlockCustomizationContextValue>(
    () => ({
      gate,
      settings,
      setSettings,
      resetAll,
      resolveTileAppearance: resolver,
    }),
    [gate, settings, resetAll, resolver]
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
