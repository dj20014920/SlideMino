/**
 * 보상형 전면 광고 서비스
 * - 플랫폼별 분기 (Apps-in-Toss / AdMob iOS/Android)
 * - 일일 한도 관리
 * - 중복 보상 방지
 */

import { GoogleAdMob } from '@apps-in-toss/web-framework';
import {
  AdMob,
  type AdLoadInfo,
  type AdMobRewardInterstitialItem,
  type RewardInterstitialAdOptions,
  RewardInterstitialAdPluginEvents,
} from '@capacitor-community/admob';
import {
  ADMOB_TEST_AD_IDS,
  CURRENT_AD_PLATFORM,
  getRewardInterstitialAdId,
  isRewardInterstitialAdSupported,
} from './adConfig';
import { ensureAdMobReady, isVirtualDevice } from './admob';
import { MAX_DAILY_REVIVE_AD_VIEWS } from '../constants';

export interface RewardInterstitialAdCallbacks {
  onRewardEarned: () => void;
  onAdClosed: () => void;
  onError: (error: Error) => void;
  onDailyLimitReached?: () => void;
}

export interface RewardInterstitialAdServiceOptions {
  adUnitId: string;
  isSupported: () => boolean;
  maxDailyViews: number;
  dailyStorageKey: string;
  logTag: string;
}

type AdLoadStatus = 'not_loaded' | 'loading' | 'loaded' | 'failed';
type AdShowStatus = 'idle' | 'showing' | 'rewarded' | 'closed';

interface DailyAdData {
  date: string;
  count: number;
}

class DailyRewardInterstitialAdLimiter {
  constructor(
    private readonly storageKey: string,
    private readonly maxDailyViews: number
  ) {}

  private getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private createFreshData(): DailyAdData {
    return {
      date: this.getTodayString(),
      count: 0,
    };
  }

  private getData(): DailyAdData {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return this.createFreshData();

      const data: DailyAdData = JSON.parse(stored);
      if (data.date !== this.getTodayString()) {
        return this.createFreshData();
      }

      return data;
    } catch {
      return this.createFreshData();
    }
  }

  private saveData(data: DailyAdData): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // localStorage 저장 실패는 게임 진행을 막지 않는다.
    }
  }

  public canWatchAd(): boolean {
    const data = this.getData();
    return data.count < this.maxDailyViews;
  }

  public getRemainingCount(): number {
    const data = this.getData();
    return Math.max(0, this.maxDailyViews - data.count);
  }

  public recordWatch(): boolean {
    const data = this.getData();
    if (data.count >= this.maxDailyViews) {
      return false;
    }

    data.count += 1;
    this.saveData(data);
    return true;
  }
}

export class RewardInterstitialAdService {
  private static hasSharedAdMobListeners = false;
  private static activeService: RewardInterstitialAdService | null = null;
  private static services = new Set<RewardInterstitialAdService>();

  private adUnitId: string;
  private readonly isSupported: () => boolean;
  private readonly logTag: string;
  private loadStatus: AdLoadStatus = 'not_loaded';
  private showStatus: AdShowStatus = 'idle';
  private isProcessingShow = false;
  private cleanupLoadFn: (() => void) | null = null;
  private admobCallbacks: RewardInterstitialAdCallbacks | null = null;
  private rewardIssuedForCurrentShow = false;
  private dailyLimiter: DailyRewardInterstitialAdLimiter;

  constructor(options: RewardInterstitialAdServiceOptions) {
    this.adUnitId = options.adUnitId;
    this.isSupported = options.isSupported;
    this.logTag = options.logTag;
    this.dailyLimiter = new DailyRewardInterstitialAdLimiter(options.dailyStorageKey, options.maxDailyViews);
    RewardInterstitialAdService.services.add(this);

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      RewardInterstitialAdService.setupSharedAdMobListeners();
    }

    if (import.meta.env.DEV) {
      console.log(`[${this.logTag}] 초기화`);
      console.log(`[${this.logTag}] 플랫폼:`, CURRENT_AD_PLATFORM);
      console.log(`[${this.logTag}] 광고 ID:`, this.adUnitId);
      console.log(`[${this.logTag}] 지원 여부:`, this.isSupported());
    }
  }

  private static setupSharedAdMobListeners(): void {
    if (RewardInterstitialAdService.hasSharedAdMobListeners) return;
    RewardInterstitialAdService.hasSharedAdMobListeners = true;

    AdMob.addListener(RewardInterstitialAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      RewardInterstitialAdService.activeService?.handleLoaded(info);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.FailedToLoad, (error) => {
      RewardInterstitialAdService.activeService?.handleFailedToLoad(error);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.Showed, () => {
      RewardInterstitialAdService.activeService?.handleShowed();
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.FailedToShow, (error) => {
      RewardInterstitialAdService.activeService?.handleFailedToShow(error);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.Rewarded, (reward: AdMobRewardInterstitialItem) => {
      RewardInterstitialAdService.activeService?.handleRewarded(reward);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.Dismissed, () => {
      RewardInterstitialAdService.activeService?.handleDismissed();
    });
  }

  private activateForAdMobEvents(): void {
    RewardInterstitialAdService.activeService = this;
    RewardInterstitialAdService.services.forEach((service) => {
      if (service === this) return;
      service.invalidatePreparedAdState();
    });
  }

  private invalidatePreparedAdState(): void {
    this.loadStatus = 'not_loaded';
    this.showStatus = 'idle';
    this.isProcessingShow = false;
    this.admobCallbacks = null;
    this.rewardIssuedForCurrentShow = false;
  }

  private handleLoaded(info: AdLoadInfo): void {
    this.loadStatus = 'loaded';
    console.log(`[${this.logTag}] AdMob 보상형 전면 광고 로드 완료:`, info);
  }

  private handleFailedToLoad(error: unknown): void {
    this.loadStatus = 'failed';
    console.error(`[${this.logTag}] AdMob 보상형 전면 광고 로드 실패:`, error);

    setTimeout(() => {
      if (this.loadStatus === 'failed') {
        this.preloadAd();
      }
    }, 5000);
  }

  private handleShowed(): void {
    this.showStatus = 'showing';
  }

  private handleFailedToShow(error: unknown): void {
    this.showStatus = 'idle';
    this.loadStatus = 'failed';
    this.isProcessingShow = false;
    this.rewardIssuedForCurrentShow = false;

    if (this.admobCallbacks) {
      this.admobCallbacks.onError(new Error('보상형 전면 광고 표시 실패'));
      this.admobCallbacks = null;
    }

    console.error(`[${this.logTag}] AdMob 보상형 전면 광고 표시 실패:`, error);
  }

  private handleRewarded(reward: AdMobRewardInterstitialItem): void {
    if (!this.admobCallbacks) return;
    this.handleRewardEarned(this.admobCallbacks, reward);
  }

  private handleDismissed(): void {
    this.showStatus = 'closed';
    this.isProcessingShow = false;
    this.rewardIssuedForCurrentShow = false;

    if (this.admobCallbacks) {
      this.admobCallbacks.onAdClosed();
      this.admobCallbacks = null;
    }

    setTimeout(() => this.preloadAd(), 100);
  }

  private checkSupport(): boolean {
    if (!this.isSupported()) {
      console.warn(`[${this.logTag}] 플랫폼 미지원:`, CURRENT_AD_PLATFORM);
      return false;
    }

    if (!this.adUnitId) {
      console.warn(`[${this.logTag}] 광고 ID 미설정`);
      return false;
    }

    return true;
  }

  public preloadAd(): void {
    if (!this.checkSupport()) return;
    if (this.loadStatus === 'loading' || this.loadStatus === 'loaded') return;

    if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
      this.loadAppsInTossAd();
      return;
    }

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      void this.loadAdMobAd();
    }
  }

  private loadAppsInTossAd(): void {
    if (!GoogleAdMob.loadAppsInTossAdMob.isSupported()) {
      this.loadStatus = 'failed';
      return;
    }

    this.loadStatus = 'loading';
    this.cleanupLoadFn = GoogleAdMob.loadAppsInTossAdMob({
      options: { adGroupId: this.adUnitId },
      onEvent: (event) => {
        if (event.type === 'loaded') {
          this.loadStatus = 'loaded';
          this.cleanupLoadFn?.();
          this.cleanupLoadFn = null;
        }
      },
      onError: (error) => {
        this.loadStatus = 'failed';
        this.cleanupLoadFn?.();
        this.cleanupLoadFn = null;
        console.error(`[${this.logTag}] 앱인토스 보상형 전면 광고 로드 실패:`, error);
      },
    });
  }

  private async loadAdMobAd(): Promise<void> {
    this.activateForAdMobEvents();
    this.loadStatus = 'loading';

    const canRequest = await ensureAdMobReady();
    if (!canRequest) {
      this.loadStatus = 'failed';
      return;
    }

    const isVirtual = await isVirtualDevice();
    const shouldUseTestAds = import.meta.env.MODE !== 'production' || isVirtual;
    const adId = shouldUseTestAds
      ? (CURRENT_AD_PLATFORM === 'admob-ios'
        ? ADMOB_TEST_AD_IDS.IOS.REWARD_INTERSTITIAL
        : ADMOB_TEST_AD_IDS.ANDROID.REWARD_INTERSTITIAL)
      : this.adUnitId;

    const options: RewardInterstitialAdOptions = {
      adId,
      isTesting: shouldUseTestAds,
    };

    try {
      await AdMob.prepareRewardInterstitialAd(options);
    } catch (error) {
      this.loadStatus = 'failed';
      console.error(`[${this.logTag}] AdMob 보상형 전면 광고 로드 실패:`, error);
    }
  }

  public showRewardAd(callbacks: RewardInterstitialAdCallbacks): void {
    if (!this.checkSupport()) {
      callbacks.onError(new Error('현재 환경에서는 보상형 전면 광고를 사용할 수 없습니다.'));
      return;
    }

    if (this.isProcessingShow) {
      return;
    }

    if (!this.dailyLimiter.canWatchAd()) {
      callbacks.onDailyLimitReached?.();
      return;
    }

    if (this.loadStatus !== 'loaded') {
      if (this.loadStatus === 'not_loaded' || this.loadStatus === 'failed') {
        this.preloadAd();
      }
      callbacks.onError(new Error('광고를 준비 중입니다. 잠시 후 다시 시도해주세요.'));
      return;
    }

    this.isProcessingShow = true;
    this.rewardIssuedForCurrentShow = false;

    if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
      this.showAppsInTossAd(callbacks);
      return;
    }

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      void this.showAdMobAd(callbacks);
      return;
    }

    this.isProcessingShow = false;
    callbacks.onError(new Error('광고 플랫폼을 확인할 수 없습니다.'));
  }

  // 하위 호환: 기존 호출부 유지
  public showReviveAd(callbacks: RewardInterstitialAdCallbacks): void {
    this.showRewardAd(callbacks);
  }

  private showAppsInTossAd(callbacks: RewardInterstitialAdCallbacks): void {
    if (!GoogleAdMob.showAppsInTossAdMob.isSupported()) {
      this.isProcessingShow = false;
      callbacks.onError(new Error('GoogleAdMob 미지원'));
      return;
    }

    this.showStatus = 'showing';

    GoogleAdMob.showAppsInTossAdMob({
      options: { adGroupId: this.adUnitId },
      onEvent: (event) => {
        switch (event.type) {
          case 'requested':
            this.loadStatus = 'not_loaded';
            break;

          case 'userEarnedReward':
            this.handleRewardEarned(callbacks, event.data);
            break;

          case 'dismissed':
            this.showStatus = 'closed';
            this.isProcessingShow = false;
            this.rewardIssuedForCurrentShow = false;
            callbacks.onAdClosed();
            setTimeout(() => this.preloadAd(), 100);
            break;

          case 'failedToShow':
            this.showStatus = 'idle';
            this.loadStatus = 'failed';
            this.isProcessingShow = false;
            this.rewardIssuedForCurrentShow = false;
            callbacks.onError(new Error('광고 표시 실패'));
            break;
        }
      },
      onError: (error) => {
        this.showStatus = 'idle';
        this.loadStatus = 'failed';
        this.isProcessingShow = false;
        this.rewardIssuedForCurrentShow = false;
        callbacks.onError(error);
      },
    });
  }

  private async showAdMobAd(callbacks: RewardInterstitialAdCallbacks): Promise<void> {
    this.activateForAdMobEvents();
    this.admobCallbacks = callbacks;
    this.showStatus = 'showing';

    try {
      await AdMob.showRewardInterstitialAd();
      this.loadStatus = 'not_loaded';
    } catch (error) {
      this.showStatus = 'idle';
      this.loadStatus = 'failed';
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;
      this.admobCallbacks = null;
      callbacks.onError(error as Error);
    }
  }

  private handleRewardEarned(callbacks: RewardInterstitialAdCallbacks, reward: unknown): void {
    if (this.rewardIssuedForCurrentShow) return;

    if (!this.dailyLimiter.recordWatch()) {
      callbacks.onDailyLimitReached?.();
      this.isProcessingShow = false;
      return;
    }

    this.rewardIssuedForCurrentShow = true;
    this.showStatus = 'rewarded';
    console.log(`[${this.logTag}] 보상 지급 완료:`, reward);
    callbacks.onRewardEarned();
  }

  public isAdReady(): boolean {
    return this.loadStatus === 'loaded';
  }

  public getRemainingDailyViews(): number {
    return this.dailyLimiter.getRemainingCount();
  }

  public cleanup(): void {
    this.cleanupLoadFn?.();
    this.cleanupLoadFn = null;
    this.loadStatus = 'not_loaded';
    this.showStatus = 'idle';
    this.isProcessingShow = false;
    this.admobCallbacks = null;
    this.rewardIssuedForCurrentShow = false;
    if (RewardInterstitialAdService.activeService === this) {
      RewardInterstitialAdService.activeService = null;
    }
  }
}

export const rewardInterstitialAdService = new RewardInterstitialAdService({
  adUnitId: getRewardInterstitialAdId(),
  isSupported: isRewardInterstitialAdSupported,
  maxDailyViews: MAX_DAILY_REVIVE_AD_VIEWS,
  dailyStorageKey: 'slidemino_daily_revive_ad_data',
  logTag: 'RewardInterstitialAdService',
});
