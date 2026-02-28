import { SkinCatalogEntry } from '../types';

const MESH_STAGE_SWATCHES = [
  '#FF9A9E', // 1 (Warm Pink)
  '#FECFEF', // 2 (Soft Pink)
  '#F6D365', // 4 (Sunny Yellow)
  '#84FAB0', // 8 (Mint)
  '#8FD3F4', // 16 (Sky Blue)
  '#A18CD1', // 32 (Soft Purple)
  '#FFD1FF', // 64 (Pink White)
  '#5EE7DF', // 128 (Aqua)
  '#66A6FF', // 256 (Blue)
  '#9FA5D5', // 512 (Lavender)
  '#F11712', // 1024 (Bright Red)
  '#00C9FF', // 2048 (Bright Cyan)
  '#92FE9D', // 4096 (Light Green)
  '#FC00FF', // 8192 (Neon Magenta)
  '#00DBDE', // 16384 (Teal)
  '#F9D423', // 32768 (Golden Yellow)
  '#FF4E50', // 65536 (Sunset Red)
  '#85FFBD', // 131072 (Lime)
  '#CBB4D4', // 262144 (Muted Rose)
  '#FA709A', // 524288 (Vibrant Pink - Replaces #09153B)
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
  // 대리석: HSL Progression(light grey → dark grey) + 교차 라이닝 오버레이
  {
    id: 'skin_material_marble',
    hex: '#c8c8d8',
    category: 'material',
    nameKey: 'mineralMarble',
    style: {
      type: 'solid',
      value: '#e8e8ef',
    },
  },

  // 수채화: Explicit 16색 파스텔 팔레트 + 부드러운 번짐 효과
  {
    id: 'skin_art_watercolor',
    hex: '#f8bbd0',
    category: 'art',
    nameKey: 'watercolor',
    style: {
      type: 'solid',
      value: '#fce4ec',
      shadow: '0 4px 15px rgba(0,0,0,0.07), inset 0 0 20px rgba(255,255,255,0.3)',
      customCss: 'border-style: none; border-width: 0px;',
    },
  },

  // Visual recipe mirrors 98.css button surface tokens (MIT):
  // https://github.com/jdan/98.css/blob/master/style.css
  {
    id: 'skin_digital_win98',
    hex: '#c0c0c0',
    category: 'digital',
    nameKey: 'retroWindows98',
    premium: true,
    premiumUiOverrides: {
      topWindowTitle: '블록 슬라이드\n(Block Slide)',
      menuWindowTitle: '난이도 선택',
      difficultyLegend: '난이도 선택 메뉴',
      utilityLegend: '메뉴',
      languageLegend: '언어',
      menuActionRadioGroupName: 'menu-action-win98',
      difficultyRadioGroupName: 'difficulty-win98',
      languageRadioGroupName: 'menu-language-win98',
      gameWindowTitle: 'Game...',
    },
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
