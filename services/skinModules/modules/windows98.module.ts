import type { CSSProperties } from 'react';
import { SKIN_EXPLICIT_PALETTES } from '../../../config/skinPalettes';
import type { SkinModule } from '../contracts';

const getValueExponent = (value: number): number => Math.max(0, Math.floor(Math.log2(Math.max(1, value))));

const clamp = (n: number, min: number, max: number): number => {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const relativeLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const toLin = (c: number) => {
    const v = clamp(c, 0, 255) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b);
};

const normalizeHueDelta = (delta: number): number => {
  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
};

const rgbToHsl = (rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  if (d === 0) return { h: 0, s: 0, l: l * 100 };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4; break;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
};

const hslToRgb = (hsl: { h: number; s: number; l: number }): { r: number; g: number; b: number } => {
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
  let r1 = 0; let g1 = 0; let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else[r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
};

const rgbToHex = (rgb: { r: number; g: number; b: number }): string => {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

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

  return rgbToHex(hslToRgb({
    h: (lastHsl.h + hueStep * overflowSteps + 360 * 8) % 360,
    s: clamp(lastHsl.s + satStep * overflowSteps, 0, 100),
    l: clamp(lastHsl.l + lightStep * overflowSteps, 3, 97),
  }));
};

export const windows98Module: SkinModule = {
  skinId: 'skin_digital_win98',
  premiumUiThemeId: 'retro_windows_98',
  resolveTileAppearance: ({ value, styleData, helpers }) => {
    const palette = SKIN_EXPLICIT_PALETTES.skin_digital_win98;
    if (!Array.isArray(palette) || palette.length === 0) return null;

    const exponent = getValueExponent(value);
    const paletteHex = resolveExtendedPaletteColor(exponent, palette);
    const paletteRgb = hexToRgb(paletteHex);
    const lum = relativeLuminance(paletteRgb);
    const outerBorder = lum >= 0.62 ? '#3f3f3f' : lum >= 0.4 ? '#2f2f2f' : '#bfbfbf';
    const bevelDark = lum >= 0.62 ? '#5c5c5c' : '#3d3d3d';
    const bevelLight = lum >= 0.62 ? '#ffffff' : '#d5d5d5';

    const style: CSSProperties = {
      backgroundColor: paletteHex,
      border: `1px solid ${outerBorder}`,
      boxShadow: [
        `inset -1px -1px ${bevelDark}`,
        `inset 1px 1px ${bevelLight}`,
        'inset -2px -2px rgba(0,0,0,0.32)',
        'inset 2px 2px rgba(255,255,255,0.24)',
      ].join(', '),
    };

    if (styleData?.customCss) {
      helpers.applyStructuralCss(style, styleData.customCss);
    }
    helpers.applySkinStyleOverrides(style, styleData);
    style.border = `1px solid ${outerBorder}`;
    style.boxShadow = [
      `inset -1px -1px ${bevelDark}`,
      `inset 1px 1px ${bevelLight}`,
      'inset -2px -2px rgba(0,0,0,0.32)',
      'inset 2px 2px rgba(255,255,255,0.24)',
    ].join(', ');

    return {
      className: helpers.getTileColor(value),
      style: helpers.sanitizeTileAppearanceStyle(style),
    };
  },
};
