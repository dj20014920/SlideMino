import type { SkinModule } from '../contracts';
import { exploreGalaxyModule } from './exploreGalaxy.module';
import { pixelBlastVoidModule } from './pixelBlastVoid.module';
import { windows98Module } from './windows98.module';
import { PET_SKINS } from '../../../config/petSkins.config';
import type { CSSProperties } from 'react';

// 🐾 15종 펫 스킨 동적 모듈 팩토리 생성
const petSkinsModules: SkinModule[] = PET_SKINS.map((pet) => ({
  skinId: pet.id,
  premiumUiThemeId: pet.colors.uiBg ? (pet.id.replace('skin_', '') as any) : undefined,
  features: {
    board: {
      useGalaxyGhostStyle: false,
      enableGalaxyPhaseSyncClass: false,
    },
  },
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: pet.colors.tileBg,
      border: `2px solid ${pet.colors.tileBorder}`,
      boxShadow: pet.colors.tileBoxShadow || 'none',
      color: pet.colors.tileTextColor,
      textShadow: pet.colors.tileTextShadow || 'none',
      fontFamily: 'DungGeunMo, Galmuri11, monospace',
      fontWeight: 'bold',
      borderRadius: '0px',
    };

    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);

    return {
      className: `pet-tile pet-tile-${pet.id.replace('skin_cute_', '')}`,
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
}));

export const SKIN_MODULES: readonly SkinModule[] = [
  pixelBlastVoidModule,
  exploreGalaxyModule,
  windows98Module,
  ...petSkinsModules,
];
