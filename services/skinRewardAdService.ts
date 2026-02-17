/**
 * 스킨 뽑기 전용 보상형 광고 서비스
 * - AdMob iOS/Android 전용 (apps-in-toss 미지원)
 * - 일일 3회 제한
 * - prepareRewardVideoAd / showRewardVideoAd 사용 (표준 reward ad)
 */

import { AdMob, RewardAdOptions, RewardAdPluginEvents, AdMobRewardItem, AdLoadInfo } from '@capacitor-community/admob';
import { getSkinRewardAdId, isSkinRewardAdSupported, CURRENT_AD_PLATFORM } from './adConfig';
import { ensureAdMobReady } from './admob';
import { CooldownGate, RetryBackoffScheduler, HourlyFrequencyCap, ClickAbuseGuard } from './adResilience';
import { MAX_DAILY_SKIN_AD_VIEWS } from '../constants';

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
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
  private isProcessingShow = false;
  private rewardIssuedForCurrentShow = false;
  private admobCallbacks: SkinRewardAdCallbacks | null = null;
  private dailyLimiter = new SkinDailyAdLimiter();
  private readonly loadRetryBackoff = new RetryBackoffScheduler();
  private readonly showCooldown = new CooldownGate(7000);
  // 시간당 최대 8회 노출 제한 (일일 3회 한도의 안전 마진)
  private readonly hourlyFrequencyCap = new HourlyFrequencyCap(8);
  // 90초 내 5회 초과 시 2분 차단 (정상 사용은 도달 불가, 자동 스크립트만 감지)
  private readonly abuseGuard = new ClickAbuseGuard(5, 90_000, 120_000);

  constructor() {
    this.adUnitId = getSkinRewardAdId();

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.setupListeners();
    }
  }

  private setupListeners(): void {
    AdMob.addListener(RewardAdPluginEvents.Loaded, (_info: AdLoadInfo) => {
      this.loadStatus = 'loaded';
      this.loadRetryBackoff.reset();
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
      this.loadStatus = 'failed';
      this.loadRetryBackoff.schedule(() => {
        if (this.loadStatus === 'failed') this.preloadAd();
      });
    });

    AdMob.addListener(RewardAdPluginEvents.Showed, () => {
      // 광고 표시됨
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
      this.loadStatus = 'failed';
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;
      if (this.admobCallbacks) {
        this.admobCallbacks.onError(new Error('스킨 광고 표시 실패'));
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
        }
      }
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
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
    if (!isSkinRewardAdSupported()) return;
    if (this.loadStatus === 'loading' || this.loadStatus === 'loaded') return;
    if (CURRENT_AD_PLATFORM !== 'admob-ios' && CURRENT_AD_PLATFORM !== 'admob-android') return;

    void this.loadAdMobAd();
  }

  private async loadAdMobAd(): Promise<void> {
    this.loadStatus = 'loading';

    const canRequest = await ensureAdMobReady();
    if (!canRequest) { this.loadStatus = 'failed'; return; }

    const options: RewardAdOptions = { adId: this.adUnitId };

    try {
      await AdMob.prepareRewardVideoAd(options);
    } catch {
      this.loadStatus = 'failed';
    }
  }

  public showRewardAd(callbacks: SkinRewardAdCallbacks): void {
    if (!isSkinRewardAdSupported()) {
      callbacks.onError(new Error('스킨 광고가 지원되지 않는 환경입니다.'));
      return;
    }

    if (this.isProcessingShow) return;

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
      callbacks.onError(new Error('광고를 준비 중입니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    this.showCooldown.mark();
    this.isProcessingShow = true;
    this.rewardIssuedForCurrentShow = false;
    this.admobCallbacks = callbacks;

    void this.showAdMobAd(callbacks);
  }

  private async showAdMobAd(callbacks: SkinRewardAdCallbacks): Promise<void> {
    try {
      await AdMob.showRewardVideoAd();
      this.loadStatus = 'not_loaded';
    } catch (error) {
      this.loadStatus = 'failed';
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;
      this.admobCallbacks = null;
      callbacks.onError(error as Error);
    }
  }

  public isAdReady(): boolean {
    return this.loadStatus === 'loaded';
  }

  public getRemainingDailyViews(): number {
    return this.dailyLimiter.getRemainingCount();
  }
}

export const skinRewardAdService = new SkinRewardAdService();
