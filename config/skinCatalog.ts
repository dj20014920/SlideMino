import { SkinCatalogEntry } from '../types';

const MESH_STAGE_SWATCHES = [
  { hex: '#FF9A9E', nameKey: 'meshPeachCloud' },
  { hex: '#FECFEF', nameKey: 'meshCottonLilac' },
  { hex: '#F6D365', nameKey: 'meshSunshineVelvet' },
  { hex: '#84FAB0', nameKey: 'meshMintBreeze' },
  { hex: '#8FD3F4', nameKey: 'meshSkySorbet' },
  { hex: '#A18CD1', nameKey: 'meshLavenderDrift' },
  { hex: '#FFD1FF', nameKey: 'meshPinkMist' },
  { hex: '#5EE7DF', nameKey: 'meshAquaHaze' },
  { hex: '#66A6FF', nameKey: 'meshBlueCandy' },
  { hex: '#9FA5D5', nameKey: 'meshLilacFrost' },
  { hex: '#F11712', nameKey: 'meshRubyFlash' },
  { hex: '#00C9FF', nameKey: 'meshCyanFlash' },
  { hex: '#92FE9D', nameKey: 'meshLimeSplash' },
  { hex: '#FC00FF', nameKey: 'meshNeonBerry' },
  { hex: '#00DBDE', nameKey: 'meshTealFlash' },
  { hex: '#F9D423', nameKey: 'meshGoldenPop' },
  { hex: '#FF4E50', nameKey: 'meshSunsetBerry' },
  { hex: '#85FFBD', nameKey: 'meshLimeCream' },
  { hex: '#CBB4D4', nameKey: 'meshRoseFog' },
  { hex: '#FA709A', nameKey: 'meshBerryGlow' },
] as const;

// Liquid Glass 전용 팔레트:
// 미묘한 차이가 아닌, 사용자 체감이 확실한 고대비/고채도 분포로 구성.
const LIQUID_GLASS_SWATCHES = [
  { hex: '#FF3B30', nameKey: 'liquidGlassCrimsonOrbit' },
  { hex: '#F43F5E', nameKey: 'liquidGlassRoseComet' },
  { hex: '#FF6D00', nameKey: 'liquidGlassEmberTangerine' },
  { hex: '#FF8A3D', nameKey: 'liquidGlassApricotBeam' },
  { hex: '#FFB300', nameKey: 'liquidGlassAmberPulse' },
  { hex: '#FFD600', nameKey: 'liquidGlassSolarFizz' },
  { hex: '#D4E157', nameKey: 'liquidGlassLimeAurora' },
  { hex: '#C6FF00', nameKey: 'liquidGlassNeonSprout' },
  { hex: '#84CC16', nameKey: 'liquidGlassLeafPrism' },
  { hex: '#22C55E', nameKey: 'liquidGlassEmeraldWave' },
  { hex: '#00A86B', nameKey: 'liquidGlassJadeRipple' },
  { hex: '#3FA34D', nameKey: 'liquidGlassForestMist' },
  { hex: '#00BFA5', nameKey: 'liquidGlassTealCurrent' },
  { hex: '#2A9D8F', nameKey: 'liquidGlassSeaGlass' },
  { hex: '#00ACC1', nameKey: 'liquidGlassCyanHarbor' },
  { hex: '#00C9FF', nameKey: 'liquidGlassSkyLaser' },
  { hex: '#00A3FF', nameKey: 'liquidGlassAzureSpark' },
  { hex: '#118AB2', nameKey: 'liquidGlassOceanDepth' },
  { hex: '#1E88E5', nameKey: 'liquidGlassCobaltRay' },
  { hex: '#2563EB', nameKey: 'liquidGlassRoyalCurrent' },
  { hex: '#3949AB', nameKey: 'liquidGlassIndigoFlux' },
  { hex: '#5C6BC0', nameKey: 'liquidGlassPeriwinkleEcho' },
  { hex: '#6366F1', nameKey: 'liquidGlassElectricNova' },
  { hex: '#4F46E5', nameKey: 'liquidGlassDeepIris' },
  { hex: '#7C4DFF', nameKey: 'liquidGlassVioletSurge' },
  { hex: '#9333EA', nameKey: 'liquidGlassPurpleBloom' },
  { hex: '#AA00FF', nameKey: 'liquidGlassNeonOrchid' },
  { hex: '#C026D3', nameKey: 'liquidGlassMagentaShift' },
  { hex: '#D946EF', nameKey: 'liquidGlassFuchsiaGlow' },
  { hex: '#EC4899', nameKey: 'liquidGlassPinkVolt' },
  { hex: '#E76F51', nameKey: 'liquidGlassTerracottaHeat' },
  { hex: '#8D6E63', nameKey: 'liquidGlassCocoaSmoke' },
] as const;

const MESH_STAGE_SINGLE_COLOR_SKINS: SkinCatalogEntry[] = MESH_STAGE_SWATCHES.map(({ hex, nameKey }, index) => ({
  id: `skin_mesh_swatch_${index + 1}`,
  hex,
  category: 'art',
  nameKey,
  premium: false,
}));

const LIQUID_GLASS_PARALLEL_SKINS: SkinCatalogEntry[] = LIQUID_GLASS_SWATCHES.map(({ hex, nameKey }, index) => ({
  id: `skin_digital_liquid_glass_${index + 1}`,
  hex,
  category: 'digital',
  nameKey,
  premium: false,
  style: {
    type: 'css-pattern',
    value: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 38%, rgba(255,255,255,0.05) 100%)',
    textColor: '#f8fafc',
    customCss: [
      'border-width: 1px',
    ].join('; ') + ';',
  },
}));

const NEON_PARALLEL_SKINS: SkinCatalogEntry[] = LIQUID_GLASS_SWATCHES.map(({ hex, nameKey }, index) => ({
  id: `skin_digital_neon_block_parallel_${index + 1}`,
  hex,
  category: 'neon',
  nameKey,
  premium: false,
  style: {
    type: 'css-pattern',
    value: 'none',
    textColor: '#ffffff',
    customCss: [
      'border-radius: 4px',
    ].join('; ') + ';',
  },
}));

const NEON_CORE_SKIN: SkinCatalogEntry = {
  // Neon Block: 원본 버튼 UI를 정사각형 블록으로 변환 (상시 glow, 숫자 맥동)
  id: 'skin_digital_neon_block',
  hex: '#101010',
  category: 'neon',
  nameKey: 'neonBlock',
  premium: false,
  style: {
    type: 'css-pattern',
    value: 'none',
    textColor: '#ffffff',
    customCss: [
      'border-radius: 4px',
    ].join('; ') + ';',
  },
};

// highlight-color-hue(210deg, 블루 계열)에 맞춰 블루 구간(#1E88E5 ~ #2563EB) 사이에 배치
const NEON_CORE_INSERT_INDEX = 19;
const NEON_ORDERED_SKINS: SkinCatalogEntry[] = [
  ...NEON_PARALLEL_SKINS.slice(0, NEON_CORE_INSERT_INDEX),
  NEON_CORE_SKIN,
  ...NEON_PARALLEL_SKINS.slice(NEON_CORE_INSERT_INDEX),
];

const EXPLORE_GALAXY_PREMIUM_SKIN: SkinCatalogEntry = {
  id: 'skin_digital_explore_galaxy',
  hex: '#2b1b75',
  category: 'digital',
  nameKey: 'exploreGalaxy',
  premium: true,
  premiumUiThemeId: 'explore_galaxy',
  style: {
    type: 'css-pattern',
    value: 'none',
    textColor: '#e5e7eb',
    customCss: [
      'border-radius: 4px',
    ].join('; ') + ';',
  },
};

const PIXELBLAST_VOID_PREMIUM_SKIN: SkinCatalogEntry = {
  id: 'skin_digital_pixelblast_void',
  hex: '#7d5fff',
  category: 'digital',
  nameKey: 'pixelBlast',
  premium: true,
  premiumUiThemeId: 'pixelblast_void',
  style: {
    type: 'css-pattern',
    value: 'none',
    textColor: '#e5e7eb',
    customCss: [
      'border-radius: 4px',
    ].join('; ') + ';',
  },
};

// ==========================================
// 🎨 스킨 스타일 정의 (Complex Skins)
// ==========================================

export const ADDITIONAL_SKIN_CATALOG: SkinCatalogEntry[] = [
  // 🐾 귀여운 동물 친구들 (Cute Friends) 스킨 15종
  {
    id: 'skin_cute_black_cat',
    hex: '#FDE8C0', // 연노랑 배경 크림색
    category: 'cat',
    nameKey: 'cuteBlackCat',
    premium: true,
    premiumUiThemeId: 'cute_black_cat',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#ffffff',
      customCss: 'border-radius: 4px; border: 2px solid #E7C6A0; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  {
    id: 'skin_cute_white_cat',
    hex: '#E6F4F8', // 연하늘 배경색
    category: 'cat',
    nameKey: 'cuteWhiteCat',
    premium: true,
    premiumUiThemeId: 'cute_white_cat',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#121212',
      customCss: 'border-radius: 4px; border: 2px solid #121212; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  {
    id: 'skin_cute_dog',
    hex: '#FFF0F5',
    category: 'dog',
    nameKey: 'cuteDog',
    premium: true,
    premiumUiThemeId: 'cute_dog',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#4e3629',
      customCss: 'border-radius: 4px; border: 2px solid #5c3d24; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐱 삼색이
  {
    id: 'skin_cute_calico_cat',
    hex: '#E67E22',
    category: 'cat',
    nameKey: 'cuteCalicoCat',
    premium: true,
    premiumUiThemeId: 'cute_calico_cat',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#2E2E32',
      customCss: 'border-radius: 4px; border: 2px solid #D35400; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐱 치즈냥이
  {
    id: 'skin_cute_cheese_cat',
    hex: '#F39C12',
    category: 'cat',
    nameKey: 'cuteCheeseCat',
    premium: true,
    premiumUiThemeId: 'cute_cheese_cat',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#7E5109',
      customCss: 'border-radius: 4px; border: 2px solid #E67E22; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐱 샴
  {
    id: 'skin_cute_siamese_cat',
    hex: '#2B82C9',
    category: 'cat',
    nameKey: 'cuteSiameseCat',
    premium: true,
    premiumUiThemeId: 'cute_siamese_cat',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#5C4033',
      customCss: 'border-radius: 4px; border: 2px solid #5C4033; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐱 스핑크스
  {
    id: 'skin_cute_sphynx_cat',
    hex: '#FADBD8',
    category: 'cat',
    nameKey: 'cuteSphynx',
    premium: true,
    premiumUiThemeId: 'cute_sphynx_cat',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#8D6E63',
      customCss: 'border-radius: 4px; border: 2px solid #8D6E63; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐱 스코티시 폴드
  {
    id: 'skin_cute_scottish_fold',
    hex: '#A1887F',
    category: 'cat',
    nameKey: 'cuteScottishFold',
    premium: true,
    premiumUiThemeId: 'cute_scottish_fold',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#4E342E',
      customCss: 'border-radius: 4px; border: 2px solid #8D6E63; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 치와와
  {
    id: 'skin_cute_chihuahua',
    hex: '#CA6F1E',
    category: 'dog',
    nameKey: 'cuteChihuahua',
    premium: true,
    premiumUiThemeId: 'cute_chihuahua',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#5C2D00',
      customCss: 'border-radius: 4px; border: 2px solid #873600; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 시바견
  {
    id: 'skin_cute_shiba',
    hex: '#E67E22',
    category: 'dog',
    nameKey: 'cuteShiba',
    premium: true,
    premiumUiThemeId: 'cute_shiba',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#5C4033',
      customCss: 'border-radius: 4px; border: 2px solid #A04000; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 웰시코기
  {
    id: 'skin_cute_corgi',
    hex: '#D35400',
    category: 'dog',
    nameKey: 'cuteCorgi',
    premium: true,
    premiumUiThemeId: 'cute_corgi',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#5C2D00',
      customCss: 'border-radius: 4px; border: 2px solid #873600; box-shadow: 0 4px 8px rgba(0,0,0,0.12); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 골든 리트리버
  {
    id: 'skin_cute_retriever',
    hex: '#F5B041',
    category: 'dog',
    nameKey: 'cuteRetriever',
    premium: true,
    premiumUiThemeId: 'cute_retriever',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#7E5109',
      customCss: 'border-radius: 4px; border: 2px solid #BA4A00; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 푸들
  {
    id: 'skin_cute_poodle',
    hex: '#AF601A',
    category: 'dog',
    nameKey: 'cutePoodle',
    premium: true,
    premiumUiThemeId: 'cute_poodle',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#5C4033',
      customCss: 'border-radius: 4px; border: 2px solid #7E5109; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 비숑 프리제
  {
    id: 'skin_cute_bichon',
    hex: '#FFFFFF',
    category: 'dog',
    nameKey: 'cuteBichon',
    premium: true,
    premiumUiThemeId: 'cute_bichon',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#121212',
      customCss: 'border-radius: 4px; border: 2px solid #121212; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },
  // 🐕 말티즈
  {
    id: 'skin_cute_maltese',
    hex: '#9C27B0',
    category: 'dog',
    nameKey: 'cuteMaltese',
    premium: true,
    premiumUiThemeId: 'cute_maltese',
    style: {
      type: 'css-pattern',
      value: 'none',
      textColor: '#424242',
      customCss: 'border-radius: 4px; border: 2px solid #BDBDBD; box-shadow: 0 4px 8px rgba(0,0,0,0.08); font-family: "Outfit", "Inter", sans-serif; font-weight: 800;',
    },
  },

  PIXELBLAST_VOID_PREMIUM_SKIN,
  EXPLORE_GALAXY_PREMIUM_SKIN,
  ...NEON_ORDERED_SKINS,

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
    premiumUiThemeId: 'retro_windows_98',
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
  ...LIQUID_GLASS_PARALLEL_SKINS,

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
