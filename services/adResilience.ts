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

// ==========================================
// 📌 시간당 빈도 제한 (HourlyFrequencyCap)
// ==========================================

/**
 * 슬라이딩 윈도우 기반 시간당 광고 노출 제한.
 * maxPerHour를 초과하면 canProceed()가 false를 반환한다.
 */
export class HourlyFrequencyCap {
  private timestamps: number[] = [];

  constructor(private readonly maxPerHour: number) {}

  /** 현재 시간 기준으로 1시간 이내 노출이 한도 미만인지 확인 */
  public canProceed(now = Date.now()): boolean {
    this.prune(now);
    return this.timestamps.length < this.maxPerHour;
  }

  /** 광고 노출 시점을 기록 */
  public record(now = Date.now()): void {
    this.timestamps.push(now);
  }

  /** 남은 시간당 노출 가능 횟수 */
  public getRemaining(now = Date.now()): number {
    this.prune(now);
    return Math.max(0, this.maxPerHour - this.timestamps.length);
  }

  /** 1시간 초과 기록 제거 */
  private prune(now: number): void {
    const cutoff = now - 3_600_000;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }
}

// ==========================================
// 📌 클릭 어뷰징 감지/차단 (ClickAbuseGuard)
// ==========================================

/**
 * 짧은 시간 내 비정상적 광고 요청 패턴을 감지하여 차단.
 * - windowMs(기본 90초) 내에 maxActions(기본 6회) 초과 시 차단
 * - 차단 시 penaltyMs(기본 2분) 동안 모든 요청 거부
 *
 * 설계 근거: 보상형 광고 1회 시청에 최소 15~30초 소요.
 * 90초 내 6회 보상은 정상 사용으로는 물리적으로 불가능하므로
 * 자동화 스크립트/봇만 탐지한다. 패널티도 2분으로 짧아
 * 만약의 오탐 시에도 사용자 불편 최소화.
 */
export class ClickAbuseGuard {
  private timestamps: number[] = [];
  private penaltyUntil = 0;

  constructor(
    private readonly maxActions = 6,
    private readonly windowMs = 90_000,
    private readonly penaltyMs = 120_000,
  ) {}

  /**
   * 요청 가능 여부 확인.
   * false이면 어뷰징 의심으로 차단 중.
   */
  public canProceed(now = Date.now()): boolean {
    if (now < this.penaltyUntil) return false;
    this.prune(now);
    return this.timestamps.length < this.maxActions;
  }

  /** 광고 요청/노출 시점을 기록. 한도 초과 시 패널티 자동 적용. */
  public record(now = Date.now()): void {
    this.timestamps.push(now);
    this.prune(now);

    if (this.timestamps.length >= this.maxActions) {
      this.penaltyUntil = now + this.penaltyMs;
      console.warn(
        `[ClickAbuseGuard] 비정상 빈도 감지 → ${this.penaltyMs / 1000}초 차단 적용`,
      );
    }
  }

  /** 현재 패널티(차단) 중인지 확인 */
  public isPenalized(now = Date.now()): boolean {
    return now < this.penaltyUntil;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }
}
