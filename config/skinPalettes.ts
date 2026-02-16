
// Type definitions
export type HSLProgression = [number, number, number, number, number, number];
export type SkinRenderMode = 'standard' | 'neon' | 'glass' | 'flat' | 'matte';

// Base logic exports that might be needed by blockCustomization
export const getValueShadow = (level: number, mode: SkinRenderMode = 'standard'): string | undefined => undefined;
export const getAutoBorderColor = (h: number, s: number, l: number, mode: SkinRenderMode = 'standard'): string | undefined => undefined;

export const SKIN_PROGRESSIONS: Record<string, HSLProgression> = {
};
export const SKIN_EXPLICIT_PALETTES: Record<string, string[]> = {
  skin_digital_win98: [
    '#ffffff', // 1
    '#f5f5f5', // 2
    '#ebebeb', // 4
    '#dfdfdf', // 8
    '#d2d2d2', // 16
    '#c5c5c5', // 32
    '#b8b8b8', // 64
    '#ababab', // 128
    '#9d9d9d', // 256
    '#909090', // 512
    '#838383', // 1024
    '#767676', // 2048
    '#696969', // 4096
    '#5d5d5d', // 8192
    '#515151', // 16384
    '#454545', // 32768
  ],
  // Evervault: white → dark with increasing purple tint
  skin_digital_evervault: [
    '#ffffff', // 1   - pure white
    '#f0eaf8', // 2   - very faint purple
    '#e0d5f0', // 4   - light purple tint
    '#cfc0e8', // 8   - soft lavender
    '#bbaade', // 16  - medium lavender
    '#a893d4', // 32  - purple-ish
    '#9578c8', // 64  - deeper purple
    '#825dbc', // 128 - rich purple
    '#6f42b0', // 256 - dark purple
    '#5c2da3', // 512 - deep purple
    '#4a1a96', // 1024- very dark purple
    '#3a0d88', // 2048- near black purple
    '#2d0a6e', // 4096
    '#220855', // 8192
    '#18063d', // 16384
    '#0f0428', // 32768 - almost black
  ],
};
export const SKIN_ANIMATIONS: Record<string, string> = {};
export const SKIN_RENDER_MODES: Record<string, SkinRenderMode> = {
  skin_digital_win98: 'standard',
  skin_digital_evervault: 'flat',
};
