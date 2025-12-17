export type Grid = number[][];

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

export type BoardSize = 7 | 8 | 10;

export interface GameSettings {
  boardSize: BoardSize;
}
