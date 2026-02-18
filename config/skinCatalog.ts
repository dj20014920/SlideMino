import { SkinCatalogEntry } from '../types';

const MESH_STAGE_SWATCHES = [
  '#E0C3FC', // 1
  '#FF9A9E', // 2
  '#A18CD1', // 4
  '#FAD0C4', // 8
  '#8FD3F4', // 16
  '#84FAB0', // 32
  '#FCCB90', // 64
  '#D299C2', // 128
  '#A6C0FE', // 256
  '#F68084', // 512
  '#667EEA', // 1024
  '#764BA2', // 2048
  '#4FACFE', // 4096
  '#00F2FE', // 8192
  '#F093FB', // 16384
  '#F5576C', // 32768
  '#ECCB1E', // 65536
  '#32B513', // 131072
  '#107660', // 262144
  '#09153B', // 524288
] as const;

const MESH_STAGE_SINGLE_COLOR_SKINS: SkinCatalogEntry[] = MESH_STAGE_SWATCHES.map((hex, index) => ({
  id: `skin_mesh_swatch_${index + 1}`,
  hex,
  category: 'art',
  nameKey: `meshGradientHex${hex.slice(1)}`,
  premium: false,
}));

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
    premium: true,
    style: {
      type: 'solid',
      value: '#c0c0c0',
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
    id: 'skin_art_mesh',
    hex: '#764ba2',
    category: 'art',
    nameKey: 'meshGradient',
    premium: true,
    style: {
      type: 'solid',
      value: '#ffffff',
      textColor: '#ffffff',
      // We will override borders in the renderer
      customCss: [
        'border: none',
        'font-weight: 700',
        'letter-spacing: 0.01em',
        'text-shadow: 0 1px 2px rgba(0,0,0,0.15)',
      ].join('; ') + ';',
    },
  },
  ...MESH_STAGE_SINGLE_COLOR_SKINS,
];
