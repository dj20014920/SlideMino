import React from 'react';
import type { CSSProperties } from 'react';
import type { SkinModule } from '../contracts';

export const cuteWhiteCatModule: SkinModule = {
  skinId: 'skin_cute_white_cat',
  premiumUiThemeId: 'cute_white_cat',
  features: {
    board: {
      useGalaxyGhostStyle: false,
      enableGalaxyPhaseSyncClass: false,
    },
  },
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: '#E6F4F8',
      border: '2px solid #121212',
      boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.6), 0 4px 8px rgba(0,0,0,0.12)',
      color: '#121212',
      textShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      fontFamily: 'DungGeunMo, Galmuri11, monospace',
      fontWeight: 'bold',
      borderRadius: '0px',
    };
    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);

    return {
      className: 'pet-tile pet-tile-cute-white-cat',
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
};
