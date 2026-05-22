import { describe, expect, it } from 'vitest';
import { ShapeType } from '../types';
import {
  createShuffleBagPieceGenerator,
  generateRandomPiece,
  getShuffleBagRemaining,
  setShuffleBagRemaining,
} from './gameLogic';

describe('shuffle bag remaining state', () => {
  it('returns remaining shapes from a bag generator', () => {
    const generator = createShuffleBagPieceGenerator([ShapeType.I, ShapeType.O, ShapeType.T]);
    const remaining = getShuffleBagRemaining(generator);
    expect(remaining).not.toBeNull();
    expect(remaining!.length).toBe(3);
    expect([...remaining!].sort()).toEqual([ShapeType.I, ShapeType.O, ShapeType.T]);
  });

  it('decreases remaining length after each draw', () => {
    const generator = createShuffleBagPieceGenerator([ShapeType.I, ShapeType.O, ShapeType.T]);
    const before = getShuffleBagRemaining(generator)!;
    expect(before.length).toBe(3);

    generator(); // draw one piece from the bag
    const after = getShuffleBagRemaining(generator)!;
    expect(after.length).toBe(2);
  });

  it('restores saved remaining state to a new generator', () => {
    const generator = createShuffleBagPieceGenerator([ShapeType.I, ShapeType.O, ShapeType.T]);
    generator(); // draw one piece
    const saved = getShuffleBagRemaining(generator)!;

    const newGenerator = createShuffleBagPieceGenerator([ShapeType.I, ShapeType.O, ShapeType.T]);
    setShuffleBagRemaining(newGenerator, saved);

    const restored = getShuffleBagRemaining(newGenerator)!;
    expect(restored).toEqual(saved);
  });

  it('filters out shapes not in allowedShapes when restoring via setShuffleBagRemaining', () => {
    const generator = createShuffleBagPieceGenerator([ShapeType.I, ShapeType.O]);
    setShuffleBagRemaining(generator, [ShapeType.PLUS, ShapeType.I]);
    const remaining = getShuffleBagRemaining(generator)!;
    expect(remaining).toEqual([ShapeType.I]);
  });

  it('returns null for non-bag generators and set is no-op', () => {
    const plainGenerator = () => generateRandomPiece();
    expect(getShuffleBagRemaining(plainGenerator)).toBeNull();

    expect(() => setShuffleBagRemaining(plainGenerator, [ShapeType.I])).not.toThrow();
    expect(getShuffleBagRemaining(plainGenerator)).toBeNull();
  });
});