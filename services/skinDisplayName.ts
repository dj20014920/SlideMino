type SkinNameInput = {
  id?: string;
  hex: string;
  nameKey?: string;
};

type SupportedNameLocale = 'ko' | 'en' | 'ja' | 'zh';

const LIQUID_GLASS_SKIN_PREFIX = 'skin_digital_liquid_glass_';
const LEGACY_LIQUID_GLASS_SKIN_ID = 'skin_digital_liquid_glass';
const MESH_SWATCH_SKIN_PREFIX = 'skin_mesh_swatch_';

type CuteSkinNames = {
  cuteBlackCat: string; cuteWhiteCat: string; cuteDog: string;
  cuteCalicoCat: string; cuteCheeseCat: string; cuteSiameseCat: string; cuteSphynx: string;
  cuteShiba: string; cuteCorgi: string; cuteRetriever: string; cutePoodle: string;
  cuteScottishFold: string; cuteChihuahua: string; cuteBichon: string; cuteMaltese: string;
};

const NAME_LABELS: Record<
  SupportedNameLocale,
  {
    liquidGlass: string;
    meshGradient: string;
    basicColor: string;
    retroWindows98: string;
    mineralMarble: string;
    watercolor: string;
    pixelBlast: string;
    exploreGalaxy: string;
  } & CuteSkinNames
> = {
  ko: {
    liquidGlass: '리퀴드 글래스',
    meshGradient: '메쉬 그라디언트',
    basicColor: '베이직 컬러',
    retroWindows98: '레트로 윈도우 98',
    mineralMarble: '미네랄 마블',
    watercolor: '워터컬러',
    pixelBlast: '픽셀 블라스트',
    exploreGalaxy: '은하 탐험',
    cuteBlackCat: '검은 고양이',
    cuteWhiteCat: '흰 고양이',
    cuteDog: '강아지',
    cuteCalicoCat: '삼색이',
    cuteCheeseCat: '치즈냥이',
    cuteSiameseCat: '샴',
    cuteSphynx: '스핑크스',
    cuteShiba: '시바견',
    cuteCorgi: '웰시코기',
    cuteRetriever: '골든 리트리버',
    cutePoodle: '푸들',
    cuteScottishFold: '스코티시 폴드',
    cuteChihuahua: '치와와',
    cuteBichon: '비숑 프리제',
    cuteMaltese: '말티즈',
  },
  en: {
    liquidGlass: 'Liquid Glass',
    meshGradient: 'Mesh Gradient',
    basicColor: 'Basic Color',
    retroWindows98: 'Retro Windows 98',
    mineralMarble: 'Mineral Marble',
    watercolor: 'Watercolor',
    pixelBlast: 'Pixel Blast',
    exploreGalaxy: 'Explore Galaxy',
    cuteBlackCat: 'Black Cat',
    cuteWhiteCat: 'White Cat',
    cuteDog: 'Cute Puppy',
    cuteCalicoCat: 'Calico Cat',
    cuteCheeseCat: 'Cheese Cat',
    cuteSiameseCat: 'Siamese',
    cuteSphynx: 'Sphynx',
    cuteShiba: 'Shiba Inu',
    cuteCorgi: 'Corgi',
    cuteRetriever: 'Golden Retriever',
    cutePoodle: 'Poodle',
    cuteScottishFold: 'Scottish Fold',
    cuteChihuahua: 'Chihuahua',
    cuteBichon: 'Bichon Frise',
    cuteMaltese: 'Maltese',
  },
  ja: {
    liquidGlass: 'リキッドグラス',
    meshGradient: 'メッシュグラデーション',
    basicColor: 'ベーシックカラー',
    retroWindows98: 'レトロ Windows 98',
    mineralMarble: 'ミネラルマーブル',
    watercolor: 'ウォーターカラー',
    pixelBlast: 'ピクセルブラスト',
    exploreGalaxy: 'ギャラクシー探検',
    cuteBlackCat: '黒猫',
    cuteWhiteCat: '白猫',
    cuteDog: '子犬',
    cuteCalicoCat: '三毛猫',
    cuteCheeseCat: 'チーズ猫',
    cuteSiameseCat: 'シャム猫',
    cuteSphynx: 'スフィンクス',
    cuteShiba: '柴犬',
    cuteCorgi: 'コーギー',
    cuteRetriever: 'ゴールデンレトリバー',
    cutePoodle: 'プードル',
    cuteScottishFold: 'スコティッシュフォールド',
    cuteChihuahua: 'チワワ',
    cuteBichon: 'ビション・フリーゼ',
    cuteMaltese: 'マルチーズ',
  },
  zh: {
    liquidGlass: '液态玻璃',
    meshGradient: '网格渐变',
    basicColor: '基础色',
    retroWindows98: '复古 Windows 98',
    mineralMarble: '矿物大理石',
    watercolor: '水彩',
    pixelBlast: '像素爆炸',
    exploreGalaxy: '银河探索',
    cuteBlackCat: '黑猫',
    cuteWhiteCat: '白猫',
    cuteDog: '小狗',
    cuteCalicoCat: '三花猫',
    cuteCheeseCat: '奶酪猫',
    cuteSiameseCat: '暹罗猫',
    cuteSphynx: '斯芬克斯猫',
    cuteShiba: '柴犬',
    cuteCorgi: '柯基犬',
    cuteRetriever: '金毛寻回犬',
    cutePoodle: '贵宾犬',
    cuteScottishFold: '苏格兰折耳猫',
    cuteChihuahua: '吉娃娃',
    cuteBichon: '比熊犬',
    cuteMaltese: '马尔济斯犬',
  },
};

import { PET_SKINS } from '../config/petSkins.config';

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
  if (skin.id === 'skin_digital_pixelblast_void') return labels.pixelBlast;
  if (skin.id === 'skin_digital_explore_galaxy') return labels.exploreGalaxy;
  if (skin.id === 'skin_material_marble') return labels.mineralMarble;
  if (skin.id === 'skin_art_watercolor') return labels.watercolor;
  if (skin.id && skin.id.startsWith('skin_cute_')) {
    const petDef = PET_SKINS.find(p => p.id === skin.id);
    if (petDef) {
      const key = petDef.nameKey as keyof CuteSkinNames;
      return labels[key] || skin.hex.toUpperCase();
    }
  }

  return skin.hex.toUpperCase();
};
