import React from 'react';
import type { CSSProperties } from 'react';
import NeonCortexBg from '../../../components/NeonCortexBg';
import type { SkinModule } from '../contracts';

export const neonCortexModule: SkinModule = {
  skinId: 'skin_digital_neon_cortex',
  premiumUiThemeId: 'neon_cortex',
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      border: 'none',
      boxShadow: 'none',
      color: '#e0f0ff',
      textShadow: '0 1px 2px rgba(0,0,0,0.7), 0 0 8px rgba(0, 229, 255, 0.3)',
    };
    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);

    return {
      className: 'skin-neon-cortex-tile',
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
  globalBackground: {
    render: () => (
      <div className="cortex-global-background" aria-hidden="true">
        <NeonCortexBg />
      </div>
    ),
  },
};