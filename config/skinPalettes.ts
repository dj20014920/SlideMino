
// Type definitions
export type HSLProgression = [number, number, number, number, number, number];
export type SkinRenderMode = 'standard' | 'neon' | 'glass' | 'flat' | 'matte';

// Base logic exports that might be needed by blockCustomization
export const getValueShadow = (level: number, mode: SkinRenderMode = 'standard'): string | undefined => undefined;
export const getAutoBorderColor = (h: number, s: number, l: number, mode: SkinRenderMode = 'standard'): string | undefined => undefined;

export const SKIN_PROGRESSIONS: Record<string, HSLProgression> = {
  // 대리석: 밝은 청회색(hue 200, 연한) → 짙은 슬레이트(hue 215, 어두운)
  skin_material_marble: [200, 8, 94, 215, 12, 18],
};
export const SKIN_EXPLICIT_PALETTES: Record<string, string[]> = {
  // 수채화: 파스텔 16색 팔레트 (분홍→보라→파랑→초록→노랑→주황 순환)
  skin_art_watercolor: [
    '#fce4ec', // 1: 연핑크
    '#f8bbd0', // 2: 핑크
    '#e1bee7', // 4: 라벤더
    '#d1c4e9', // 8: 연보라
    '#c5cae9', // 16: 연인디고
    '#b3e5fc', // 32: 하늘
    '#b2ebf2', // 64: 민트
    '#c8e6c9', // 128: 연초록
    '#f0f4c3', // 256: 라임
    '#fff9c4', // 512: 레몬
    '#ffe0b2', // 1024: 복숭아
    '#ffccbc', // 2048: 살구
    '#ffcdd2', // 4096: 연산호
    '#fce4ec', // 8192: 연핑크 (순환)
    '#e8eaf6', // 16384: 연보라-블루
    '#f3e5f5', // 32768: 연라벤더
  ],

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
  skin_cute_black_cat: 'matte',
  skin_cute_white_cat: 'matte',
  skin_cute_dog: 'matte',
};
