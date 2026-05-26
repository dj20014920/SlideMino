import React from 'react';
import type { CSSProperties } from 'react';
import type { SkinModule } from '../contracts';

export const cuteDogModule: SkinModule = {
  skinId: 'skin_cute_dog',
  premiumUiThemeId: 'cute_dog',
  features: {
    board: {
      useGalaxyGhostStyle: false,
      enableGalaxyPhaseSyncClass: false,
    },
  },
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: '#FFF0F5',
      border: '2px solid #5c3d24',
      boxShadow: 'inset -2px -2px 0 rgba(92,61,36,0.2), inset 2px 2px 0 rgba(255,255,255,0.6), 0 4px 8px rgba(0,0,0,0.12)',
      color: '#4e3629',
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
      className: 'pet-tile pet-tile-cute-dog',
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
};
