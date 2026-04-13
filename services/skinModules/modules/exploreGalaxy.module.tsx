import React from 'react';
import type { CSSProperties } from 'react';
import Galaxy from '../../../components/Galaxy';
import type { SkinModule } from '../contracts';

export const exploreGalaxyModule: SkinModule = {
  skinId: 'skin_digital_explore_galaxy',
  premiumUiThemeId: 'explore_galaxy',
  features: {
    board: {
      enableGalaxyPhaseSyncClass: true,
      useGalaxyGhostStyle: true,
    },
    context: {
      enableGalaxyDragRepulsion: true,
    },
  },
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      border: 'none',
      boxShadow: 'none',
      color: '#e5e7eb',
      textShadow: '0 1px 2px rgba(0,0,0,0.65), 0 0 10px rgba(194, 184, 255, 0.32)',
    };
    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);

    return {
      className: 'skin-explore-galaxy-tile',
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
  globalBackground: {
    render: ({ onGalaxyMouseControlReady }) => (
      <div className="galaxy-global-background">
        <Galaxy
          mouseInteraction={false}
          mouseRepulsion={true}
          repulsionStrength={2}
          autoCenterRepulsion={0}
          density={1}
          glowIntensity={0.3}
          saturation={0}
          hueShift={140}
          rotationSpeed={0.1}
          twinkleIntensity={0.3}
          starSpeed={0.5}
          speed={1}
          transparent={false}
          getMouseControlRef={onGalaxyMouseControlReady}
        />
      </div>
    ),
  },
};
