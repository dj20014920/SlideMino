import type {
  SkinModule,
  SkinModuleAppearanceContext,
  SkinModuleAppearanceResult,
} from './contracts';
import { SKIN_MODULES } from './modules';

const SKIN_MODULE_BY_SKIN_ID = new Map<string, SkinModule>(
  SKIN_MODULES.map((module) => [module.skinId, module])
);

const SKIN_MODULE_BY_THEME_ID = new Map<string, SkinModule>(
  SKIN_MODULES
    .filter((module) => Boolean(module.premiumUiThemeId))
    .map((module) => [module.premiumUiThemeId as string, module])
);

export const getSkinModuleBySkinId = (skinId?: string | null): SkinModule | null => {
  if (!skinId) return null;
  return SKIN_MODULE_BY_SKIN_ID.get(skinId) ?? null;
};

export const getSkinModuleByThemeId = (themeId?: string | null): SkinModule | null => {
  if (!themeId) return null;
  return SKIN_MODULE_BY_THEME_ID.get(themeId) ?? null;
};

export const resolveActiveSkinModule = (params: {
  skinId?: string | null;
  premiumUiThemeId?: string | null;
}): SkinModule | null => {
  return (
    getSkinModuleBySkinId(params.skinId)
    ?? getSkinModuleByThemeId(params.premiumUiThemeId)
    ?? null
  );
};

export const resolveSkinModuleAppearance = (
  input: SkinModuleAppearanceContext
): SkinModuleAppearanceResult | null => {
  const module = resolveActiveSkinModule({
    skinId: input.skinId,
    premiumUiThemeId: input.premiumUiThemeId,
  });
  if (!module?.resolveTileAppearance) return null;
  return module.resolveTileAppearance(input);
};
