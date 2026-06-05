import { describe, expect, it, vi } from 'vitest';
import { rewardVideoAdCoordinator } from './rewardVideoAdCoordinator';

describe('rewardVideoAdCoordinator', () => {
  it('invalidates a previous rewarded video owner when another owner claims preload', () => {
    const invalidateUndo = vi.fn();
    const invalidateSkin = vi.fn();

    rewardVideoAdCoordinator.resetForTests();
    rewardVideoAdCoordinator.register('undo', invalidateUndo);
    rewardVideoAdCoordinator.register('skin-draw', invalidateSkin);

    rewardVideoAdCoordinator.claim('undo');
    rewardVideoAdCoordinator.claim('skin-draw');

    expect(invalidateUndo).toHaveBeenCalledTimes(1);
    expect(invalidateSkin).not.toHaveBeenCalled();
    expect(rewardVideoAdCoordinator.isCurrentOwner('skin-draw')).toBe(true);
  });

  it('ignores stale load completion after ownership changed', () => {
    rewardVideoAdCoordinator.resetForTests();

    rewardVideoAdCoordinator.claim('undo');
    rewardVideoAdCoordinator.claim('weekly-event-attempt');

    expect(rewardVideoAdCoordinator.isCurrentOwner('undo')).toBe(false);
    expect(rewardVideoAdCoordinator.isCurrentOwner('weekly-event-attempt')).toBe(true);
  });
});
