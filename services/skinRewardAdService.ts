/**
 * 스킨 뽑기 전용 보상형 광고 서비스
 * - AdMob iOS/Android 전용 (apps-in-toss 미지원)
 * - 일일 3회 제한
 * - prepareRewardVideoAd / showRewardVideoAd 사용 (표준 reward ad)
 */

import {
  AdMob,
  RewardAdOptions,
  RewardAdPluginEvents,
  AdMobRewardItem,
  AdLoadInfo,
  type AdMobError,
} from '@capacitor-community/admob';
import { getSkinRewardAdId, isSkinRewardAdSupported, CURRENT_AD_PLATFORM } from './adConfig';
import { ensureAdMobReady } from './admob';
import { CooldownGate, RetryBackoffScheduler, HourlyFrequencyCap, ClickAbuseGuard } from './adResilience';
import { MAX_DAILY_SKIN_AD_VIEWS } from '../constants';
import { getServerAdjustedNow } from './serverTimeService';

export interface SkinRewardAdCallbacks {
  onRewardEarned: () => void;
  onAdClosed: () => void;
  onError: (error: Error) => void;
  onDailyLimitReached?: () => void;
}

type AdLoadStatus = 'not_loaded' | 'loading' | 'loaded' | 'failed';

// 일일 광고 횟수 관리
interface DailyAdData {
  date: string;
  count: number;
}

class SkinDailyAdLimiter {
  private readonly STORAGE_KEY = 'slidemino_daily_skin_ad_data';

  private getTodayString(): string {
    // KST 기준 날짜 (게임의 날짜 경계는 KST 자정) — 서버 보정 시각 사용
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
      // 저장 실패 무시
    }
  }

  public canWatchAd(): boolean {
    return this.getData().count < MAX_DAILY_SKIN_AD_VIEWS;
  }

  public getRemainingCount(): number {
    return Math.max(0, MAX_DAILY_SKIN_AD_VIEWS - this.getData().count);
  }

  public recordWatch(): boolean {
    const data = this.getData();
    if (data.count >= MAX_DAILY_SKIN_AD_VIEWS) return false;
    data.count += 1;
    this.saveData(data);
    return true;
  }
}

class SkinRewardAdService {
  private adUnitId: string;
  private loadStatus: AdLoadStatus = 'not_loaded';
  private lastLoadError: AdMobError | null = null;
  private isProcessingShow = false;
  private rewardIssuedForCurrentShow = false;
  private adClosedForCurrentShow = false;
  private adClosedNotifiedForCurrentShow = false;
  private admobCallbacks: SkinRewardAdCallbacks | null = null;
  private finalizeAfterDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private dailyLimiter = new SkinDailyAdLimiter();
  private readonly loadRetryBackoff = new RetryBackoffScheduler();
  private readonly showCooldown = new CooldownGate(7000);
  // 일부 네트워크(특히 멀티 스텝 1/2·2/2 광고)는 dismiss 이후 reward 콜백이 지연될 수 있다.
  private readonly lateRewardGraceMs = 5000;
  private readonly rewardNotEarnedMessage = '광고를 끝까지 시청해야 보상이 지급됩니다.';
  // 시간당 최대 8회 노출 제한 (일일 3회 한도의 안전 마진)
  private readonly hourlyFrequencyCap = new HourlyFrequencyCap(8);
  // 90초 내 5회 초과 시 2분 차단 (정상 사용은 도달 불가, 자동 스크립트만 감지)
  private readonly abuseGuard = new ClickAbuseGuard(5, 90_000, 120_000);
  private showAttemptSequence = 0;
  private activeShowAttemptId: number | null = null;

  constructor() {
    this.adUnitId = getSkinRewardAdId();

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.setupListeners();
    }
  }

  private setupListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      // 동일 이벤트 채널을 공유하는 다른 리워드 광고 요청의 이벤트를 무시한다.
      if (info.adUnitId !== this.adUnitId) return;
      if (this.loadStatus !== 'loading') return;
      this.loadStatus = 'loaded';
      this.lastLoadError = null;
      this.loadRetryBackoff.reset();
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error: AdMobError) => {
      if (this.loadStatus !== 'loading') return;
      this.loadStatus = 'failed';
      this.lastLoadError = error;
      console.warn('[SkinRewardAdService] AdMob 광고 로드 실패:', error.code, error.message);
      this.loadRetryBackoff.schedule(() => {
        if (this.loadStatus === 'failed') this.preloadAd();
      });
    });

    AdMob.addListener(RewardAdPluginEvents.Showed, () => {
      // 광고 표시됨
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      if (!this.isHandlingActiveShow()) return;
      this.loadStatus = 'failed';
      console.warn('[SkinRewardAdService] 광고 표시 실패 이벤트 수신', {
        attemptId: this.activeShowAttemptId,
        loadStatus: this.loadStatus,
      });
      this.schedulePreloadSync('failed-to-show-event', 150);
      const callbacks = this.admobCallbacks;
      this.finalizeActiveShowSession();
      callbacks?.onError(new Error('스킨 광고 표시 실패'));
    });

    AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
      this.handleRewardEarned(reward);
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      if (!this.isHandlingActiveShow()) return;
      // 보상형 광고는 1회성 오브젝트라서 닫힌 시점에 즉시 무효화해야 다음 preload가 정상 동작한다.
      this.loadStatus = 'not_loaded';
      this.isProcessingShow = false;

      this.adClosedForCurrentShow = true;
      this.notifyAdClosedOnce();

      if (this.rewardIssuedForCurrentShow) {
        this.finalizeActiveShowSession();
      } else {
        this.scheduleFinalizeAfterDismiss();
      }

      this.schedulePreloadSync('dismissed', 100);
    });
  }

  public preloadAd(): void {
    if (!isSkinRewardAdSupported()) return;
    if (this.loadStatus === 'loading' || this.loadStatus === 'loaded') return;
    if (CURRENT_AD_PLATFORM !== 'admob-ios' && CURRENT_AD_PLATFORM !== 'admob-android') return;

    void this.loadAdMobAd();
  }

  private async loadAdMobAd(): Promise<void> {
    this.loadStatus = 'loading';
    this.lastLoadError = null;

    const canRequest = await ensureAdMobReady();
    if (!canRequest) { this.loadStatus = 'failed'; return; }

    const options: RewardAdOptions = { adId: this.adUnitId };

    try {
      const info = await AdMob.prepareRewardVideoAd(options);
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
      const normalizedError = this.normalizeAdMobError(error);
      this.loadStatus = 'failed';
      this.lastLoadError = normalizedError;
      console.warn('[SkinRewardAdService] AdMob 광고 로드 실패(예외):', normalizedError.code, normalizedError.message);
      this.loadRetryBackoff.schedule(() => {
        if (this.loadStatus === 'failed') this.preloadAd();
      });
    }
  }

  public showRewardAd(callbacks: SkinRewardAdCallbacks): void {
    if (!isSkinRewardAdSupported()) {
      callbacks.onError(new Error('스킨 광고가 지원되지 않는 환경입니다.'));
      return;
    }

    if (this.isHandlingActiveShow()) {
      console.warn('[SkinRewardAdService] showRewardAd 중복 요청 차단', {
        attemptId: this.activeShowAttemptId,
        isProcessingShow: this.isProcessingShow,
        hasCallbacks: this.admobCallbacks !== null,
        loadStatus: this.loadStatus,
      });
      return;
    }

    // 클릭 어뷰징 감지 (60초 내 과도한 요청 → 5분 차단)
    if (!this.abuseGuard.canProceed()) {
      callbacks.onError(new Error('광고 요청이 비정상적으로 많습니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    // 시간당 빈도 제한 체크
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

    if (this.loadStatus !== 'loaded') {
      if (this.loadStatus === 'not_loaded' || this.loadStatus === 'failed') this.preloadAd();
      if (this.loadStatus === 'failed') {
        console.warn('[SkinRewardAdService] showRewardAd 준비 실패 상태', {
          lastLoadErrorCode: this.lastLoadError?.code ?? null,
          lastLoadErrorMessage: this.lastLoadError?.message ?? null,
        });
      }
      if (this.loadStatus === 'failed' && this.lastLoadError?.code === 3) {
        callbacks.onError(new Error('현재 광고 재고가 부족합니다. 잠시 후 다시 시도해주세요.'));
        return;
      }
      callbacks.onError(new Error('광고를 준비 중입니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    this.showAttemptSequence += 1;
    this.activeShowAttemptId = this.showAttemptSequence;
    this.showCooldown.mark();
    this.clearFinalizeAfterDismissTimer();
    this.isProcessingShow = true;
    this.rewardIssuedForCurrentShow = false;
    this.adClosedForCurrentShow = false;
    this.adClosedNotifiedForCurrentShow = false;
    this.admobCallbacks = callbacks;

    void this.showAdMobAd(callbacks);
  }

  private async showAdMobAd(callbacks: SkinRewardAdCallbacks): Promise<void> {
    try {
      const reward = await AdMob.showRewardVideoAd();
      this.loadStatus = 'not_loaded';
      this.handleRewardEarned(reward);
    } catch (error) {
      const normalizedError = this.normalizeAdMobError(error);
      this.loadStatus = 'failed';
      console.warn('[SkinRewardAdService] 광고 표시 예외', {
        attemptId: this.activeShowAttemptId,
        code: normalizedError.code,
        message: normalizedError.message,
      });
      this.schedulePreloadSync('failed-to-show-exception', 150);
      this.finalizeActiveShowSession();
      callbacks.onError(new Error(normalizedError.message));
    }
  }

  public isAdReady(): boolean {
    return this.loadStatus === 'loaded';
  }

  public getRemainingDailyViews(): number {
    return this.dailyLimiter.getRemainingCount();
  }

  private isHandlingActiveShow(): boolean {
    return this.isProcessingShow || this.admobCallbacks !== null;
  }

  private handleRewardEarned(_reward: AdMobRewardItem): void {
    if (!this.admobCallbacks || this.rewardIssuedForCurrentShow) return;

    if (!this.dailyLimiter.recordWatch()) {
      this.admobCallbacks.onDailyLimitReached?.();
      this.finalizeActiveShowSession();
      return;
    }

    this.hourlyFrequencyCap.record();
    this.abuseGuard.record();
    this.rewardIssuedForCurrentShow = true;
    this.admobCallbacks.onRewardEarned();

    if (this.adClosedForCurrentShow) {
      this.finalizeActiveShowSession();
    }
  }

  private notifyAdClosedOnce(): void {
    if (!this.admobCallbacks || this.adClosedNotifiedForCurrentShow) return;
    this.adClosedNotifiedForCurrentShow = true;
    this.admobCallbacks.onAdClosed();
  }

  private scheduleFinalizeAfterDismiss(): void {
    this.clearFinalizeAfterDismissTimer();
    this.finalizeAfterDismissTimer = setTimeout(() => {
      this.finalizeAfterDismissTimer = null;
      if (!this.rewardIssuedForCurrentShow && this.admobCallbacks) {
        console.warn('[SkinRewardAdService] 보상 미수령으로 세션 종료', {
          attemptId: this.activeShowAttemptId,
          reason: 'dismiss-timeout',
        });
        this.admobCallbacks.onError(new Error(this.rewardNotEarnedMessage));
      }
      this.schedulePreloadSync('dismiss-timeout', 100);
      this.finalizeActiveShowSession();
    }, this.lateRewardGraceMs);
  }

  private clearFinalizeAfterDismissTimer(): void {
    if (!this.finalizeAfterDismissTimer) return;
    clearTimeout(this.finalizeAfterDismissTimer);
    this.finalizeAfterDismissTimer = null;
  }

  private finalizeActiveShowSession(): void {
    this.clearFinalizeAfterDismissTimer();
    this.isProcessingShow = false;
    this.rewardIssuedForCurrentShow = false;
    this.adClosedForCurrentShow = false;
    this.adClosedNotifiedForCurrentShow = false;
    this.admobCallbacks = null;
    this.activeShowAttemptId = null;
  }

  private schedulePreloadSync(reason: string, delayMs = 0): void {
    if (import.meta.env.DEV) {
      console.debug('[SkinRewardAdService] preload 재동기화 예약', {
        reason,
        delayMs,
        loadStatus: this.loadStatus,
      });
    }
    if (delayMs <= 0) {
      this.preloadAd();
      return;
    }
    window.setTimeout(() => {
      this.preloadAd();
    }, delayMs);
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

export const skinRewardAdService = new SkinRewardAdService();
