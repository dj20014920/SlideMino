import React, { Suspense, lazy } from 'react';
import type { CSSProperties } from 'react';
import type { SkinModule } from '../contracts';

const PixelBlast = lazy(() => import('../../../vendor/pixelblast/PixelBlast'));

export const pixelBlastVoidModule: SkinModule = {
  skinId: 'skin_digital_pixelblast_void',
  premiumUiThemeId: 'pixelblast_void',
  features: {
    board: {
      enablePixelBlastFallback: true,
      enablePixelBlastMergeRipple: true,
    },
    slot: {
      previewValueOverride: 16,
    },
  },
  resolveTileAppearance: ({ helpers, styleData }) => {
    const style: CSSProperties = {
      backgroundColor: 'rgba(9, 8, 20, 0.14)',
      backgroundImage: 'none',
      border: '1px solid rgba(184, 163, 255, 0.3)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      color: '#f8f5ff',
      textShadow: '0 1px 2px rgba(0,0,0,0.7), 0 0 8px rgba(184, 163, 255, 0.28)',
    };
    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);

    return {
      className: 'skin-pixelblast-void-tile',
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
  globalBackground: {
    render: () => (
      <div className="pixelblast-global-background" aria-hidden="true">
        <Suspense fallback={null}>
          <PixelBlast
            variant="square"
            pixelSize={4}
            patternScale={6}
            patternDensity={1}
            pixelSizeJitter={1}
            speed={0.5}
            edgeFade={0.25}
            transparent
          />
        </Suspense>
      </div>
    ),
  },
};
