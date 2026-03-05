type SkinNameInput = {
  id?: string;
  hex: string;
  nameKey?: string;
};

type SupportedNameLocale = 'ko' | 'en' | 'ja' | 'zh';

const LIQUID_GLASS_SKIN_PREFIX = 'skin_digital_liquid_glass_';
const LEGACY_LIQUID_GLASS_SKIN_ID = 'skin_digital_liquid_glass';
const MESH_SWATCH_SKIN_PREFIX = 'skin_mesh_swatch_';

const NAME_LABELS: Record<
  SupportedNameLocale,
  {
    liquidGlass: string;
    meshGradient: string;
    basicColor: string;
    retroWindows98: string;
    mineralMarble: string;
    watercolor: string;
  }
> = {
  ko: {
    liquidGlass: '리퀴드 글래스',
    meshGradient: '메쉬 그라디언트',
    basicColor: '베이직 컬러',
    retroWindows98: '레트로 윈도우 98',
    mineralMarble: '미네랄 마블',
    watercolor: '워터컬러',
  },
  en: {
    liquidGlass: 'Liquid Glass',
    meshGradient: 'Mesh Gradient',
    basicColor: 'Basic Color',
    retroWindows98: 'Retro Windows 98',
    mineralMarble: 'Mineral Marble',
    watercolor: 'Watercolor',
  },
  ja: {
    liquidGlass: 'リキッドグラス',
    meshGradient: 'メッシュグラデーション',
    basicColor: 'ベーシックカラー',
    retroWindows98: 'レトロ Windows 98',
    mineralMarble: 'ミネラルマーブル',
    watercolor: 'ウォーターカラー',
  },
  zh: {
    liquidGlass: '液态玻璃',
    meshGradient: '网格渐变',
    basicColor: '基础色',
    retroWindows98: '复古 Windows 98',
    mineralMarble: '矿物大理石',
    watercolor: '水彩',
  },
};

const to2 = (n: number): string => String(Math.max(1, n)).padStart(2, '0');

const normalizeLocale = (locale?: string): SupportedNameLocale => {
  const normalized = (locale ?? 'ko').toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return 'ko';
};

const parseIndexedId = (id: string | undefined, prefix: string): number | null => {
  if (!id || !id.startsWith(prefix)) return null;
  const n = Number(id.slice(prefix.length));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
};

const parseBasicSkinId = (id: string | undefined): number | null => {
  if (!id) return null;
  const m = /^skin_(\d+)$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return n + 1;
};

export const getSkinFallbackDisplayName = (skin: SkinNameInput, locale?: string): string => {
  const labels = NAME_LABELS[normalizeLocale(locale)];

  const liquidIdx = parseIndexedId(skin.id, LIQUID_GLASS_SKIN_PREFIX);
  if (liquidIdx !== null) return `${labels.liquidGlass} ${to2(liquidIdx)}`;
  if (skin.id === LEGACY_LIQUID_GLASS_SKIN_ID) return `${labels.liquidGlass} 01`;

  const meshIdx = parseIndexedId(skin.id, MESH_SWATCH_SKIN_PREFIX);
  if (meshIdx !== null) return `${labels.meshGradient} ${to2(meshIdx)}`;
  if (skin.id === 'skin_art_mesh') return labels.meshGradient;

  const basicIdx = parseBasicSkinId(skin.id);
  if (basicIdx !== null) return `${labels.basicColor} ${to2(basicIdx)}`;

  if (skin.id === 'skin_digital_win98') return labels.retroWindows98;
  if (skin.id === 'skin_material_marble') return labels.mineralMarble;
  if (skin.id === 'skin_art_watercolor') return labels.watercolor;

  return skin.hex.toUpperCase();
};
