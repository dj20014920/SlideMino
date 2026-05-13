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
});
