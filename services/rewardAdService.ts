/**
 * 리워드 광고 서비스 (보안 강화 버전)
 * - 중복 시청 방지
 * - 보상 중복 지급 방지
 * - 일일 제한 강화
 * - Race condition 방지
 * - 세션 복구 메커니즘
 * - 멀티 플랫폼 지원 (Apps-in-Toss, AdMob iOS/Android)
 */

import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { AdMob, RewardAdOptions, RewardAdPluginEvents, AdMobRewardItem, AdLoadInfo } from '@capacitor-community/admob';
import { getRewardAdId, isRewardAdSupported, CURRENT_AD_PLATFORM } from './adConfig';
import { MAX_DAILY_AD_VIEWS } from '../constants';

// ==========================================
// 📌 타입 정의
// ==========================================

export interface RewardAdCallbacks {
  onRewardEarned: (amount: number) => void;
  onAdClosed: () => void;
  onError: (error: Error) => void;
  onDailyLimitReached?: () => void;
}

type AdLoadStatus = 'not_loaded' | 'loading' | 'loaded' | 'failed';
type AdShowStatus = 'idle' | 'showing' | 'rewarded' | 'closed';

// ==========================================
// 📌 일일 시청 제한 관리
// ==========================================

interface DailyAdData {
  date: string; // YYYY-MM-DD
  count: number;
  lastWatchTimestamp: number;
}

class DailyAdLimiter {
  private readonly STORAGE_KEY = 'slidemino_daily_ad_data';

  private getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private getData(): DailyAdData {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return this.createFreshData();

      const data: DailyAdData = JSON.parse(stored);
      const today = this.getTodayString();

      // 날짜가 바뀌었으면 초기화
      if (data.date !== today) {
        return this.createFreshData();
      }

      return data;
    } catch {
      return this.createFreshData();
    }
  }

  private createFreshData(): DailyAdData {
    return {
      date: this.getTodayString(),
      count: 0,
      lastWatchTimestamp: 0,
    };
  }

  private saveData(data: DailyAdData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[DailyAdLimiter] 저장 실패:', error);
    }
  }

  /**
   * 광고 시청 가능 여부 확인
   */
  public canWatchAd(): boolean {
    const data = this.getData();
    return data.count < MAX_DAILY_AD_VIEWS;
  }

  /**
   * 남은 시청 횟수 반환
   */
  public getRemainingCount(): number {
    const data = this.getData();
    return Math.max(0, MAX_DAILY_AD_VIEWS - data.count);
  }

  /**
   * 광고 시청 기록 (중복 방지)
   */
  public recordAdWatch(): boolean {
    const data = this.getData();

    // 이미 한도 도달
    if (data.count >= MAX_DAILY_AD_VIEWS) {
      console.warn('[DailyAdLimiter] 일일 한도 도달');
      return false;
    }

    // 30초 이내 중복 시청 방지 (광고 최소 시청 시간)
    const now = Date.now();
    if (now - data.lastWatchTimestamp < 30000) {
      console.warn('[DailyAdLimiter] 너무 빠른 재시청 시도');
      return false;
    }

    // 기록
    data.count += 1;
    data.lastWatchTimestamp = now;
    this.saveData(data);

    console.log(`[DailyAdLimiter] 시청 기록: ${data.count}/${MAX_DAILY_AD_VIEWS}`);
    return true;
  }
}

// ==========================================
// 📌 보상 지급 세션 관리 (중복 방지)
// ==========================================

class RewardSessionManager {
  private readonly STORAGE_KEY = 'slidemino_reward_session';
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5분

  /**
   * 현재 진행 중인 광고 세션 ID 생성
   */
  public createSession(): string {
    const sessionId = `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionData = {
      id: sessionId,
      createdAt: Date.now(),
      rewarded: false,
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
    } catch {
      // 저장 실패 시 메모리에만 보관
    }

    return sessionId;
  }

  /**
   * 보상 지급 완료 표시 (멱등성 보장)
   */
  public markRewarded(sessionId: string): boolean {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return false;

      const sessionData = JSON.parse(stored);

      // 세션 ID 불일치 (잘못된 호출)
      if (sessionData.id !== sessionId) {
        console.warn('[RewardSession] 세션 ID 불일치');
        return false;
      }

      // 이미 보상 지급됨 (중복 방지)
      if (sessionData.rewarded) {
        console.warn('[RewardSession] 보상 이미 지급됨');
        return false;
      }

      // 세션 타임아웃 (광고 시청 후 5분 이상 지남)
      if (Date.now() - sessionData.createdAt > this.SESSION_TIMEOUT) {
        console.warn('[RewardSession] 세션 타임아웃');
        this.clearSession();
        return false;
      }

      // 보상 지급 표시
      sessionData.rewarded = true;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 세션 정리
   */
  public clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // 무시
    }
  }
}

// ==========================================
// 📌 리워드 광고 서비스 (보안 강화)
// ==========================================

class RewardAdService {
  private loadStatus: AdLoadStatus = 'not_loaded';
  private showStatus: AdShowStatus = 'idle';
  private cleanupLoadFn: (() => void) | null = null;
  private adGroupId: string = '';

  private dailyLimiter = new DailyAdLimiter();
  private sessionManager = new RewardSessionManager();
  private currentSessionId: string | null = null;

  // Race condition 방지 플래그
  private isProcessingShow = false;

  constructor() {
    this.adGroupId = getRewardAdId();

    if (process.env.NODE_ENV === 'development') {
      console.log('[RewardAdService] 초기화');
      console.log('[RewardAdService] 플랫폼:', CURRENT_AD_PLATFORM);
      console.log('[RewardAdService] 광고 ID:', this.adGroupId);
      console.log('[RewardAdService] 남은 시청:', this.dailyLimiter.getRemainingCount());
    }

    // AdMob 플랫폼이면 이벤트 리스너 등록
    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.setupAdMobListeners();
    }
  }

  // ==========================================
  // 📌 AdMob 이벤트 리스너 설정
  // ==========================================

  private admobCallbacks: RewardAdCallbacks | null = null;

  private setupAdMobListeners(): void {
    // 광고 로드 성공
    AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      this.loadStatus = 'loaded';
      console.log('[RewardAdService] AdMob 광고 로드 완료:', info);
    });

    // 광고 로드 실패
    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
      this.loadStatus = 'failed';
      console.error('[RewardAdService] AdMob 광고 로드 실패:', error);

      // 5초 후 재시도
      setTimeout(() => {
        if (this.loadStatus === 'failed') {
          this.preloadAd();
        }
      }, 5000);
    });

    // 광고 표시됨
    AdMob.addListener(RewardAdPluginEvents.Showed, () => {
      console.log('[RewardAdService] AdMob 광고 표시됨');
      this.showStatus = 'showing';
    });

    // 광고 표시 실패
    AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
      console.error('[RewardAdService] AdMob 광고 표시 실패:', error);
      this.showStatus = 'idle';
      this.isProcessingShow = false;
      this.loadStatus = 'failed';

      if (this.admobCallbacks) {
        this.admobCallbacks.onError(new Error('AdMob 광고 표시 실패'));
        this.admobCallbacks = null;
      }
    });

    // 🎯 핵심: 보상 획득
    AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
      console.log('[RewardAdService] AdMob 보상 획득:', reward);
      this.showStatus = 'rewarded';

      if (this.admobCallbacks) {
        const amount = reward.amount || 3;
        this.handleRewardEarned(amount, this.admobCallbacks);
      }
    });

    // 광고 닫힘
    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('[RewardAdService] AdMob 광고 닫힘');
      this.showStatus = 'closed';
      this.isProcessingShow = false;

      if (this.admobCallbacks) {
        this.admobCallbacks.onAdClosed();
        this.admobCallbacks = null;
      }

      // 세션 정리 및 다음 광고 로드
      this.sessionManager.clearSession();
      setTimeout(() => this.preloadAd(), 100);
    });
  }

  // ==========================================
  // 📌 광고 미리 로드
  // ==========================================

  public preloadAd(): void {
    // 플랫폼 지원 체크
    if (!this.checkPlatformSupport()) return;

    // 이미 로드 중이거나 로드됨
    if (this.loadStatus === 'loading' || this.loadStatus === 'loaded') {
      return;
    }

    // 플랫폼별 분기
    if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
      this.loadAppsInTossRewardAd();
    } else if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.loadAdMobRewardAd();
    }
  }

  private loadAppsInTossRewardAd(): void {
    if (!GoogleAdMob.loadAppsInTossAdMob.isSupported()) {
      console.warn('[RewardAdService] GoogleAdMob 미지원');
      this.loadStatus = 'failed';
      return;
    }

    this.loadStatus = 'loading';
    console.log('[RewardAdService] 광고 로드 시작...');

    this.cleanupLoadFn = GoogleAdMob.loadAppsInTossAdMob({
      options: { adGroupId: this.adGroupId },
      onEvent: (event) => {
        switch (event.type) {
          case 'loaded':
            this.loadStatus = 'loaded';
            console.log('[RewardAdService] 광고 로드 완료');
            this.cleanupLoadFn?.();
            this.cleanupLoadFn = null;
            break;
        }
      },
      onError: (error) => {
        this.loadStatus = 'failed';
        console.error('[RewardAdService] 광고 로드 실패:', error);
        this.cleanupLoadFn?.();
        this.cleanupLoadFn = null;
      },
    });
  }

  private async loadAdMobRewardAd(): Promise<void> {
    this.loadStatus = 'loading';
    console.log('[RewardAdService] AdMob 광고 로드 시작...');

    const options: RewardAdOptions = {
      adId: this.adGroupId,
    };

    try {
      await AdMob.prepareRewardVideoAd(options);
      // AdMob은 이벤트 리스너에서 loaded 상태를 설정
      // 로드 완료 리스너는 constructor에서 설정됨
    } catch (error) {
      this.loadStatus = 'failed';
      console.error('[RewardAdService] AdMob 광고 로드 실패:', error);
    }
  }

  // ==========================================
  // 📌 광고 표시 (보안 강화)
  // ==========================================

  public showRewardAd(callbacks: RewardAdCallbacks): void {
    // 1. 플랫폼 지원 체크
    if (!this.checkPlatformSupport()) {
      callbacks.onError(new Error('광고 기능이 지원되지 않는 환경입니다.'));
      return;
    }

    // 2. Race condition 방지
    if (this.isProcessingShow) {
      console.warn('[RewardAdService] 이미 광고 처리 중');
      return;
    }

    // 3. 일일 제한 체크
    if (!this.dailyLimiter.canWatchAd()) {
      console.warn('[RewardAdService] 일일 한도 도달');
      callbacks.onDailyLimitReached?.();
      callbacks.onError(new Error('오늘의 광고 시청 횟수를 모두 사용했습니다.'));
      return;
    }

    // 4. 광고 로드 상태 체크
    if (this.loadStatus !== 'loaded') {
      const msg =
        this.loadStatus === 'loading'
          ? '광고를 불러오는 중입니다.'
          : '광고가 아직 준비되지 않았습니다.';
      callbacks.onError(new Error(msg));
      return;
    }

    // 5. 광고 표시
    this.isProcessingShow = true;
    this.currentSessionId = this.sessionManager.createSession();

    if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
      this.showAppsInTossRewardAd(callbacks);
    } else if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.showAdMobRewardAd(callbacks);
    }
  }

  private showAppsInTossRewardAd(callbacks: RewardAdCallbacks): void {
    if (!GoogleAdMob.showAppsInTossAdMob.isSupported()) {
      this.isProcessingShow = false;
      callbacks.onError(new Error('GoogleAdMob 미지원'));
      return;
    }

    this.showStatus = 'showing';
    console.log('[RewardAdService] 광고 표시 시작');

    GoogleAdMob.showAppsInTossAdMob({
      options: { adGroupId: this.adGroupId },
      onEvent: (event) => {
        switch (event.type) {
          case 'requested':
            console.log('[RewardAdService] 광고 요청 완료');
            this.loadStatus = 'not_loaded';
            break;

          case 'show':
            console.log('[RewardAdService] 광고 표시됨');
            break;

          case 'impression':
            console.log('[RewardAdService] 광고 노출');
            break;

          case 'userEarnedReward':
            // 🎯 핵심: 보상 획득 (중복 방지)
            this.handleRewardEarned(event.data.unitAmount || 3, callbacks);
            break;

          case 'clicked':
            console.log('[RewardAdService] 광고 클릭');
            break;

          case 'dismissed':
            console.log('[RewardAdService] 광고 닫힘');
            this.showStatus = 'closed';
            this.isProcessingShow = false;
            callbacks.onAdClosed();

            // 세션 정리 및 다음 광고 로드
            this.sessionManager.clearSession();
            setTimeout(() => this.preloadAd(), 100);
            break;

          case 'failedToShow':
            console.error('[RewardAdService] 광고 표시 실패');
            this.showStatus = 'idle';
            this.isProcessingShow = false;
            this.loadStatus = 'failed';
            callbacks.onError(new Error('광고 표시 실패'));
            break;
        }
      },
      onError: (error) => {
        console.error('[RewardAdService] 광고 에러:', error);
        this.showStatus = 'idle';
        this.isProcessingShow = false;
        this.loadStatus = 'failed';
        callbacks.onError(error);
      },
    });
  }

  private async showAdMobRewardAd(callbacks: RewardAdCallbacks): Promise<void> {
    this.showStatus = 'showing';
    this.admobCallbacks = callbacks; // 리스너에서 사용할 콜백 저장
    console.log('[RewardAdService] AdMob 광고 표시 시작');

    try {
      await AdMob.showRewardVideoAd();
      this.loadStatus = 'not_loaded';
      // 보상 처리는 리스너에서 수행됨 (setupAdMobListeners에서 설정)
    } catch (error) {
      console.error('[RewardAdService] AdMob 광고 표시 실패:', error);
      this.showStatus = 'idle';
      this.isProcessingShow = false;
      this.loadStatus = 'failed';
      this.admobCallbacks = null;
      callbacks.onError(error as Error);
    }
  }

  /**
   * 보상 지급 처리 (중복 방지)
   */
  private handleRewardEarned(amount: number, callbacks: RewardAdCallbacks): void {
    // 세션 확인 및 멱등성 보장
    if (!this.currentSessionId) {
      console.error('[RewardAdService] 세션 ID 없음');
      return;
    }

    const isValid = this.sessionManager.markRewarded(this.currentSessionId);
    if (!isValid) {
      console.warn('[RewardAdService] 보상 이미 지급됨 (중복 방지)');
      return;
    }

    // 일일 시청 기록
    const recorded = this.dailyLimiter.recordAdWatch();
    if (!recorded) {
      console.error('[RewardAdService] 시청 기록 실패');
      return;
    }

    // 보상 지급
    this.showStatus = 'rewarded';
    console.log(`[RewardAdService] 보상 지급: ${amount}회`);
    callbacks.onRewardEarned(amount);
  }

  // ==========================================
  // 📌 유틸리티
  // ==========================================

  private checkPlatformSupport(): boolean {
    if (!isRewardAdSupported()) {
      console.warn('[RewardAdService] 플랫폼 미지원:', CURRENT_AD_PLATFORM);
      return false;
    }
    return true;
  }

  public isAdReady(): boolean {
    return this.loadStatus === 'loaded';
  }

  public getLoadStatus(): AdLoadStatus {
    return this.loadStatus;
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
    this.sessionManager.clearSession();

    // AdMob 리스너 제거 (타입 정의에 없지만 런타임에서는 동작)
    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      // @ts-expect-error - removeAllListeners는 Capacitor 플러그인 표준 메서드이나 타입 정의 누락
      AdMob.removeAllListeners?.();
    }

    console.log('[RewardAdService] 리소스 정리');
  }
}

// ==========================================
// 📌 싱글톤 인스턴스
// ==========================================

export const rewardAdService = new RewardAdService();
