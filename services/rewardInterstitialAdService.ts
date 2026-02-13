/**
 * 게임오버 부활용 보상형 전면 광고 서비스
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

export interface ReviveAdCallbacks {
  onRewardEarned: () => void;
  onAdClosed: () => void;
  onError: (error: Error) => void;
  onDailyLimitReached?: () => void;
}

type AdLoadStatus = 'not_loaded' | 'loading' | 'loaded' | 'failed';
type AdShowStatus = 'idle' | 'showing' | 'rewarded' | 'closed';

interface DailyReviveAdData {
  date: string; // YYYY-MM-DD
  count: number;
}

class DailyReviveAdLimiter {
  private readonly STORAGE_KEY = 'slidemino_daily_revive_ad_data';

  private getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private createFreshData(): DailyReviveAdData {
    return {
      date: this.getTodayString(),
      count: 0,
    };
  }

  private getData(): DailyReviveAdData {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return this.createFreshData();

      const data: DailyReviveAdData = JSON.parse(stored);
      if (data.date !== this.getTodayString()) {
        return this.createFreshData();
      }

      return data;
    } catch {
      return this.createFreshData();
    }
  }

  private saveData(data: DailyReviveAdData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage 저장 실패는 게임 진행을 막지 않는다.
    }
  }

  public canWatchAd(): boolean {
    const data = this.getData();
    return data.count < MAX_DAILY_REVIVE_AD_VIEWS;
  }

  public getRemainingCount(): number {
    const data = this.getData();
    return Math.max(0, MAX_DAILY_REVIVE_AD_VIEWS - data.count);
  }

  public recordWatch(): boolean {
    const data = this.getData();
    if (data.count >= MAX_DAILY_REVIVE_AD_VIEWS) {
      return false;
    }

    data.count += 1;
    this.saveData(data);
    return true;
  }
}

class RewardInterstitialAdService {
  private adUnitId: string = '';
  private loadStatus: AdLoadStatus = 'not_loaded';
  private showStatus: AdShowStatus = 'idle';
  private isProcessingShow = false;
  private cleanupLoadFn: (() => void) | null = null;
  private admobCallbacks: ReviveAdCallbacks | null = null;
  private hasAdMobListeners = false;
  private rewardIssuedForCurrentShow = false;
  private dailyLimiter = new DailyReviveAdLimiter();

  constructor() {
    this.adUnitId = getRewardInterstitialAdId();

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.setupAdMobListeners();
    }

    if (import.meta.env.DEV) {
      console.log('[RewardInterstitialAdService] 초기화');
      console.log('[RewardInterstitialAdService] 플랫폼:', CURRENT_AD_PLATFORM);
      console.log('[RewardInterstitialAdService] 광고 ID:', this.adUnitId);
      console.log('[RewardInterstitialAdService] 지원 여부:', isRewardInterstitialAdSupported());
    }
  }

  private setupAdMobListeners(): void {
    if (this.hasAdMobListeners) return;
    this.hasAdMobListeners = true;

    AdMob.addListener(RewardInterstitialAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      this.loadStatus = 'loaded';
      console.log('[RewardInterstitialAdService] AdMob 보상형 전면 광고 로드 완료:', info);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.FailedToLoad, (error) => {
      this.loadStatus = 'failed';
      console.error('[RewardInterstitialAdService] AdMob 보상형 전면 광고 로드 실패:', error);

      setTimeout(() => {
        if (this.loadStatus === 'failed') {
          this.preloadAd();
        }
      }, 5000);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.Showed, () => {
      this.showStatus = 'showing';
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.FailedToShow, (error) => {
      this.showStatus = 'idle';
      this.loadStatus = 'failed';
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;

      if (this.admobCallbacks) {
        this.admobCallbacks.onError(new Error('보상형 전면 광고 표시 실패'));
        this.admobCallbacks = null;
      }

      console.error('[RewardInterstitialAdService] AdMob 보상형 전면 광고 표시 실패:', error);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.Rewarded, (reward: AdMobRewardInterstitialItem) => {
      if (!this.admobCallbacks) return;
      this.handleRewardEarned(this.admobCallbacks, reward);
    });

    AdMob.addListener(RewardInterstitialAdPluginEvents.Dismissed, () => {
      this.showStatus = 'closed';
      this.isProcessingShow = false;
      this.rewardIssuedForCurrentShow = false;

      if (this.admobCallbacks) {
        this.admobCallbacks.onAdClosed();
        this.admobCallbacks = null;
      }

      setTimeout(() => this.preloadAd(), 100);
    });
  }

  private checkSupport(): boolean {
    if (!isRewardInterstitialAdSupported()) {
      console.warn('[RewardInterstitialAdService] 플랫폼 미지원:', CURRENT_AD_PLATFORM);
      return false;
    }

    if (!this.adUnitId) {
      console.warn('[RewardInterstitialAdService] 광고 ID 미설정');
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
      this.loadAdMobAd();
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
        console.error('[RewardInterstitialAdService] 앱인토스 보상형 전면 광고 로드 실패:', error);
      },
    });
  }

  private async loadAdMobAd(): Promise<void> {
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
      console.error('[RewardInterstitialAdService] AdMob 보상형 전면 광고 로드 실패:', error);
    }
  }

  public showReviveAd(callbacks: ReviveAdCallbacks): void {
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
      this.showAdMobAd(callbacks);
      return;
    }

    this.isProcessingShow = false;
    callbacks.onError(new Error('광고 플랫폼을 확인할 수 없습니다.'));
  }

  private showAppsInTossAd(callbacks: ReviveAdCallbacks): void {
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

  private async showAdMobAd(callbacks: ReviveAdCallbacks): Promise<void> {
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

  private handleRewardEarned(callbacks: ReviveAdCallbacks, reward: unknown): void {
    if (this.rewardIssuedForCurrentShow) return;

    if (!this.dailyLimiter.recordWatch()) {
      callbacks.onDailyLimitReached?.();
      this.isProcessingShow = false;
      return;
    }

    this.rewardIssuedForCurrentShow = true;
    this.showStatus = 'rewarded';
    console.log('[RewardInterstitialAdService] 보상 지급 완료:', reward);
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
  }
}

export const rewardInterstitialAdService = new RewardInterstitialAdService();
