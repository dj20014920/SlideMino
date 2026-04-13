import type { CSSProperties } from 'react';
import type { PremiumUiThemeId } from '../../types';
import { resolveActiveSkinModule } from './registry';
import type { SkinModuleFeatures } from './contracts';

type RuntimeFamilyId = 'default' | 'win98' | 'explore_galaxy' | 'pixelblast_void';
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type DragPreviewRuntime = {
  useResolvedAppearanceClass: boolean;
  cellStyle: CSSProperties;
};

type SlotPreviewRuntime = {
  valueOverride?: number;
  useResolvedAppearanceClass: boolean;
  cellStyle: CSSProperties;
  disabledClassName: string;
};

type BoardFeatureRuntime = {
  enablePixelBlastFallback: boolean;
  enablePixelBlastMergeRipple: boolean;
  useGalaxyGhostStyle: boolean;
  enableGalaxyPhaseSyncClass: boolean;
};

type BoardGhostRuntime = {
  validStyle?: CSSProperties;
  invalidStyle?: CSSProperties;
};

export type PremiumSkinRuntimeProfile = {
  family: RuntimeFamilyId;
  commonUi: {
    titleClassName: string;
    buttonClassName: string;
    tabClassName: string;
    boardClassName: string;
    slotClassName: string;
    slotFilter: string;
  };
  app: {
    slotVisibility: {
      idleClassName: string;
      swipeClassName: string;
      animatingClassName: string;
    };
  };
  slot: {
    preview: SlotPreviewRuntime;
  };
  dragPreview: DragPreviewRuntime;
  board: {
    features: BoardFeatureRuntime;
    ghost: BoardGhostRuntime;
  };
  context: {
    enableGalaxyDragRepulsion: boolean;
  };
  backgroundMode: 'none' | 'galaxy' | 'pixelblast';
};

const DEFAULT_PIXELBLAST_PREVIEW_STYLE: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(96, 64, 170, 0.9) 0%, rgba(64, 42, 120, 0.9) 100%)',
  borderColor: 'rgba(170, 142, 246, 0.72)',
  boxShadow: 'inset 0 0 0 1px rgba(10, 7, 19, 0.84), inset 1px 1px 0 rgba(228, 214, 255, 0.18)',
};

const DEFAULT_RUNTIME_PROFILE: PremiumSkinRuntimeProfile = {
  family: 'default',
  commonUi: {
    titleClassName: '',
    buttonClassName: '',
    tabClassName: '',
    boardClassName: '',
    slotClassName: '',
    slotFilter: '',
  },
  app: {
    slotVisibility: {
      idleClassName: 'opacity-100',
      swipeClassName: 'opacity-45 grayscale-[0.4] saturate-75 blur-[1.5px]',
      animatingClassName: 'opacity-40 grayscale',
    },
  },
  slot: {
    preview: {
      useResolvedAppearanceClass: true,
      cellStyle: {},
      disabledClassName: 'opacity-30',
    },
  },
  dragPreview: {
    useResolvedAppearanceClass: true,
    cellStyle: {},
  },
  board: {
    features: {
      enablePixelBlastFallback: false,
      enablePixelBlastMergeRipple: false,
      useGalaxyGhostStyle: false,
      enableGalaxyPhaseSyncClass: false,
    },
    ghost: {},
  },
  context: {
    enableGalaxyDragRepulsion: false,
  },
  backgroundMode: 'none',
};

const RUNTIME_OVERRIDES: Record<RuntimeFamilyId, DeepPartial<PremiumSkinRuntimeProfile>> = {
  default: {},
  win98: {},
  explore_galaxy: {
    family: 'explore_galaxy',
    board: {
      ghost: {
        validStyle: { backgroundColor: '#e7ebf5', borderColor: '#b6bfd4' },
        invalidStyle: { backgroundColor: '#f1d8df', borderColor: '#cf95a5' },
      },
    },
    backgroundMode: 'galaxy',
  },
  pixelblast_void: {
    family: 'pixelblast_void',
    app: {
      slotVisibility: {
        // Pixel Blast preview blocks should stay vivid through slide/settle transitions.
        // The shared grayscale animation state makes the purple mini-cells look black.
        swipeClassName: 'opacity-70',
        animatingClassName: 'opacity-60',
      },
    },
    slot: {
      preview: {
        useResolvedAppearanceClass: false,
        cellStyle: DEFAULT_PIXELBLAST_PREVIEW_STYLE,
        disabledClassName: 'opacity-70 saturate-90',
      },
    },
    dragPreview: {
      useResolvedAppearanceClass: false,
      cellStyle: DEFAULT_PIXELBLAST_PREVIEW_STYLE,
    },
    board: {
      features: {},
    },
    backgroundMode: 'pixelblast',
  },
};

const resolveRuntimeFamily = (
  themeId?: PremiumUiThemeId | null,
  skinId?: string | null,
): RuntimeFamilyId => {
  if (themeId === 'retro_windows_98') return 'win98';
  if (themeId === 'explore_galaxy') return 'explore_galaxy';
  if (themeId === 'pixelblast_void') return 'pixelblast_void';
  if (skinId === 'skin_digital_pixelblast_void') return 'pixelblast_void';
  if (skinId === 'skin_digital_explore_galaxy') return 'explore_galaxy';
  if (skinId === 'skin_digital_win98') return 'win98';
  return 'default';
};

const mergeProfile = (
  base: PremiumSkinRuntimeProfile,
  patch: DeepPartial<PremiumSkinRuntimeProfile>,
): PremiumSkinRuntimeProfile => ({
  ...base,
  ...patch,
  commonUi: { ...base.commonUi, ...(patch.commonUi ?? {}) },
  app: {
    ...base.app,
    ...(patch.app ?? {}),
    slotVisibility: {
      ...base.app.slotVisibility,
      ...(patch.app?.slotVisibility ?? {}),
    },
  },
  slot: {
    ...base.slot,
    ...(patch.slot ?? {}),
    preview: {
      ...base.slot.preview,
      ...(patch.slot?.preview ?? {}),
      cellStyle: {
        ...base.slot.preview.cellStyle,
        ...(patch.slot?.preview?.cellStyle ?? {}),
      },
    },
  },
  dragPreview: {
    ...base.dragPreview,
    ...(patch.dragPreview ?? {}),
    cellStyle: {
      ...base.dragPreview.cellStyle,
      ...(patch.dragPreview?.cellStyle ?? {}),
    },
  },
  board: {
    ...base.board,
    ...(patch.board ?? {}),
    features: {
      ...base.board.features,
      ...(patch.board?.features ?? {}),
    },
    ghost: {
      ...base.board.ghost,
      ...(patch.board?.ghost ?? {}),
    },
  },
  context: {
    ...base.context,
    ...(patch.context ?? {}),
  },
});

const applyModuleFeatures = (
  profile: PremiumSkinRuntimeProfile,
  features?: SkinModuleFeatures
): PremiumSkinRuntimeProfile => {
  if (!features) return profile;
  return {
    ...profile,
    slot: {
      ...profile.slot,
      preview: {
        ...profile.slot.preview,
        ...(features.slot?.previewValueOverride !== undefined
          ? { valueOverride: features.slot.previewValueOverride }
          : {}),
      },
    },
    board: {
      ...profile.board,
      features: {
        ...profile.board.features,
        ...(features.board?.enablePixelBlastFallback !== undefined
          ? { enablePixelBlastFallback: features.board.enablePixelBlastFallback }
          : {}),
        ...(features.board?.enablePixelBlastMergeRipple !== undefined
          ? { enablePixelBlastMergeRipple: features.board.enablePixelBlastMergeRipple }
          : {}),
        ...(features.board?.useGalaxyGhostStyle !== undefined
          ? { useGalaxyGhostStyle: features.board.useGalaxyGhostStyle }
          : {}),
        ...(features.board?.enableGalaxyPhaseSyncClass !== undefined
          ? { enableGalaxyPhaseSyncClass: features.board.enableGalaxyPhaseSyncClass }
          : {}),
      },
    },
    context: {
      ...profile.context,
      ...(features.context?.enableGalaxyDragRepulsion !== undefined
        ? { enableGalaxyDragRepulsion: features.context.enableGalaxyDragRepulsion }
        : {}),
    },
  };
};

export const resolvePremiumSkinRuntime = (
  themeId?: PremiumUiThemeId | null,
  skinId?: string | null,
): PremiumSkinRuntimeProfile => {
  const family = resolveRuntimeFamily(themeId, skinId);
  const override = RUNTIME_OVERRIDES[family] ?? {};
  const module = resolveActiveSkinModule({ skinId, premiumUiThemeId: themeId });
  const merged = mergeProfile(DEFAULT_RUNTIME_PROFILE, { ...override, family });
  return applyModuleFeatures(merged, module?.features);
};
