export interface Tile {
  id: string;
  value: number;
}

// Tile that is being absorbed during merge (for animation purposes)
export interface MergingTile {
  id: string;
  value: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export type Grid = (Tile | null)[][];

export enum ShapeType {
  I = 'I',
  O = 'O',
  T = 'T',
  S = 'S',
  Z = 'Z',
  J = 'J',
  L = 'L',
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface Piece {
  id: string; // Unique ID for keying
  type: ShapeType;
  rotation: number; // 0, 1, 2, 3
  cells: Coordinate[]; // Relative coordinates
  value: number; // Default 1
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum Phase {
  PLACE = 'PLACE',
  SLIDE = 'SLIDE',
}

export type BoardSize = 4 | 5 | 7 | 8 | 10;

export interface GameSettings {
  boardSize: BoardSize;
}

// --- Block customization (tile skins) ---

export type TileSkinKind = 'default' | 'color' | 'image';

export type TileSkinOverride =
  | { kind: 'default' }
  | { kind: 'color'; color: string } // hex: #RRGGBB
  | { kind: 'image'; imageDataUrl: string }; // data URL (square, optimized)

export interface GlobalTilePaletteSettings {
  enabled: boolean;
  baseColor: string; // hex: #RRGGBB (hue source)
  saturation: number; // 0..100
  brightness: number; // 0..100 (HSL lightness baseline)
  depth: number; // 0..80 (how much darker high values get)
}

export interface BlockCustomizationSettingsV1 {
  version: 1;
  globalPalette: GlobalTilePaletteSettings;
  perValue: Record<string, TileSkinOverride>; // key = tile value as string (e.g. "1", "2", "4"...)
}

// --- Skin system ---

export type SkinCategory = 'basic' | 'material' | 'digital' | 'art' | 'food' | 'nature';

export interface SkinStyle {
  type: 'solid' | 'gradient' | 'image' | 'css-pattern';
  // Base background (hex, gradient string, or url)
  value: string;
  // Optional specific overrides
  textColor?: string;
  borderColor?: string;
  shadow?: string;
  // For complex CSS patterns
  customCss?: string; // Serialized CSS properties
}

// 스킨 카탈로그 항목 (뽑기 가능한 스킨 정의, constants.ts에서 배열로 관리)
export interface SkinCatalogEntry {
  id: string;   // "skin_0", "skin_1" ...
  hex: string;  // 큐레이션 색상 (UI 표시용, 대표 색상)
  category?: SkinCategory;
  nameKey?: string; // i18n key suffix
  style?: SkinStyle; // Advanced styling
  premium?: boolean; // 프리미엄 스킨 (뽑기 확률 절반, 교환 비용 증가)
}

// 사용자가 획득한 스킨
export interface SkinItem {
  id: string;          // SkinCatalogEntry.id와 동일
  hex: string;         // 획득 시점의 색상 (Legacy support)
  style?: SkinStyle;   // 획득 시점의 스타일 (For advanced skins)
  acquiredAt: number;  // Date.now() 타임스탬프
}

export interface SkinSettings {
  version: 2;
  ownedSkins: SkinItem[];
  activeSkinId: string | null;
  fragments: number; // 스킨 조각 (중복 뽑기 시 획득, 교환에 사용)
}

// 스킨 뽑기 결과
export type SkinDrawResult =
  | { type: 'new'; skin: SkinItem }
  | { type: 'duplicate'; skin: SkinCatalogEntry; fragmentsEarned: number };
