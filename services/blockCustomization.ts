import type { CSSProperties } from 'react';
import { TILE_COLORS, getTileColor } from '../constants';
import type { BlockCustomizationSettingsV1, GlobalTilePaletteSettings, TileSkinOverride } from '../types';

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

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const clamp = (n: number, min: number, max: number): number => {
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

const hexToRgb = (hex: string): Rgb => {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = ({ r, g, b }: Rgb): string => {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => {
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
  else [r1, g1, b1] = [c, 0, x];

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

const getWhiteTextStyleForBackground = (backgroundRgb: Rgb): CSSProperties => {
  // White text is fixed per product requirement.
  // On very bright tiles, add a thin black outline (stroke-like) to preserve legibility.
  const lum = relativeLuminance(backgroundRgb);
  const needsOutline = lum > 0.7;
  return {
    color: WHITE_TEXT_COLOR,
    // WebKit stroke (works well on iOS Safari) + a small shadow as a non-webkit fallback.
    WebkitTextStroke: needsOutline ? '1px rgba(0,0,0,0.55)' : undefined,
    textShadow: needsOutline
      ? [
          '0 1px 0 rgba(0,0,0,0.45)',
          '0 -1px 0 rgba(0,0,0,0.45)',
          '1px 0 0 rgba(0,0,0,0.45)',
          '-1px 0 0 rgba(0,0,0,0.45)',
          '0 1px 2px rgba(0,0,0,0.35)',
        ].join(', ')
      : '0 1px 2px rgba(0,0,0,0.28)',
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

const buildGradient = (baseHex: string): { backgroundImage: string; baseRgb: Rgb } => {
  const baseRgb = hexToRgb(baseHex);
  const hi = rgbToHex(mixRgb(baseRgb, { r: 255, g: 255, b: 255 }, 0.14));
  const lo = rgbToHex(mixRgb(baseRgb, { r: 0, g: 0, b: 0 }, 0.18));
  return {
    baseRgb,
    backgroundImage: `linear-gradient(135deg, ${hi} 0%, ${baseHex} 45%, ${lo} 100%)`,
  };
};

export const resolveTileAppearance = (
  value: number,
  settings: BlockCustomizationSettingsV1
): ResolvedTileAppearance => {
  if (!Number.isFinite(value) || value <= 0) {
    return { className: getTileColor(0) };
  }

  const baseClassName = getTileColor(value);
  const override = settings.perValue[String(value)];

  if (override?.kind === 'image' && override.imageDataUrl) {
    return {
      className: baseClassName,
      style: {
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
      },
    };
  }

  if (override?.kind === 'color' && override.color) {
    const { backgroundImage, baseRgb } = buildGradient(override.color);
    return {
      className: baseClassName,
      style: {
        backgroundImage,
        backgroundColor: override.color,
        ...getWhiteTextStyleForBackground(baseRgb),
      },
    };
  }

  if (settings.globalPalette.enabled) {
    const baseHex = getGlobalPaletteColorForValue(value, settings.globalPalette);
    const { backgroundImage, baseRgb } = buildGradient(baseHex);
    return {
      className: baseClassName,
      style: {
        backgroundImage,
        backgroundColor: baseHex,
        ...getWhiteTextStyleForBackground(baseRgb),
      },
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
