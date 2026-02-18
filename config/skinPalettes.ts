
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

  skin_art_mesh: [
    '#e0c3fc', // 1: Soft Purple
    '#ff9a9e', // 2: Soft Pink
    '#a18cd1', // 4: Deep Lavender
    '#fad0c4', // 8: Peach
    '#8fd3f4', // 16: Cyan
    '#84fab0', // 32: Mint
    '#fccb90', // 64: Orange
    '#d299c2', // 128: Orchid
    '#a6c0fe', // 256: Baby Blue
    '#f68084', // 512: Salmon
    '#667eea', // 1024: Royal Blue
    '#764ba2', // 2048: Deep Purple
    '#4facfe', // 4096: Bright Blue
    '#00f2fe', // 8192: Neon Cyan
    '#f093fb', // 16384: Neon Pink
    '#f5576c', // 32768: Red Pink
  ],

};
export const SKIN_ANIMATIONS: Record<string, string> = {};
export const SKIN_RENDER_MODES: Record<string, SkinRenderMode> = {
  skin_digital_win98: 'standard',
};
