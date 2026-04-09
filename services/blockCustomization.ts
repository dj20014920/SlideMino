import type { CSSProperties } from 'react';
import { TILE_COLORS, getTileColor, SKIN_CATALOG } from '../constants';
import type { BlockCustomizationSettingsV1, GlobalTilePaletteSettings, SkinSettings, TileSkinOverride, SkinCatalogEntry } from '../types';
import {
  SKIN_PROGRESSIONS,
  SKIN_EXPLICIT_PALETTES,
  SKIN_ANIMATIONS,
  SKIN_RENDER_MODES,
  getValueShadow,
  getAutoBorderColor,
  type SkinRenderMode,
} from '../config/skinPalettes';

export const BLOCK_CUSTOMIZATION_STORAGE_KEY = 'slidemino.blockCustomization.v1';

export const DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS: BlockCustomizationSettingsV1 = {
  version: 1,
  globalPalette: {
    enabled: false,
    baseColor: '#64748b', // slate-500-ish
    saturation: 56,
    brightness: 88,
    depth: 54,
  },
  perValue: {},
};

export type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export const clamp = (n: number, min: number, max: number): number => {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const isRecord = (v: unknown): v is Record<string, unknown> => {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
};

const normalizeHexColor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
};

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
};

export const rgbToHex = ({ r, g, b }: Rgb): string => {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => {
  const tt = clamp(t, 0, 1);
  return {
    r: a.r + (b.r - a.r) * tt,
    g: a.g + (b.g - a.g) * tt,
    b: a.b + (b.b - a.b) * tt,
  };
};

const rgbToHsl = (rgb: Rgb): Hsl => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  if (d === 0) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  h *= 60;

  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = (hsl: Hsl): Rgb => {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp >= 1 && hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp >= 2 && hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp >= 3 && hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp >= 4 && hp < 5) [r1, g1, b1] = [x, 0, c];
  else[r1, g1, b1] = [c, 0, x];

  const m = l - c / 2;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
};

const relativeLuminance = (rgb: Rgb): number => {
  const toLin = (c: number) => {
    const v = clamp(c, 0, 255) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = toLin(rgb.r);
  const g = toLin(rgb.g);
  const b = toLin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const WHITE_TEXT_COLOR = '#f9fafb';

// Builds adaptive text shadow based on background luminance.
// Instead of switching to dark text on light backgrounds, always uses white text
// with progressively stronger soft shadows for legibility.
// Avoids thick -webkit-text-stroke which looks harsh on pastel skins.
const buildAdaptiveShadow = (lum: number): Pick<CSSProperties, 'WebkitTextStroke' | 'textShadow'> => {
  if (lum <= 0.45) {
    // Dark background: minimal shadow
    return { textShadow: '0 1px 2px rgba(0,0,0,0.25)' };
  }
  if (lum <= 0.65) {
    // Medium background: soft multi-layer shadow
    const a = 0.3;
    return {
      textShadow: [
        `0 0 3px rgba(0,0,0,${a})`,
        `0 1px 2px rgba(0,0,0,${a})`,
      ].join(', '),
    };
  }
  // Bright background (lum > 0.65): stronger soft glow outline
  // Use very thin stroke (0.4px) + soft blurred shadows instead of hard 1px stroke
  const intensity = Math.min((lum - 0.65) / 0.35, 1); // 0→1 as lum goes 0.65→1.0
  const a = 0.25 + intensity * 0.2; // 0.25→0.45
  const blur = 2 + intensity * 2;   // 2px→4px
  return {
    WebkitTextStroke: `0.4px rgba(0,0,0,${(0.15 + intensity * 0.15).toFixed(2)})`,
    textShadow: [
      `0 0 ${blur}px rgba(0,0,0,${a.toFixed(2)})`,
      `0 1px ${blur}px rgba(0,0,0,${(a * 0.8).toFixed(2)})`,
      `0 0 ${blur + 2}px rgba(0,0,0,${(a * 0.5).toFixed(2)})`,
    ].join(', '),
  };
};

export const getWhiteTextStyleForBackground = (backgroundRgb: Rgb): CSSProperties => {
  // Always white text with adaptive soft shadow for legibility.
  // Uses multiple thin blur-shadows instead of hard stroke for a clean look.
  const lum = relativeLuminance(backgroundRgb);
  return {
    color: WHITE_TEXT_COLOR,
    ...buildAdaptiveShadow(lum),
  };
};

const isValidDataUrlImage = (value: unknown): value is string => {
  return typeof value === 'string' && value.startsWith('data:image/');
};

const sanitizeGlobalPalette = (raw: unknown): GlobalTilePaletteSettings => {
  if (!isRecord(raw)) return DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS.globalPalette;
  const enabled = Boolean(raw.enabled);
  const baseColor = normalizeHexColor(raw.baseColor) ?? DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS.globalPalette.baseColor;
  const saturation = clamp(Number(raw.saturation), 0, 100);
  const brightness = clamp(Number(raw.brightness), 0, 100);
  const depth = clamp(Number(raw.depth), 0, 80);
  return { enabled, baseColor, saturation, brightness, depth };
};

const sanitizeOverride = (raw: unknown): TileSkinOverride | null => {
  if (!isRecord(raw)) return null;
  const kind = raw.kind;
  if (kind === 'default') return { kind: 'default' };
  if (kind === 'color') {
    const color = normalizeHexColor(raw.color);
    if (!color) return null;
    return { kind: 'color', color };
  }
  if (kind === 'image') {
    const imageDataUrl = raw.imageDataUrl;
    if (!isValidDataUrlImage(imageDataUrl)) return null;
    return { kind: 'image', imageDataUrl };
  }
  return null;
};

export const loadBlockCustomizationSettings = (): BlockCustomizationSettingsV1 => {
  try {
    const raw = localStorage.getItem(BLOCK_CUSTOMIZATION_STORAGE_KEY);
    if (!raw) return DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS;

    const globalPalette = sanitizeGlobalPalette(parsed.globalPalette);
    const perValue: Record<string, TileSkinOverride> = {};
    if (isRecord(parsed.perValue)) {
      for (const [key, value] of Object.entries(parsed.perValue)) {
        const n = Number(key);
        if (!Number.isFinite(n) || n <= 0) continue;
        const sanitized = sanitizeOverride(value);
        if (!sanitized) continue;
        if (sanitized.kind === 'default') continue;
        perValue[String(n)] = sanitized;
      }
    }

    return { version: 1, globalPalette, perValue };
  } catch {
    return DEFAULT_BLOCK_CUSTOMIZATION_SETTINGS;
  }
};

export const saveBlockCustomizationSettings = (settings: BlockCustomizationSettingsV1): void => {
  try {
    localStorage.setItem(BLOCK_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore (storage full / private mode)
  }
};

export type ResolvedTileAppearance = {
  className: string;
  style?: CSSProperties;
};

const DISALLOWED_TILE_STYLE_KEYS = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'zIndex',
  'pointerEvents',
  'touchAction',
  'transform',
  'translate',
  'rotate',
  'scale',
  'transformOrigin',
  'transformStyle',
  // 애니메이션 속성: Board.tsx의 transition/willChange가 항상 우선되어야 함
  'transition',
  'transitionProperty',
  'transitionDuration',
  'transitionTimingFunction',
  'transitionDelay',
  'willChange',
  'animation',
  'animationName',
  'animationDuration',
  'animationTimingFunction',
  'animationDelay',
  'animationIterationCount',
  'opacity',
] as const;

export const sanitizeTileAppearanceStyle = (style?: CSSProperties): CSSProperties | undefined => {
  if (!style) return undefined;
  const safeStyle: CSSProperties = { ...style };
  for (const key of DISALLOWED_TILE_STYLE_KEYS) {
    if ((safeStyle as any)[key] === undefined) continue;
    delete (safeStyle as any)[key];
  }
  return safeStyle;
};

const getGlobalPaletteColorForValue = (value: number, palette: GlobalTilePaletteSettings): string => {
  const baseRgb = hexToRgb(palette.baseColor);
  const baseHsl = rgbToHsl(baseRgb);

  const exp = Math.log2(value);
  const maxExp = 11; // up to 2048 (2^11) is the "core" range; higher values converge to the darkest color.
  const t = clamp(exp / maxExp, 0, 1);

  const l = clamp(palette.brightness - t * palette.depth, 8, 94);
  const rgb = hslToRgb({ h: baseHsl.h, s: palette.saturation, l });
  return rgbToHex(rgb);
};

export const buildGradient = (baseHex: string): { backgroundImage: string; baseRgb: Rgb } => {
  const baseRgb = hexToRgb(baseHex);
  const hi = rgbToHex(mixRgb(baseRgb, { r: 255, g: 255, b: 255 }, 0.14));
  const lo = rgbToHex(mixRgb(baseRgb, { r: 0, g: 0, b: 0 }, 0.18));
  return {
    baseRgb,
    backgroundImage: `linear-gradient(135deg, ${hi} 0%, ${baseHex} 45%, ${lo} 100%)`,
  };
};

// 흰색→스킨 색상 수렴: 타일 값이 클수록 스킨 색상에 가까워짐
const WHITE_RGB: Rgb = { r: 255, g: 255, b: 255 };
const MESH_SWATCH_SKIN_PREFIX = 'skin_mesh_swatch_';

// Simple seeded PRNG (mulberry32) for deterministic randomness per tile/skin.
const pseudoRandom = (seed: string): (() => number) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const getValueExponent = (value: number): number => {
  return Math.max(0, Math.floor(Math.log2(Math.max(1, value))));
};

const toRgba = (rgb: Rgb, alpha: number): string => {
  const a = clamp(alpha, 0, 1);
  return `rgba(${Math.round(clamp(rgb.r, 0, 255))}, ${Math.round(clamp(rgb.g, 0, 255))}, ${Math.round(clamp(rgb.b, 0, 255))}, ${a})`;
};

// Schlick Fresnel approximation:
// F = F0 + (1 - F0) * (1 - cosTheta)^5
const fresnelSchlick = (cosTheta: number, f0: number): number => {
  const c = clamp(cosTheta, 0, 1);
  const base = clamp(f0, 0, 1);
  return base + (1 - base) * Math.pow(1 - c, 5);
};

// Beer-Lambert attenuation (transmittance):
// T = exp(-sigma * distance)
const beerLambertTransmittance = (distance: number, sigma: number): number => {
  const d = Math.max(0, distance);
  const s = Math.max(0, sigma);
  return Math.exp(-s * d);
};

const buildFresnelEdgeGradient = (
  direction: 'to bottom' | 'to top' | 'to right' | 'to left',
  tintRgb: Rgb,
  strength: number,
  edgeSpreadPct: number,
  peakAlpha: number,
  f0: number,
  attenuationSigma: number,
): string => {
  // Near edge(0) -> strong Fresnel reflection, inward -> fast attenuation.
  const samples = [0, 0.08, 0.16, 0.28, 0.44, 0.62, 0.78, 0.92];
  const stops = samples.map((d) => {
    const fresnel = fresnelSchlick(d, f0);
    const transmittance = beerLambertTransmittance(d, attenuationSigma);
    const alpha = peakAlpha * strength * fresnel * transmittance;
    const pct = (d * edgeSpreadPct).toFixed(2);
    return `${toRgba(tintRgb, alpha)} ${pct}%`;
  });
  stops.push(`${toRgba(tintRgb, 0)} ${edgeSpreadPct}%`);
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
};

export const getSkinColorForValue = (value: number, skinHex: string, maxExponent = 15): string => {
  const skinRgb = hexToRgb(skinHex);
  const exp = Math.log2(value);
  const t = clamp(exp / maxExponent, 0, 1);
  const mixed = mixRgb(WHITE_RGB, skinRgb, t);
  return rgbToHex(mixed);
};

const getMeshBaseColorForValue = (value: number, seedHex: string): string => {
  // 요청사항: 값이 작을수록 흰색에 가깝고, 값이 클수록 원래 색을 되찾는 단계형 로직 유지.
  return getSkinColorForValue(value, seedHex, 19);
};

type MeshLayerOptions = {
  circular?: boolean;
  seed?: string;
  evolution?: number;
  stepIndex?: number;
};

const buildMeshLayerStyle = (baseHex: string, options?: MeshLayerOptions): CSSProperties => {
  const baseRgb = hexToRgb(baseHex);
  const baseHsl = rgbToHsl(baseRgb);
  const evolution = clamp(options?.evolution ?? 0, 0, 1);
  const easedEvolution = 1 - Math.pow(1 - evolution, 1.25);
  const stepIndex = Math.max(0, Math.floor(options?.stepIndex ?? Math.round(evolution * 19)));

  // Skin Seed: stable per skin → controls Color Strategy (Analogous/Complementary/etc.)
  const skinSeedString = options?.seed || baseHex;
  const skinRand = pseudoRandom(skinSeedString);

  const genColor = (hShift: number, sShift: number, lShift: number) => {
    return rgbToHex(hslToRgb({
      h: (baseHsl.h + hShift + 360) % 360,
      s: clamp(baseHsl.s + sShift, 40, 95),
      l: clamp(baseHsl.l + lShift, 40, 90),
    }));
  };

  // Select a Color Strategy (Personality) for this skin
  const strategyType = Math.floor(skinRand() * 6);
  let c1, c2, c3, c4, c5;

  // H-shifts, S-shifts, L-shifts presets
  switch (strategyType) {
    case 0: // Analogous (Dreamy, Soft)
      c1 = genColor(30, 5, 5);
      c2 = genColor(-30, 5, -5);
      c3 = genColor(15, -5, 10);
      c4 = genColor(-15, 5, -10);
      c5 = genColor(0, -10, 20); // Highlight
      break;
    case 1: // Complementary (Bold, Two-Tone)
      c1 = genColor(180, 0, -10);
      c2 = genColor(0, 5, 5);
      c3 = genColor(180, 5, 5);
      c4 = genColor(0, -5, -5);
      c5 = genColor(0, -10, 20);
      break;
    case 2: // Split Complementary (Rich, Dynamic)
      c1 = genColor(150, 5, -5);
      c2 = genColor(210, 5, -5);
      c3 = genColor(0, -5, 10);
      c4 = genColor(0, 5, -10);
      c5 = genColor(0, -10, 20);
      break;
    case 3: // Triadic (Balanced, Colorful)
      c1 = genColor(120, 0, 0);
      c2 = genColor(240, 0, 0);
      c3 = genColor(0, 5, 5);
      c4 = genColor(120, 5, -5);
      c5 = genColor(0, -10, 20);
      break;
    case 4: // Tetradic / Wild (The "Rainbow" look)
      c1 = genColor(60, 5, 5);
      c2 = genColor(-60, 5, -5);
      c3 = genColor(90, -5, 5);
      c4 = genColor(180, 0, -10);
      c5 = genColor(0, -10, 15);
      break;
    default: // Monochromatic Deep (Subtle, professional)
      c1 = genColor(10, 10, -10);
      c2 = genColor(-10, 10, -10);
      c3 = genColor(5, 5, 5);
      c4 = genColor(-5, 5, 5);
      c5 = genColor(0, -5, 15);
      break;
  }

  // 스킨 단위로 단 1회만 고정 배치 순서를 만든다.
  // 값(value)별로 매번 셔플하지 않아 2→4→8...에서 연속성이 유지된다.
  const colors = [c1, c2, c3, c4, c5];
  const rotation = Math.floor(skinRand() * colors.length);
  const rotatedColors = colors.map((_, index) => colors[(index + rotation) % colors.length]);
  const evolvedColors = rotatedColors.map((hex, index) => {
    const hsl = rgbToHsl(hexToRgb(hex));
    const direction = index % 2 === 0 ? 1 : -1;
    const hueShift = direction * (8 + index * 2) * easedEvolution;
    const satBoost = (4 + index) * easedEvolution;
    const lightShift = (index === 4 ? 7 : -4) * easedEvolution;
    return rgbToHex(hslToRgb({
      h: (hsl.h + hueShift + 360) % 360,
      s: clamp(hsl.s + satBoost, 35, 98),
      l: clamp(hsl.l + lightShift, 30, 92),
    }));
  });

  const zones: ReadonlyArray<{ x: [number, number]; y: [number, number] }> = [
    { x: [6, 42], y: [6, 42] },
    { x: [58, 94], y: [6, 42] },
    { x: [6, 42], y: [58, 94] },
    { x: [58, 94], y: [58, 94] },
    { x: [30, 70], y: [30, 70] },
  ];

  const points = zones.map((zone) => {
    const baseX = zone.x[0] + skinRand() * (zone.x[1] - zone.x[0]);
    const baseY = zone.y[0] + skinRand() * (zone.y[1] - zone.y[0]);
    const driftX = (skinRand() - 0.5) * 24;
    const driftY = (skinRand() - 0.5) * 24;
    const stepRand = pseudoRandom(`${skinSeedString}:step:${stepIndex}:${baseX.toFixed(2)}:${baseY.toFixed(2)}`)();
    const stepNoiseX = (stepRand - 0.5) * 10 * (0.45 + 0.55 * easedEvolution);
    const stepNoiseY = (0.5 - stepRand) * 10 * (0.45 + 0.55 * easedEvolution);

    const x = clamp(baseX + driftX * easedEvolution + stepNoiseX, 0, 100);
    const y = clamp(baseY + driftY * easedEvolution + stepNoiseY, 0, 100);
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  });

  const falloffPct = (60 - 20 * easedEvolution).toFixed(2);
  const innerGlowAlpha = (0.09 + 0.12 * easedEvolution).toFixed(3);
  // 요청값: 시작 색감은 살리고(0.45), 값이 올라가며 점진 변형.
  const baseLayerAlpha = 0.45 + 0.2 * easedEvolution;
  const evolutionBlend = 0.45;
  const colorMorph = clamp(easedEvolution * evolutionBlend, 0, 1);

  const layerColors = evolvedColors.map((hex, index) => {
    const startRgb = hexToRgb(rotatedColors[index]);
    const evolvedRgb = hexToRgb(hex);
    const layerRgb = mixRgb(startRgb, evolvedRgb, colorMorph);
    const noiseRand = pseudoRandom(`${skinSeedString}:layer-noise:${index}`)();
    const phase = noiseRand * Math.PI * 2;
    const freq = 0.65 + noiseRand * 0.7;
    const wave = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(stepIndex * freq + phase));

    // 레이어 on/off 감각(완전 제거 대신 거의 사라지게)으로 "이전엔 없던 것이 나타나는" 체감 제공
    const gateSeed = pseudoRandom(`${skinSeedString}:layer-gate:${index}`)();
    const gatePeriod = 3 + Math.floor(gateSeed * 4); // 3~6 step 주기
    const gatePhase = Math.floor(gateSeed * gatePeriod);
    const gateOpen = ((stepIndex + gatePhase) % gatePeriod) !== 0;
    const gateFactor = gateOpen ? 1 : 0.45;

    const layerAlpha = clamp(baseLayerAlpha * wave * gateFactor, 0.18, 0.74);
    return toRgba(layerRgb, layerAlpha);
  });

  const style: CSSProperties = {
    backgroundColor: baseHex,
    backgroundImage: [
      `radial-gradient(at ${points[0]}, ${layerColors[0]} 0px, transparent ${falloffPct}%)`,
      `radial-gradient(at ${points[1]}, ${layerColors[1]} 0px, transparent ${falloffPct}%)`,
      `radial-gradient(at ${points[2]}, ${layerColors[2]} 0px, transparent ${falloffPct}%)`,
      `radial-gradient(at ${points[3]}, ${layerColors[3]} 0px, transparent ${falloffPct}%)`,
      `radial-gradient(at ${points[4]}, ${layerColors[4]} 0px, transparent ${falloffPct}%)`,
    ].join(', '),
    backgroundBlendMode: 'normal',
    border: 'none',
    boxShadow: `inset 0 0 ${Math.round(18 + 16 * easedEvolution)}px rgba(255,255,255,${innerGlowAlpha}), 0 2px 5px rgba(0,0,0,0.1)`,
    fontWeight: 800,
    borderRadius: options?.circular ? '50%' : undefined,
  };

  Object.assign(style, getAutoTextColor(baseRgb));
  style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';

  return style;
};

const buildMeshSkinStyle = (value: number, seedHex: string, options?: { circular?: boolean }): CSSProperties => {
  const baseHex = getMeshBaseColorForValue(value, seedHex);
  const exponent = getValueExponent(value);
  const evolution = clamp(exponent / 19, 0, 1);
  return buildMeshLayerStyle(baseHex, { ...options, seed: seedHex, evolution, stepIndex: exponent });
};

const LIQUID_GLASS_SKIN_PREFIX = 'skin_digital_liquid_glass_';
const LEGACY_LIQUID_GLASS_SKIN_ID = 'skin_digital_liquid_glass';
const NEON_BLOCK_PARALLEL_SKIN_PREFIX = 'skin_digital_neon_block_parallel_';
const EXPLORE_GALAXY_SKIN_ID = 'skin_digital_explore_galaxy';

const isLiquidGlassSkinId = (skinId: string): boolean => (
  skinId === LEGACY_LIQUID_GLASS_SKIN_ID || skinId.startsWith(LIQUID_GLASS_SKIN_PREFIX)
);

const buildLiquidGlassTileStyle = (value: number, tintHex: string): CSSProperties => {
  const exponent = getValueExponent(value);
  const tintRgb = hexToRgb(tintHex);
  const finalToneExponent = 11; // 2048(2^11)의 현재 강도를 최종 강도로 사용

  // 1은 완전 투명.
  // 2부터는 최소 가시값(floor)으로 시작하고 2차함수 계열(power)로 점진 상승.
  // 2048(exp=11)에서 100% 도달, 이후는 고정.
  const normalizedProgress = exponent <= 0 ? 0 : clamp(exponent / finalToneExponent, 0, 1);
  const minVisible = 0.018;
  const curveExp = 2.4;
  const strength = exponent <= 0
    ? 0
    : minVisible + (1 - minVisible) * Math.pow(normalizedProgress, curveExp);

  // 광학 파라미터
  // - 보통 유리 IOR ~= 1.5 -> F0 ~= 0.04
  // - 모서리(사선 시야)에서 Fresnel 반사가 강해지고, 안쪽으로는 Beer-Lambert로 빠르게 감쇠.
  const f0 = 0.04;
  const edgeSpreadPct = 20; // 테두리에서 블록 폭의 1/5 지점까지 색 분포
  const attenuationSigma = 4.6;
  const peakEdgeAlpha = 0.64;
  const glowAlpha = 0.32 * strength;
  const dropShadowAlpha = 0.16 * strength;

  const edgeGradients = [
    buildFresnelEdgeGradient('to bottom', tintRgb, strength, edgeSpreadPct, peakEdgeAlpha, f0, attenuationSigma),
    buildFresnelEdgeGradient('to top', tintRgb, strength, edgeSpreadPct, peakEdgeAlpha, f0, attenuationSigma),
    buildFresnelEdgeGradient('to right', tintRgb, strength, edgeSpreadPct, peakEdgeAlpha, f0, attenuationSigma),
    buildFresnelEdgeGradient('to left', tintRgb, strength, edgeSpreadPct, peakEdgeAlpha, f0, attenuationSigma),
  ];

  // 미세한 스펙큘러/코너 카스틱으로 "유리 표면" 감각을 보강.
  const cornerCausticAlpha = 0.225 * strength;
  const cornerCaustic = [
    `radial-gradient(circle at 0% 0%, ${toRgba(tintRgb, cornerCausticAlpha)} 0%, ${toRgba(tintRgb, 0)} 34%)`,
    `radial-gradient(circle at 100% 0%, ${toRgba(tintRgb, cornerCausticAlpha)} 0%, ${toRgba(tintRgb, 0)} 34%)`,
    `radial-gradient(circle at 0% 100%, ${toRgba(tintRgb, cornerCausticAlpha)} 0%, ${toRgba(tintRgb, 0)} 34%)`,
    `radial-gradient(circle at 100% 100%, ${toRgba(tintRgb, cornerCausticAlpha)} 0%, ${toRgba(tintRgb, 0)} 34%)`,
  ];

  const borderAlpha = exponent <= 0
    ? 0
    : clamp(0.02 + 0.62 * Math.pow(strength, 0.78), 0, 0.66);
  const borderColor = toRgba(tintRgb, borderAlpha);
  const glowColor = toRgba(tintRgb, glowAlpha);
  const rimGlowBlurPx = 13;
  const blurPx = 7 + 6 * strength;
  const saturation = 1.055 + 0.115 * strength;
  const contrast = 1.033 + 0.052 * strength;
  const brightness = 0.968 + 0.023 * strength;
  const textColor = '#f8fafc';
  const textShadow = [
    '0 1px 2px rgba(0,0,0,0.62)',
    '0 0 1px rgba(0,0,0,0.84)',
    '0 0 10px rgba(255,255,255,0.18)',
  ].join(', ');

  return {
    // 중앙은 완전 투명 유지
    backgroundColor: 'rgba(255,255,255,0)',
    backgroundImage: [...edgeGradients, ...cornerCaustic].join(', '),
    border: `1.1px solid ${borderColor}`,
    boxShadow: [
      // 볼록(raised) 질감: 상/좌는 밝게, 하/우는 어둡게
      `inset 0 1px 0 rgba(255,255,255,${(0.74 * strength).toFixed(3)})`,
      `inset 1px 0 0 rgba(255,255,255,${(0.22 * strength).toFixed(3)})`,
      `inset 0 -1px 0 rgba(0,0,0,${(0.14 * strength).toFixed(3)})`,
      `inset -1px 0 0 rgba(0,0,0,${(0.08 * strength).toFixed(3)})`,
      `0 -1px 2px rgba(255,255,255,${(0.16 * strength).toFixed(3)})`,
      `0 0 ${rimGlowBlurPx}px ${glowColor}`,
      `0 8px 16px rgba(0,0,0,${dropShadowAlpha.toFixed(3)})`,
    ].join(', '),
    backdropFilter: `blur(${blurPx.toFixed(2)}px) saturate(${saturation.toFixed(3)}) contrast(${contrast.toFixed(3)}) brightness(${brightness.toFixed(3)})`,
    WebkitBackdropFilter: `blur(${blurPx.toFixed(2)}px) saturate(${saturation.toFixed(3)}) contrast(${contrast.toFixed(3)}) brightness(${brightness.toFixed(3)})`,
    color: textColor,
    WebkitTextStroke: '0.45px rgba(0,0,0,0.42)',
    textShadow,
  };
};

// --- New Helper for Previews ---
export const resolveSkinAppearance = (value: number, skin: { id?: string; hex: string; style?: any }): ResolvedTileAppearance => {
  const skinId = skin.id || '';

  // Look up style from catalog if not provided (backward compatibility)
  let styleData = skin.style;
  if (!styleData && skinId) {
    const entry = SKIN_CATALOG.find((e) => e.id === skinId);
    if (entry) styleData = entry.style;
  }

  if (isLiquidGlassSkinId(skinId)) {
    const style = buildLiquidGlassTileStyle(value, skin.hex);
    if (styleData?.customCss) {
      applyStructuralCss(style, styleData.customCss as string);
    }
    // Liquid Glass는 동적 테두리/글로우가 핵심이므로 border/shadow 오버라이드는 막고,
    // 텍스트 컬러만 선택적으로 허용한다.
    if (typeof styleData?.textColor === 'string' && styleData.textColor) {
      style.color = styleData.textColor;
    }
    return {
      className: getTileColor(value),
      style: sanitizeTileAppearanceStyle(style),
    };
  }

  // ── Neon Block: 원본 버튼 UI를 정사각형 블록으로 변환 (CSS 클래스 기반) ──
  const NEON_BLOCK_SKIN_ID = 'skin_digital_neon_block';
  const isNeonParallelSkin = skinId.startsWith(NEON_BLOCK_PARALLEL_SKIN_PREFIX);
  if (isNeonParallelSkin) {
    const tintRgb = hexToRgb(skin.hex);
    const tintHsl = rgbToHsl(tintRgb);
    const intensity = clamp(Math.log2(Math.max(1, value)) / 16, 0, 1);
    const edgeAlpha = 0.26 + intensity * 0.36;
    const edgeSideAlpha = 0.22 + intensity * 0.3;
    const cornerAlpha = 0.28 + intensity * 0.28;
    const afterAlpha = 0.2 + intensity * 0.32;

    const style: Record<`--${string}`, string> = {
      '--button-color': '#101010',
      '--highlight-color-hue': `${Math.round(tintHsl.h)}deg`,
      '--neon-edge-alpha': edgeAlpha.toFixed(3),
      '--neon-edge-side-alpha': edgeSideAlpha.toFixed(3),
      '--neon-corner-alpha': cornerAlpha.toFixed(3),
      '--neon-after-edge-alpha': afterAlpha.toFixed(3),
      '--neon-hover-gain': '1.1',
      '--neon-active-gain': '1.2',
      '--neon-bottom-line-alpha': '0.4',
    };

    return {
      className: 'skin-neon-block',
      style: sanitizeTileAppearanceStyle(style as CSSProperties),
    };
  }

  if (skinId === NEON_BLOCK_SKIN_ID) {
    const style: Record<`--${string}`, string> = {
      '--button-color': '#101010',
      '--highlight-color-hue': '210deg',
      '--neon-hover-gain': '1.1',
      '--neon-active-gain': '1.2',
      '--neon-bottom-line-alpha': '0.38',
    };
    return {
      className: 'skin-neon-block',
      style: sanitizeTileAppearanceStyle(style as CSSProperties),
    };
  }

  if (skinId === EXPLORE_GALAXY_SKIN_ID) {
    const style: CSSProperties = {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      border: 'none',
      boxShadow: 'none',
      color: '#e5e7eb',
      textShadow: '0 1px 2px rgba(0,0,0,0.65), 0 0 10px rgba(194, 184, 255, 0.32)',
    };
    if (styleData?.customCss) {
      applyStructuralCss(style, styleData.customCss as string);
    }
    if (typeof styleData?.textColor === 'string' && styleData.textColor) {
      style.color = styleData.textColor;
    }
    return {
      className: 'skin-explore-galaxy-tile',
      style: sanitizeTileAppearanceStyle(style),
    };
  }
  // ── 1. Explicit palette skins (Neon, Pop Art, Stained Glass) ──
  const explicitPalette = SKIN_EXPLICIT_PALETTES[skinId];
  if (explicitPalette) {
    return resolveExplicitPaletteSkin(value, skinId, explicitPalette, styleData);
  }

  // ── 2. HSL progression skins (all complex skins) ──
  const progression = SKIN_PROGRESSIONS[skinId];
  if (progression) {
    return resolveProgressionSkin(value, skinId, progression, styleData);
  }

  // ── 3. Legacy fallback (basic color skins: skin_0 through skin_23) ──
  if (skinId.startsWith(MESH_SWATCH_SKIN_PREFIX)) {
    return {
      className: getTileColor(value),
      style: sanitizeTileAppearanceStyle(buildMeshSkinStyle(value, skin.hex)),
    };
  }

  const baseHex = getSkinColorForValue(value, skin.hex);

  const { backgroundImage, baseRgb } = buildGradient(baseHex);
  return {
    className: getTileColor(value),
    style: sanitizeTileAppearanceStyle({
      backgroundImage,
      backgroundColor: baseHex,
      ...getWhiteTextStyleForBackground(baseRgb),
    }),
  };
};

// ==============================================
// Progression Skin Renderer
// ==============================================
// Interpolates HSL from start→end based on log2(value).
// Produces a rich gradient per value with auto text color & border.

function resolveProgressionSkin(
  value: number,
  skinId: string,
  prog: [number, number, number, number, number, number],
  styleData?: any,
): ResolvedTileAppearance {
  const t = clamp(Math.log2(Math.max(1, value)) / 15, 0, 1);

  const h = prog[0] + (prog[3] - prog[0]) * t;
  const s = prog[1] + (prog[4] - prog[1]) * t;
  const l = prog[2] + (prog[5] - prog[2]) * t;

  const baseHex = rgbToHex(hslToRgb({ h, s, l }));
  const baseRgb = hexToRgb(baseHex);
  const { backgroundImage } = buildGradient(baseHex);

  const renderMode: SkinRenderMode = SKIN_RENDER_MODES[skinId] || 'standard';

  const style: CSSProperties = {
    backgroundColor: baseHex,
    backgroundImage: renderMode === 'flat' ? 'none' : backgroundImage,
    borderStyle: 'solid',
    borderWidth: styleData?.type === 'css-pattern' ? '2px' : '1px',
    borderColor: getAutoBorderColor(h, s, l),
    boxShadow: renderMode === 'flat' ? 'none' : getValueShadow(t),
    ...getAutoTextColor(baseRgb),
  };

  // Apply structural properties from skin definition (customCss)
  if (styleData) {
    // For css-pattern skins: overlay the pattern on the palette gradient
    if ((styleData.type === 'css-pattern' || styleData.type === 'gradient') && styleData.value) {
      style.backgroundImage = `${styleData.value}, ${backgroundImage}`;
      (style as any).backgroundBlendMode = 'overlay';
    }

    // Apply customCss properties (border-radius, font, etc.) but skip color overrides
    if (styleData.customCss) {
      applyStructuralCss(style, styleData.customCss as string);
    }
    applySkinStyleOverrides(style, styleData);
  }

  // 대리석: 교차 줄무늬 오버레이로 대리석 결 표현
  if (skinId === 'skin_material_marble') {
    const marbleLine = [
      'repeating-linear-gradient(45deg, transparent 0px, transparent 12px, rgba(255,255,255,0.08) 12px, rgba(255,255,255,0.08) 13px)',
      'repeating-linear-gradient(135deg, transparent 0px, transparent 18px, rgba(0,0,0,0.05) 18px, rgba(0,0,0,0.05) 19px)',
    ].join(', ');
    style.backgroundImage = `${marbleLine}, ${style.backgroundImage || 'none'}`;
  }

  // Apply animation if defined
  const anim = SKIN_ANIMATIONS[skinId];
  if (anim) {
    style.animation = anim;
  }

  return { className: getTileColor(value), style: sanitizeTileAppearanceStyle(style) };
}

// ==============================================
// Explicit Palette Skin Renderer
// ==============================================
// Uses a specific hex color per value index (16 colors).
// Handles special render modes (neon glow, wireframe, etc.).

function resolveExplicitPaletteSkin(
  value: number,
  skinId: string,
  palette: string[],
  styleData?: any,
): ResolvedTileAppearance {
  const exponent = getValueExponent(value);
  const paletteHex = resolveExtendedPaletteColor(exponent, palette);
  const paletteRgb = hexToRgb(paletteHex);
  const renderMode: SkinRenderMode = SKIN_RENDER_MODES[skinId] || 'standard';
  const t = clamp(Math.log2(Math.max(1, value)) / 15, 0, 1);

  const style: CSSProperties = {};

  if (renderMode === 'neon') {
    // ── Neon: Black BG, colored text/glow ──
    style.backgroundColor = '#0a0a0a';
    style.backgroundImage = 'none';
    style.color = paletteHex;
    style.textShadow = `0 0 6px ${paletteHex}, 0 0 14px ${paletteHex}`;
    style.borderStyle = 'solid';
    style.borderWidth = '1.5px';
    style.borderColor = paletteHex;
    style.boxShadow = `0 0 5px ${paletteHex}80, 0 0 12px ${paletteHex}40, inset 0 0 6px ${paletteHex}30`;
  } else {
    // ── Standard explicit palette ──
    const { backgroundImage } = buildGradient(paletteHex);
    style.backgroundColor = paletteHex;
    style.backgroundImage = renderMode === 'flat' ? 'none' : backgroundImage;
    style.borderStyle = 'solid';
    style.borderWidth = styleData?.type === 'css-pattern' ? '2px' : '1px';
    style.borderColor = `rgba(0,0,0,0.25)`;
    style.boxShadow = renderMode === 'flat' ? 'none' : getValueShadow(t);
    Object.assign(style, getAutoTextColor(paletteRgb));

    // Stained Glass: thick dark border (leaded glass look)
    if (skinId === 'skin_art_stained_glass') {
      style.borderWidth = '2.5px';
      style.borderColor = '#1a1a1a';
      style.boxShadow = `inset 0 0 8px rgba(0,0,0,0.45), ${getValueShadow(t)}`;
    }

    // Mesh Gradient: use the same stable renderer as mesh swatch skins.
    if (skinId === 'skin_art_mesh') {
      const meshStep = getValueExponent(value);
      const meshEvolution = clamp(meshStep / 15, 0, 1);
      Object.assign(style, buildMeshLayerStyle(paletteHex, { seed: skinId, evolution: meshEvolution, stepIndex: meshStep }));
    }
  }

  // Apply customCss if defined
  if (styleData?.customCss) {
    applyStructuralCss(style, styleData.customCss as string);
  }
  applySkinStyleOverrides(style, styleData);

  if (skinId === 'skin_digital_win98') {
    // Win98 스킨은 customCss에서 border:none이 들어와 기본 테두리가 사라지므로,
    // 값 전 구간에서 보더 대비를 다시 강하게 맞춘다.
    const lum = relativeLuminance(paletteRgb);
    const outerBorder = lum >= 0.62 ? '#3f3f3f' : lum >= 0.4 ? '#2f2f2f' : '#bfbfbf';
    const bevelDark = lum >= 0.62 ? '#5c5c5c' : '#3d3d3d';
    const bevelLight = lum >= 0.62 ? '#ffffff' : '#d5d5d5';
    style.border = `1px solid ${outerBorder}`;
    style.boxShadow = [
      `inset -1px -1px ${bevelDark}`,
      `inset 1px 1px ${bevelLight}`,
      'inset -2px -2px rgba(0,0,0,0.32)',
      'inset 2px 2px rgba(255,255,255,0.24)',
    ].join(', ');
  }

  // Apply animation
  const anim = SKIN_ANIMATIONS[skinId];
  if (anim) {
    style.animation = anim;
  }

  return { className: getTileColor(value), style: sanitizeTileAppearanceStyle(style) };
}

const normalizeHueDelta = (delta: number): number => {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
};

// Explicit palette는 기본 16단계(1~32768) 기준이지만,
// 그 이상 값에서도 마지막 색으로 고정하지 않고 꼬리 구간의 변화량을 외삽해
// 미리보기/실게임에서 일관된 색상 progression을 유지한다.
const resolveExtendedPaletteColor = (exponent: number, palette: string[]): string => {
  if (palette.length === 0) return '#ffffff';
  if (exponent < palette.length) return palette[exponent];
  if (palette.length === 1) return palette[0];

  const lastIndex = palette.length - 1;
  const overflowSteps = exponent - lastIndex;
  const prevHsl = rgbToHsl(hexToRgb(palette[lastIndex - 1]));
  const lastHsl = rgbToHsl(hexToRgb(palette[lastIndex]));

  const hueStep = normalizeHueDelta(lastHsl.h - prevHsl.h);
  const satStep = lastHsl.s - prevHsl.s;
  const lightStep = lastHsl.l - prevHsl.l;

  const nextH = (lastHsl.h + hueStep * overflowSteps + 360 * 8) % 360;
  const nextS = clamp(lastHsl.s + satStep * overflowSteps, 0, 100);
  const nextL = clamp(lastHsl.l + lightStep * overflowSteps, 3, 97);

  return rgbToHex(hslToRgb({ h: nextH, s: nextS, l: nextL }));
};

// ==============================================
// Auto Text Color
// ==============================================
// Chooses white or dark text based on background luminance.
// For light backgrounds, adds a subtle outline for legibility.

function getAutoTextColor(bgRgb: Rgb): CSSProperties {
  // Always white text – adaptive shadow handles legibility on all backgrounds.
  return getWhiteTextStyleForBackground(bgRgb);
}

// ==============================================
// Structural CSS Parser
// ==============================================
// Applies customCss properties that contribute to structure/texture,
// but skips color-related properties (handled by palette system).

const SKIP_CSS_PROPS = new Set([
  'color',
  // 'background-color', 'backgroundColor', -- Allow background color override for glass/slime skins
  'background-image', 'backgroundImage',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'z-index',
  'zIndex',
  'pointer-events',
  'pointerEvents',
  'touch-action',
  'touchAction',
  'transform',
  'transform-origin',
  'transformOrigin',
  'transform-style',
  'transformStyle',
  'translate',
  'rotate',
  'scale',
  // 애니메이션 속성: Board.tsx의 transition/willChange가 항상 우선되어야 함
  'transition',
  'transition-property', 'transitionProperty',
  'transition-duration', 'transitionDuration',
  'transition-timing-function', 'transitionTimingFunction',
  'transition-delay', 'transitionDelay',
  'will-change', 'willChange',
  'animation',
  'animation-name', 'animationName',
  'animation-duration', 'animationDuration',
  'opacity',
]);

function applyStructuralCss(style: CSSProperties, cssString: string): void {
  cssString.split(';').forEach((rule) => {
    const colonIdx = rule.indexOf(':');
    if (colonIdx === -1) return;
    const rawKey = rule.slice(0, colonIdx).trim();
    const rawValue = rule.slice(colonIdx + 1).trim();
    if (!rawKey || !rawValue) return;
    if (SKIP_CSS_PROPS.has(rawKey)) return;
    const camelKey = rawKey.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    if (SKIP_CSS_PROPS.has(camelKey)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (style as any)[camelKey] = rawValue;
  });
}

function applySkinStyleOverrides(
  style: CSSProperties,
  styleData?: { textColor?: unknown; borderColor?: unknown; shadow?: unknown } | null
): void {
  if (!styleData) return;
  if (typeof styleData.textColor === 'string' && styleData.textColor) {
    style.color = styleData.textColor;
  }
  if (typeof styleData.borderColor === 'string' && styleData.borderColor) {
    style.borderColor = styleData.borderColor;
  }
  if (typeof styleData.shadow === 'string' && styleData.shadow) {
    style.boxShadow = styleData.shadow;
  }
}

export const resolveTileAppearance = (
  value: number,
  settings: BlockCustomizationSettingsV1,
  skinSettings?: SkinSettings
): ResolvedTileAppearance => {
  if (!Number.isFinite(value) || value <= 0) {
    return { className: getTileColor(0) };
  }

  // 1순위: 활성 스킨
  if (skinSettings?.activeSkinId) {
    // 컬렉션 미리보기와 실제 게임 타일이 동일한 색/스타일 경로를 사용하도록
    // 카탈로그 정의를 우선 소스로 사용한다.
    const catalogSkin = SKIN_CATALOG.find((entry) => entry.id === skinSettings.activeSkinId);
    if (catalogSkin) {
      return resolveSkinAppearance(value, catalogSkin);
    }

    // 구버전/예외 데이터 호환용 fallback
    const ownedSkin = skinSettings.ownedSkins.find((skin) => skin.id === skinSettings.activeSkinId);
    if (ownedSkin) {
      return resolveSkinAppearance(value, ownedSkin);
    }
  }


  // 2순위: 기존 커스터마이징 로직
  const baseClassName = getTileColor(value);
  const override = settings.perValue[String(value)];

  if (override?.kind === 'image' && override.imageDataUrl) {
    return {
      className: baseClassName,
      style: sanitizeTileAppearanceStyle({
        backgroundImage: `linear-gradient(rgba(0,0,0,0.22), rgba(0,0,0,0.22)), url(${override.imageDataUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: WHITE_TEXT_COLOR,
        WebkitTextStroke: '1px rgba(0,0,0,0.55)',
        textShadow: [
          '0 1px 0 rgba(0,0,0,0.45)',
          '0 -1px 0 rgba(0,0,0,0.45)',
          '1px 0 0 rgba(0,0,0,0.45)',
          '-1px 0 0 rgba(0,0,0,0.45)',
          '0 1px 2px rgba(0,0,0,0.35)',
        ].join(', '),
      }),
    };
  }

  if (override?.kind === 'color' && override.color) {
    const { backgroundImage, baseRgb } = buildGradient(override.color);
    return {
      className: baseClassName,
      style: sanitizeTileAppearanceStyle({
        backgroundImage,
        backgroundColor: override.color,
        ...getWhiteTextStyleForBackground(baseRgb),
      }),
    };
  }

  if (settings.globalPalette.enabled) {
    const baseHex = getGlobalPaletteColorForValue(value, settings.globalPalette);
    const { backgroundImage, baseRgb } = buildGradient(baseHex);
    return {
      className: baseClassName,
      style: sanitizeTileAppearanceStyle({
        backgroundImage,
        backgroundColor: baseHex,
        ...getWhiteTextStyleForBackground(baseRgb),
      }),
    };
  }

  return { className: baseClassName };
};

export const getDefaultTileValuesForCustomization = (): number[] => {
  const styledKeys = Object.keys(TILE_COLORS)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0);
  const styledMax = styledKeys.length > 0 ? Math.max(...styledKeys) : 2048;

  const hardMax = Math.max(styledMax * 8, 16384);
  const values: number[] = [];
  for (let v = 1; v <= hardMax; v *= 2) values.push(v);
  return values;
};
