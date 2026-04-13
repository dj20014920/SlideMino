import type { CSSProperties, ReactNode } from 'react';
import type { PremiumUiThemeId, SkinStyle } from '../../types';

export type SkinModuleAppearanceResult = {
  className: string;
  style?: CSSProperties;
};

export type GalaxyMouseControl = {
  setPos: (x: number, y: number) => void;
  clearPos: () => void;
};

export type SkinModuleAppearanceHelpers = {
  getTileColor: (value: number) => string;
  sanitizeTileAppearanceStyle: (style?: CSSProperties) => CSSProperties | undefined;
  applyStructuralCss: (style: CSSProperties, cssString: string) => void;
  applySkinStyleOverrides: (
    style: CSSProperties,
    styleData?: { textColor?: unknown; borderColor?: unknown; shadow?: unknown } | null
  ) => void;
};

export type SkinModuleAppearanceContext = {
  value: number;
  skinId: string;
  premiumUiThemeId?: PremiumUiThemeId | null;
  skinHex: string;
  styleData?: SkinStyle;
  helpers: SkinModuleAppearanceHelpers;
};

export type SkinModuleGlobalBackgroundContext = {
  onGalaxyMouseControlReady?: (ctrl: GalaxyMouseControl) => void;
};

export type SkinModuleFeatures = {
  board?: {
    enablePixelBlastFallback?: boolean;
    enablePixelBlastMergeRipple?: boolean;
    enableGalaxyPhaseSyncClass?: boolean;
    useGalaxyGhostStyle?: boolean;
  };
  slot?: {
    previewValueOverride?: number;
  };
  context?: {
    enableGalaxyDragRepulsion?: boolean;
  };
};

export type SkinModule = {
  skinId: string;
  premiumUiThemeId?: PremiumUiThemeId;
  features?: SkinModuleFeatures;
  resolveTileAppearance?: (ctx: SkinModuleAppearanceContext) => SkinModuleAppearanceResult | null;
  globalBackground?: {
    render: (ctx: SkinModuleGlobalBackgroundContext) => ReactNode;
  };
};
