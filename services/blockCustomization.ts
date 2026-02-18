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

export const getWhiteTextStyleForBackground = (backgroundRgb: Rgb): CSSProperties => {
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

export const getSkinColorForValue = (value: number, skinHex: string): string => {
  const skinRgb = hexToRgb(skinHex);
  const exp = Math.log2(value);
  const t = clamp(exp / 15, 0, 1); // 2^15=32768까지 커버
  const mixed = mixRgb(WHITE_RGB, skinRgb, t);
  return rgbToHex(mixed);
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
  const baseHex = getSkinColorForValue(value, skin.hex);
  
  if (skinId.startsWith('skin_mesh_swatch_')) {
    const baseRgb = hexToRgb(baseHex);
    // Mesh Gradient Logic: using the current base color as the anchor
    const hsl = rgbToHsl(baseRgb);
    
    // Create richer variations for the mesh blobs
    const h1 = (hsl.h + 25) % 360; 
    const h2 = (hsl.h - 25 + 360) % 360;
    const h3 = (hsl.h + 45) % 360; // Slightly more shift for center
    
    // Vary lightness/saturation significantly to create visible blobs
    const c1 = rgbToHex(hslToRgb({ h: h1, s: Math.min(hsl.s + 10, 95), l: Math.min(hsl.l + 10, 85) }));
    const c2 = rgbToHex(hslToRgb({ h: h2, s: Math.max(hsl.s - 5, 40), l: Math.max(hsl.l - 10, 40) }));
    const c3 = rgbToHex(hslToRgb({ h: h3, s: hsl.s, l: Math.min(hsl.l + 20, 90) }));

    const backgroundImage = `
      radial-gradient(circle at 10% 20%, ${c1} 0%, transparent 60%),
      radial-gradient(circle at 90% 80%, ${c2} 0%, transparent 60%),
      radial-gradient(circle at 50% 50%, ${c3} 0%, transparent 70%),
      linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 100%)
    `;

    return {
      className: getTileColor(value),
      style: {
        backgroundColor: baseHex,
        backgroundImage,
        backgroundBlendMode: 'normal',
        border: 'none',
        fontWeight: 800,
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        color: '#ffffff', // Force white text for cleaner look on mesh
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1), 0 2px 5px rgba(0,0,0,0.1)',
        // Force hardware acceleration for smooth gradients
        transform: 'translateZ(0)',
      },
    };
  }

  const { backgroundImage, baseRgb } = buildGradient(baseHex);
  return {
    className: getTileColor(value),
    style: {
      backgroundImage,
      backgroundColor: baseHex,
      ...getWhiteTextStyleForBackground(baseRgb),
    },
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

  // Apply animation if defined
  const anim = SKIN_ANIMATIONS[skinId];
  if (anim) {
    style.animation = anim;
  }

  return { className: getTileColor(value), style };
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
  const exponent = Math.max(0, Math.floor(Math.log2(Math.max(1, value))));
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
    
    // Mesh Gradient Logic
    if (skinId === 'skin_art_mesh') {
      const hsl = rgbToHsl(paletteRgb);
      const h1 = (hsl.h + 30) % 360; // Analogous 1
      const h2 = (hsl.h - 30 + 360) % 360; // Analogous 2
      const h3 = (hsl.h + 180) % 360; // Complementary

      const c1 = rgbToHex(hslToRgb({ h: h1, s: 70, l: 65 }));
      const c2 = rgbToHex(hslToRgb({ h: h2, s: 80, l: 75 }));
      const c3 = rgbToHex(hslToRgb({ h: h3, s: 60, l: 85 })); // soft complementary

      // Soft mesh using large radial gradients
      style.backgroundImage = `
        radial-gradient(at 0% 0%, ${c2} 0px, transparent 50%),
        radial-gradient(at 100% 0%, ${c1} 0px, transparent 50%),
        radial-gradient(at 100% 100%, ${c2} 0px, transparent 50%),
        radial-gradient(at 0% 100%, ${c1} 0px, transparent 50%),
        radial-gradient(at 50% 50%, ${c3} 0px, transparent 50%)
      `;
      style.backgroundColor = paletteHex;
      style.borderColor = 'rgba(255,255,255,0.4)';
    }
  }

  // Apply customCss if defined
  if (styleData?.customCss) {
    applyStructuralCss(style, styleData.customCss as string);
  }
  applySkinStyleOverrides(style, styleData);

  // Apply animation
  const anim = SKIN_ANIMATIONS[skinId];
  if (anim) {
    style.animation = anim;
  }

  return { className: getTileColor(value), style };
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
  const lum = relativeLuminance(bgRgb);

  if (lum > 0.55) {
    // Light background: dark text with subtle shadow
    return {
      color: '#1a1a2e',
      textShadow: '0 1px 1px rgba(255,255,255,0.3)',
    };
  }

  // Dark background: white text
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
