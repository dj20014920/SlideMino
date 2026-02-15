interface RetryBackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class RetryBackoffScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterRatio: number;

  constructor(options: RetryBackoffOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 3000;
    this.maxDelayMs = options.maxDelayMs ?? 60000;
    this.jitterRatio = clamp(options.jitterRatio ?? 0.2, 0, 0.5);
  }

  public schedule(task: () => void): void {
    if (this.timer) return;

    const exponent = Math.min(this.attempt, 8);
    const rawDelay = Math.min(this.baseDelayMs * (2 ** exponent), this.maxDelayMs);
    const jitter = rawDelay * this.jitterRatio * Math.random();
    const delay = Math.round(rawDelay - (rawDelay * this.jitterRatio * 0.5) + jitter);

    this.timer = setTimeout(() => {
      this.timer = null;
      task();
    }, delay);

    this.attempt += 1;
  }

  public reset(): void {
    this.attempt = 0;
    this.clearPending();
  }

  public clearPending(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

export class CooldownGate {
  private lastActionAt = 0;

  constructor(private readonly cooldownMs: number) {}

  public canProceed(now = Date.now()): boolean {
    return now - this.lastActionAt >= this.cooldownMs;
  }

  public mark(now = Date.now()): void {
    this.lastActionAt = now;
  }
}
