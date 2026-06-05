/**
 * 주간 이벤트 추가 도전 해금용 보상형 광고 서비스
 * - AdMob iOS/Android 전용
 * - eventId당 해금은 서비스 외부 로직(weeklyEventService)에서 1회로 제한
 */

import {
  AdMob,
  RewardAdOptions,
  RewardAdPluginEvents,
  AdMobRewardItem,
  AdLoadInfo,
  type AdMobError,
} from '@capacitor-community/admob';
import {
  getWeeklyEventAttemptRewardAdId,
  isWeeklyEventAttemptRewardAdSupported,
  CURRENT_AD_PLATFORM,
} from './adConfig';
import { ensureAdMobReady } from './admob';
import { CooldownGate, RetryBackoffScheduler, HourlyFrequencyCap, ClickAbuseGuard } from './adResilience';
import { rewardVideoAdCoordinator, type RewardVideoAdOwner } from './rewardVideoAdCoordinator';
import { MAX_DAILY_WEEKLY_EVENT_ATTEMPT_AD_VIEWS } from '../constants';
import { getServerAdjustedNow } from './serverTimeService';

export interface WeeklyEventAttemptAdCallbacks {
  onRewardEarned: () => void;
  onAdClosed: () => void;
  onError: (error: Error) => void;
  onDailyLimitReached?: () => void;
}

type AdLoadStatus = 'not_loaded' | 'loading' | 'loaded' | 'failed';

interface DailyAdData {
  date: string;
  count: number;
}

class WeeklyEventAttemptDailyAdLimiter {
  private readonly STORAGE_KEY = 'slidemino_daily_weekly_event_attempt_ad_data';

  private getTodayString(): string {
    // 서버 보정 시각 사용
    const kstMs = getServerAdjustedNow().getTime() + 9 * 60 * 60 * 1000;
    const kst = new Date(kstMs);
    return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
  }

  private getData(): DailyAdData {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return { date: this.getTodayString(), count: 0 };
      const data: DailyAdData = JSON.parse(stored);
      if (data.date !== this.getTodayString()) return { date: this.getTodayString(), count: 0 };
      return data;
    } catch {
      return { date: this.getTodayString(), count: 0 };
    }
  }

  private saveData(data: DailyAdData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 저장 실패는 치명적이지 않음
    }
  }

  public canWatchAd(): boolean {
    return this.getData().count < MAX_DAILY_WEEKLY_EVENT_ATTEMPT_AD_VIEWS;
  }

  public getRemainingCount(): number {
    return Math.max(0, MAX_DAILY_WEEKLY_EVENT_ATTEMPT_AD_VIEWS - this.getData().count);
  }

  public recordWatch(): boolean {
    const data = this.getData();
    if (data.count >= MAX_DAILY_WEEKLY_EVENT_ATTEMPT_AD_VIEWS) return false;
    data.count += 1;
    this.saveData(data);
    return true;
  }
}

class WeeklyEventAttemptAdService {
  private readonly coordinatorOwner: RewardVideoAdOwner = 'weekly-event-attempt';
  private adUnitId: string;
  private loadStatus: AdLoadStatus = 'not_loaded';
  private lastLoadError: AdMobError | null = null;
  private isProcessingShow = false;
  private rewardIssuedForCurrentShow = false;
  private admobCallbacks: WeeklyEventAttemptAdCallbacks | null = null;
  private dailyLimiter = new WeeklyEventAttemptDailyAdLimiter();
  private readonly loadRetryBackoff = new RetryBackoffScheduler();
  private readonly showCooldown = new CooldownGate(7000);
  private readonly hourlyFrequencyCap = new HourlyFrequencyCap(8);
  private readonly abuseGuard = new ClickAbuseGuard(5, 90_000, 120_000);

  constructor() {
    this.adUnitId = getWeeklyEventAttemptRewardAdId();
    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.setupListeners();
    }

    rewardVideoAdCoordinator.register(this.coordinatorOwner, () => this.invalidatePreparedAdState());
  }

  private setupListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      if (info.adUnitId !== this.adUnitId) return;
      if (this.loadStatus !== 'loading') return;
      if (!rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) return;
      this.loadStatus = 'loaded';
      this.lastLoadError = null;
      this.loadRetryBackoff.reset();
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error: AdMobError) => {
      if (this.loadStatus !== 'loading') return;
      if (!rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) return;
      this.loadStatus = 'failed';
      this.lastLoadError = error;
      this.loadRetryBackoff.schedule(() => {
        if (this.loadStatus === 'failed') this.preloadAd();
      });
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      if (!this.isHandlingActiveShow()) return;
      this.loadStatus = 'failed';
      rewardVideoAdCoordinator.clear(this.coordinatorOwner);
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;
      if (this.admobCallbacks) {
        this.admobCallbacks.onError(new Error('주간 이벤트 광고 표시 실패'));
        this.admobCallbacks = null;
      }
    });

    AdMob.addListener(RewardAdPluginEvents.Rewarded, (_reward: AdMobRewardItem) => {
      if (this.admobCallbacks && !this.rewardIssuedForCurrentShow) {
        if (this.dailyLimiter.recordWatch()) {
          this.hourlyFrequencyCap.record();
          this.abuseGuard.record();
          this.rewardIssuedForCurrentShow = true;
          this.admobCallbacks.onRewardEarned();
        } else {
          this.admobCallbacks.onDailyLimitReached?.();
        }
      }
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      if (!this.isHandlingActiveShow()) return;
      this.loadStatus = 'not_loaded';
      rewardVideoAdCoordinator.clear(this.coordinatorOwner);
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;
      if (this.admobCallbacks) {
        this.admobCallbacks.onAdClosed();
        this.admobCallbacks = null;
      }
      setTimeout(() => this.preloadAd(), 100);
    });
  }

  public preloadAd(): void {
    if (!this.isSupported()) return;
    if (this.loadStatus === 'loaded' && !rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) {
      this.loadStatus = 'not_loaded';
    }
    if (this.loadStatus === 'loading' || this.loadStatus === 'loaded') return;
    if (CURRENT_AD_PLATFORM !== 'admob-ios' && CURRENT_AD_PLATFORM !== 'admob-android') return;
    rewardVideoAdCoordinator.claim(this.coordinatorOwner);
    void this.loadAdMobAd();
  }

  private async loadAdMobAd(): Promise<void> {
    this.loadStatus = 'loading';
    this.lastLoadError = null;

    const canRequest = await ensureAdMobReady();
    if (!rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) return;
    if (!canRequest) {
      this.loadStatus = 'failed';
      return;
    }

    const options: RewardAdOptions = { adId: this.adUnitId };

    try {
      const info = await AdMob.prepareRewardVideoAd(options);
      if (!rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) return;
      if (info.adUnitId !== this.adUnitId) {
        this.loadStatus = 'failed';
        this.lastLoadError = {
          code: -1,
          message: `Unexpected adUnitId loaded: ${info.adUnitId}`,
        };
        this.loadRetryBackoff.schedule(() => {
          if (this.loadStatus === 'failed') this.preloadAd();
        });
        return;
      }
      this.loadStatus = 'loaded';
      this.lastLoadError = null;
      this.loadRetryBackoff.reset();
    } catch (error) {
      if (!rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) return;
      const normalizedError = this.normalizeAdMobError(error);
      this.loadStatus = 'failed';
      this.lastLoadError = normalizedError;
      this.loadRetryBackoff.schedule(() => {
        if (this.loadStatus === 'failed') this.preloadAd();
      });
    }
  }

  public showRewardAd(callbacks: WeeklyEventAttemptAdCallbacks): void {
    if (!this.isSupported()) {
      callbacks.onError(new Error('주간 이벤트 광고가 지원되지 않는 환경입니다.'));
      return;
    }

    if (CURRENT_AD_PLATFORM !== 'admob-ios' && CURRENT_AD_PLATFORM !== 'admob-android') {
      callbacks.onError(new Error('주간 이벤트 광고는 현재 플랫폼에서 지원되지 않습니다.'));
      return;
    }

    if (this.isProcessingShow) return;

    if (!this.abuseGuard.canProceed()) {
      callbacks.onError(new Error('광고 요청이 비정상적으로 많습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    if (!this.hourlyFrequencyCap.canProceed()) {
      callbacks.onError(new Error('시간당 광고 시청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    if (!this.dailyLimiter.canWatchAd()) {
      callbacks.onDailyLimitReached?.();
      return;
    }

    if (!this.showCooldown.canProceed()) {
      callbacks.onError(new Error('광고 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    if (this.loadStatus === 'loaded' && !rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) {
      this.loadStatus = 'not_loaded';
    }

    if (this.loadStatus !== 'loaded') {
      if (this.loadStatus === 'not_loaded' || this.loadStatus === 'failed') this.preloadAd();
      if (this.loadStatus === 'failed' && this.lastLoadError?.code === 3) {
        callbacks.onError(new Error('현재 광고 재고가 부족합니다. 잠시 후 다시 시도해주세요.'));
        return;
      }
      callbacks.onError(new Error('광고를 준비 중입니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    this.showCooldown.mark();
    this.isProcessingShow = true;
    this.rewardIssuedForCurrentShow = false;
    this.admobCallbacks = callbacks;
    void this.showAdMobAd(callbacks);
  }

  private async showAdMobAd(callbacks: WeeklyEventAttemptAdCallbacks): Promise<void> {
    try {
      await AdMob.showRewardVideoAd();
      this.loadStatus = 'not_loaded';
      rewardVideoAdCoordinator.clear(this.coordinatorOwner);
    } catch (error) {
      this.loadStatus = 'failed';
      rewardVideoAdCoordinator.clear(this.coordinatorOwner);
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;
      this.admobCallbacks = null;
      callbacks.onError(error as Error);
    }
  }

  public isSupported(): boolean {
    return isWeeklyEventAttemptRewardAdSupported();
  }

  public isAdReady(): boolean {
    return this.loadStatus === 'loaded' && rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner);
  }

  public getLoadStatus(): AdLoadStatus {
    if (this.loadStatus === 'loaded' && !rewardVideoAdCoordinator.isCurrentOwner(this.coordinatorOwner)) {
      return 'not_loaded';
    }
    return this.loadStatus;
  }

  public getRemainingDailyViews(): number {
    return this.dailyLimiter.getRemainingCount();
  }

  public cleanup(): void {
    this.loadRetryBackoff.reset();
    this.loadStatus = 'not_loaded';
    this.lastLoadError = null;
    this.isProcessingShow = false;
    this.rewardIssuedForCurrentShow = false;
    this.admobCallbacks = null;
    rewardVideoAdCoordinator.clear(this.coordinatorOwner);
  }

  private isHandlingActiveShow(): boolean {
    return this.isProcessingShow || this.admobCallbacks !== null;
  }

  private invalidatePreparedAdState(): void {
    if (this.isHandlingActiveShow()) return;
    this.loadRetryBackoff.clearPending();
    this.loadStatus = 'not_loaded';
    this.lastLoadError = null;
    this.isProcessingShow = false;
    this.rewardIssuedForCurrentShow = false;
    this.admobCallbacks = null;
  }

  private normalizeAdMobError(error: unknown): AdMobError {
    if (typeof error === 'object' && error !== null) {
      const maybe = error as Partial<AdMobError>;
      if (typeof maybe.code === 'number' && typeof maybe.message === 'string') {
        return { code: maybe.code, message: maybe.message };
      }
    }
    if (error instanceof Error) {
      return { code: -1, message: error.message };
    }
    return { code: -1, message: 'Unknown AdMob error' };
  }
}

export const weeklyEventAttemptAdService = new WeeklyEventAttemptAdService();
