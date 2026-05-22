import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameState, Phase, ShapeType } from '../types';
import { loadGameState } from './gameStorage';

const installLocalStorageStub = () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  return store;
};

describe('game storage obstacle migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps legacy saves identifiable while normalizing missing obstacle state', () => {
    const store = installLocalStorageStub();
    store.set('slidemino_game_state_v1', JSON.stringify({
      version: 1,
      gameState: GameState.PLAYING,
      grid: [
        [{ id: 'tile-128', value: 128 }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      slots: [{
        id: 'piece-1',
        type: ShapeType.O,
        rotation: 0,
        initialRotation: 0,
        cells: [{ x: 0, y: 0 }],
        value: 1,
      }],
      score: 700,
      phase: Phase.PLACE,
      boardSize: 4,
      canSkipSlide: false,
      undoRemaining: 3,
      savedAt: Date.now(),
    }));

    const saved = loadGameState();

    expect(saved?.obstacleRulesVersion).toBeUndefined();
    expect(saved?.obstacleState?.spawnMissStreak).toBe(0);
    expect(saved?.unlockedObstacleFeatures).toEqual([]);
  });

  it('normalizes partial obstacle state in persisted saves', () => {
    const store = installLocalStorageStub();
    store.set('slidemino_game_state_v1', JSON.stringify({
      version: 1,
      gameState: GameState.PLAYING,
      grid: [
        [{ id: 'tile-128', value: 128 }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
      slots: [{
        id: 'piece-1',
        type: ShapeType.O,
        rotation: 0,
        initialRotation: 0,
        cells: [{ x: 0, y: 0 }],
        value: 1,
      }],
      score: 700,
      phase: Phase.PLACE,
      boardSize: 4,
      canSkipSlide: false,
      undoRemaining: 3,
      savedAt: Date.now(),
      obstacleState: { rulesVersion: 'obstacles_v1' },
    }));

    const saved = loadGameState();

    expect(saved?.obstacleState?.cellObstacles).toEqual([]);
    expect(saved?.obstacleState?.frozenTiles).toEqual([]);
    expect(saved?.obstacleState?.portal).toBeNull();
  });
});

describe('shuffle bag remaining field parsing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const minimalSave = {
    version: 1 as const,
    gameState: GameState.PLAYING,
    grid: [
      [{ id: 'tile-1', value: 2 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    slots: [{
      id: 'piece-1',
      type: ShapeType.I,
      rotation: 0,
      initialRotation: 0,
      cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
      value: 1,
    }],
    score: 0,
    phase: Phase.PLACE,
    boardSize: 4,
    canSkipSlide: false,
    undoRemaining: 3,
    savedAt: Date.now(),
  };

  it('preserves valid ShapeType array in shuffleBagRemaining', () => {
    const store = installLocalStorageStub();
    store.set('slidemino_game_state_v1', JSON.stringify({
      ...minimalSave,
      shuffleBagRemaining: [ShapeType.I, ShapeType.O, ShapeType.T],
    }));

    const saved = loadGameState();
    expect(saved).toBeDefined();
    const { shuffleBagRemaining } = saved!;
    expect(shuffleBagRemaining).toEqual([ShapeType.I, ShapeType.O, ShapeType.T]);
  });

  it('filters out invalid values from shuffleBagRemaining', () => {
    const store = installLocalStorageStub();
    store.set('slidemino_game_state_v1', JSON.stringify({
      ...minimalSave,
      shuffleBagRemaining: [ShapeType.I, 'INVALID', ShapeType.O, 123, null],
    }));

    const saved = loadGameState();
    expect(saved).toBeDefined();
    const { shuffleBagRemaining } = saved!;
    expect(shuffleBagRemaining).toEqual([ShapeType.I, ShapeType.O]);
  });

  it('returns undefined for old save data without shuffleBagRemaining', () => {
    const store = installLocalStorageStub();
    store.set('slidemino_game_state_v1', JSON.stringify(minimalSave));

    const saved = loadGameState();
    expect(saved).toBeDefined();
    const { shuffleBagRemaining } = saved!;
    expect(shuffleBagRemaining).toBeUndefined();
  });
});
