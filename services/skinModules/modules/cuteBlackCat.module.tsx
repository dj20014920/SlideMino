import React from 'react';
import type { CSSProperties } from 'react';
import type { SkinModule } from '../contracts';

export const cuteBlackCatModule: SkinModule = {
  skinId: 'skin_cute_black_cat',
  premiumUiThemeId: 'cute_black_cat',
  features: {
    board: {
      useGalaxyGhostStyle: false,
      enableGalaxyPhaseSyncClass: false,
    },
  },
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: '#1d1d20',
      border: '2px solid #E7C6A0',
      boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.5), inset 2px 2px 0 rgba(255,255,255,0.08), 0 4px 8px rgba(0,0,0,0.25)',
      color: '#FFFFFF',
      textShadow: '2px 2px 0px rgba(0,0,0,0.8)',
      fontFamily: 'DungGeunMo, Galmuri11, monospace',
      fontWeight: 'bold',
      borderRadius: '0px',
    };
    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);

    return {
      className: 'pet-tile pet-tile-cute-black-cat',
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
};
