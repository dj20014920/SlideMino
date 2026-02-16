import { SkinCatalogEntry } from '../types';

// ==========================================
// 🎨 스킨 스타일 정의 (Complex Skins)
// ==========================================

export const ADDITIONAL_SKIN_CATALOG: SkinCatalogEntry[] = [
  // Visual recipe mirrors 98.css button surface tokens (MIT):
  // https://github.com/jdan/98.css/blob/master/style.css
  {
    id: 'skin_digital_win98',
    hex: '#c0c0c0',
    category: 'digital',
    nameKey: 'retroWindows98',
    style: {
      type: 'solid',
      value: '#c0c0c0',
      textColor: '#222222',
      borderColor: '#0a0a0a',
      customCss: [
        'border-radius: 0px',
        'box-sizing: border-box',
        'border: none',
        'box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #ffffff, inset -2px -2px #808080, inset 2px 2px #dfdfdf',
        'font-family: "Pixelated MS Sans Serif", "MS Sans Serif", "Tahoma", "Geneva", sans-serif',
        'font-weight: 700',
        'letter-spacing: 0',
        'text-shadow: none',
        '-webkit-font-smoothing: none',
        'image-rendering: pixelated',
      ].join('; ') + ';',
    },
  },
  {
    id: 'skin_digital_evervault',
    hex: '#a855f7',
    category: 'digital',
    nameKey: 'evervaultCard',
    style: {
      type: 'solid',
      value: '#0a0a0a',
      textColor: '#f0f0f0',
      borderColor: 'rgba(255,255,255,0.12)',
      customCss: [
        'border: 1px solid rgba(255,255,255,0.12)',
        'font-weight: 700',
        'letter-spacing: 0.02em',
      ].join('; ') + ';',
    },
  },
];
