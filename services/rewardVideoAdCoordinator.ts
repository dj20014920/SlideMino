export type RewardVideoAdOwner = 'undo' | 'skin-draw' | 'weekly-event-attempt';

type InvalidateHandler = () => void;

class RewardVideoAdCoordinator {
  private currentOwner: RewardVideoAdOwner | null = null;
  private readonly invalidateHandlers = new Map<RewardVideoAdOwner, Set<InvalidateHandler>>();

  public register(owner: RewardVideoAdOwner, invalidate: InvalidateHandler): () => void {
    const handlers = this.invalidateHandlers.get(owner) ?? new Set<InvalidateHandler>();
    handlers.add(invalidate);
    this.invalidateHandlers.set(owner, handlers);

    return () => {
      handlers.delete(invalidate);
      if (handlers.size === 0) {
        this.invalidateHandlers.delete(owner);
      }
    };
  }

  public claim(owner: RewardVideoAdOwner): void {
    if (this.currentOwner !== null && this.currentOwner !== owner) {
      this.invalidateOwner(this.currentOwner);
    }
    this.currentOwner = owner;
  }

  public clear(owner: RewardVideoAdOwner): void {
    if (this.currentOwner === owner) {
      this.currentOwner = null;
    }
  }

  public isCurrentOwner(owner: RewardVideoAdOwner): boolean {
    return this.currentOwner === owner;
  }

  public resetForTests(): void {
    this.currentOwner = null;
    this.invalidateHandlers.clear();
  }

  private invalidateOwner(owner: RewardVideoAdOwner): void {
    const handlers = this.invalidateHandlers.get(owner);
    if (!handlers) return;
    for (const invalidate of handlers) {
      invalidate();
    }
  }
}

export const rewardVideoAdCoordinator = new RewardVideoAdCoordinator();
