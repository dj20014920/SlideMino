import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SKIN_CATALOG } from '../constants';
import { PET_SKINS } from '../config/petSkins.config';
import { resolveSkinAppearance } from './blockCustomization';

const decodeSvgBackground = (backgroundImage: string): string => {
  const match = backgroundImage.match(/base64,([^")]+)/);
  if (!match) return '';
  return Buffer.from(match[1], 'base64').toString('utf8');
};

const hexToRgb = (hex: string): [number, number, number] => {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
};

const toLinear = (value: number): number => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const getLuminance = (hex: string): number => {
  const [red, green, blue] = hexToRgb(hex);
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
};

const getContrastRatio = (foreground: string, background: string): number => {
  const fg = getLuminance(foreground);
  const bg = getLuminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
};

const getThemeVariables = (css: string, themeName: string): Record<string, string> => {
  const re = new RegExp(`\\.theme-cute-${themeName}\\s*\\{([\\s\\S]*?)\\}`, 'g');
  const vars: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    for (const varMatch of match[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
      vars[varMatch[1]] = varMatch[2].trim();
    }
  }
  return vars;
};

describe('cute pet skin appearances', () => {
  it('generates distinct pet SVGs instead of falling back to the black cat', () => {
    const cuteSkins = SKIN_CATALOG.filter((entry) => entry.id?.startsWith('skin_cute_'));
    const appearances = cuteSkins.map((entry) => {
      const appearance = resolveSkinAppearance(16, entry, { premiumUiThemeId: entry.premiumUiThemeId });
      return {
        id: entry.id,
        backgroundImage: appearance.style?.backgroundImage ?? '',
        svg: decodeSvgBackground(appearance.style?.backgroundImage ?? ''),
      };
    });

    expect(appearances).toHaveLength(15);
    expect(new Set(appearances.map((item) => item.backgroundImage)).size).toBe(appearances.length);
    expect(appearances.filter((item) => item.id !== 'skin_cute_black_cat' && item.svg.includes('#252526'))).toHaveLength(0);
  });

  it('keeps every pet theme text and badge color at AA-readable contrast', () => {
    const css = readFileSync(new URL('../public/styles/cute-pet-theme.css', import.meta.url), 'utf8');
    const checks: Array<[string, string, string]> = [
      ['text/bg', 'pet-text-color', 'pet-bg'],
      ['muted/bg', 'pet-text-muted', 'pet-bg'],
      ['accent/bg', 'pet-accent-mint', 'pet-bg'],
      ['text/cell', 'pet-text-color', 'pet-cell-bg'],
      ['muted/cell', 'pet-text-muted', 'pet-cell-bg'],
      ['accent/cell', 'pet-accent-mint', 'pet-cell-bg'],
      ['bg/accent button', 'pet-bg', 'pet-accent-mint'],
      ['white/red badge', '#ffffff', 'pet-accent-red'],
    ];

    const failures = PET_SKINS.flatMap((skin) => {
      const themeName = skin.id.replace('skin_cute_', '').replaceAll('_', '-');
      const vars = getThemeVariables(css, themeName);

      return checks.flatMap(([label, foregroundKey, backgroundKey]) => {
        const foreground = foregroundKey.startsWith('#') ? foregroundKey : vars[foregroundKey];
        const background = backgroundKey.startsWith('#') ? backgroundKey : vars[backgroundKey];
        const ratio = getContrastRatio(foreground, background);

        return ratio < 4.5
          ? [{ skin: skin.id, label, ratio: Number(ratio.toFixed(2)), foreground, background }]
          : [];
      });
    });

    expect(failures).toEqual([]);
  });
});
