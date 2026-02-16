
// Type definitions
export type HSLProgression = [number, number, number, number, number, number];
export type SkinRenderMode = 'standard' | 'neon' | 'glass' | 'flat' | 'matte';

// Base logic exports that might be needed by blockCustomization
export const getValueShadow = (level: number, mode: SkinRenderMode = 'standard'): string | undefined => undefined;
export const getAutoBorderColor = (h: number, s: number, l: number, mode: SkinRenderMode = 'standard'): string | undefined => undefined;

export const SKIN_PROGRESSIONS: Record<string, HSLProgression> = {};
export const SKIN_EXPLICIT_PALETTES: Record<string, string[]> = {};
export const SKIN_ANIMATIONS: Record<string, string> = {};
export const SKIN_RENDER_MODES: Record<string, SkinRenderMode> = {};

