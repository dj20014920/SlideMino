/**
 * 배너 광고 서비스 (중앙집중형 설계)
 * - 리워드 광고(rewardAdService)와 동일한 아키텍처 패턴 적용
 * - 멀티 플랫폼 지원 (Apps-in-Toss, AdMob iOS/Android, AdSense)
 * - 중복 표시 방지 및 리소스 관리
 */

import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { AdMob, BannerAdPosition, BannerAdSize, BannerAdOptions, BannerAdPluginEvents } from '@capacitor-community/admob';
import { ADMOB_TEST_AD_IDS, getBannerAdId, isBannerAdSupported, CURRENT_AD_PLATFORM } from './adConfig';
import { AD_MOB_CONSENT_UPDATED_EVENT, ensureAdMobReady, getAdMobRequestPolicy } from './admob';
import { RetryBackoffScheduler } from './adResilience';
import { trackAnalyticsEvent } from './analyticsService';

// ==========================================
// 📌 진단 유틸리티
// ==========================================

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

// ==========================================
// 📌 타입 정의
// ==========================================

type BannerShowStatus = 'idle' | 'showing' | 'failed';

interface BannerShowOptions {
  bottomMarginPx?: number;
}

type BannerSizeListener = (heightPx: number) => void;

// ==========================================
// 📌 배너 광고 서비스
// ==========================================

class BannerAdService {
  private showStatus: BannerShowStatus = 'idle';
  private cleanupFn: (() => void) | null = null;
  private adUnitId: string = '';
  private bannerUsers = 0;
  // show/hide 레이스 방지용 직렬 큐
  private syncQueue: Promise<void> = Promise.resolve();
  private isAdMobListenersRegistered = false;
  private hasTrackedAdMobImpressionForCurrentBanner = false;
  private requestedBottomMarginPx = 0;
  private activeBottomMarginPx = 0;
  private bannerHeightPx = 0;
  private bannerSizeListeners = new Set<BannerSizeListener>();
  private readonly loadRetryBackoff = new RetryBackoffScheduler({
    baseDelayMs: 3000,
    maxDelayMs: 15000,
  });
  // 연속 실패 retry 제한
  private static readonly MAX_BANNER_RETRY_COUNT = 5;
  private bannerRetryCount = 0;
  // 진단 카운터 (AdMob 배너 문제 디버깅용)
  private diagShowRequestSeq = 0;
  private diagSyncSeq = 0;
  private diagAdMobLoadSeq = 0;
  private diagRetrySeq = 0;
  private diagHideSeq = 0;
  private readonly handleConsentUpdated = (event: Event): void => {
    const detail = event instanceof CustomEvent
      ? (event.detail as { canRequestAds?: boolean } | null)
      : null;
    const canRequestAds = detail?.canRequestAds;

    if (canRequestAds === false) {
      this.hideCurrentBanner()
        .catch((error) => {
          console.error('[BannerAdService] 동의 철회 후 배너 숨김 실패:', error);
        })
        .finally(() => {
          if (this.bannerUsers > 0) {
            this.showStatus = 'failed';
          }
        });
      return;
    }

    if (canRequestAds !== true || this.bannerUsers <= 0) return;

    this.enqueueSync().catch((error) => {
      console.error('[BannerAdService] 동의 갱신 후 배너 복구 실패:', error);
    });
  };

  constructor() {
    this.adUnitId = getBannerAdId();

    if (import.meta.env.DEV) {
      console.log('[BannerAdService] 초기화');
      console.log('[BannerAdService] 플랫폼:', CURRENT_AD_PLATFORM);
      console.log('[BannerAdService] 광고 ID:', this.adUnitId);
      console.log('[BannerAdService] 지원 여부:', isBannerAdSupported());
    }

    if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
      this.setupAdMobBannerListeners();
      if (typeof window !== 'undefined') {
        window.addEventListener(AD_MOB_CONSENT_UPDATED_EVENT, this.handleConsentUpdated);
      }
    }
  }

  // ==========================================
  // 📌 배너 광고 표시
  // ==========================================

  public async showBanner(options: BannerShowOptions = {}): Promise<void> {
    // 1. 플랫폼 지원 체크
    if (!isBannerAdSupported()) {
      console.warn('[BannerAdService] 플랫폼 미지원:', CURRENT_AD_PLATFORM);
      return;
    }

    this.diagShowRequestSeq++;
    this.bannerRetryCount = 0;
    console.log(`[AdMobBannerDiag] showBanner requested seq=${this.diagShowRequestSeq} usersBefore=${this.bannerUsers} margin=${options.bottomMarginPx ?? 0} platform=${CURRENT_AD_PLATFORM} status=${this.showStatus}`);

    this.requestedBottomMarginPx = this.normalizeBottomMarginPx(options.bottomMarginPx);

    // 2. 참조 카운트 (여러 컴포넌트에서 호출될 수 있음)
    this.bannerUsers += 1;
    if (import.meta.env.DEV) {
      console.log('[BannerAdService] show 요청, 사용자 수:', this.bannerUsers);
    }

    // 3. 실제 show/hide는 큐에서 직렬 처리
    await this.enqueueSync();
  }

  /**
   * 앱인토스 배너 광고 표시
   */
  private async showAppsInTossBanner(bottomMarginPx: number): Promise<void> {
    if (!GoogleAdMob.showAppsInTossAdMob.isSupported()) {
      console.warn('[BannerAdService] GoogleAdMob 미지원');
      this.showStatus = 'failed';
      return;
    }

    console.log('[BannerAdService] 앱인토스 배너 표시 시작');

    this.cleanupFn = GoogleAdMob.showAppsInTossAdMob({
      options: {
        adGroupId: this.adUnitId,
        // 배너 위치 설정 (하단 고정)
        // @ts-ignore - 앱인토스 SDK 타입 정의에 position/margin이 없을 수 있음
        position: 'bottom',
        // @ts-ignore - 일부 런타임에서 margin을 지원할 수 있어 best-effort로 전달
        margin: bottomMarginPx,
      },
      onEvent: (event) => {
        switch (event.type) {
          case 'show':
            this.showStatus = 'showing';
            this.bannerRetryCount = 0;
            this.loadRetryBackoff.reset();
            if (this.bannerHeightPx <= 0) this.setBannerHeightPx(50);
            console.log('[BannerAdService] 배너 표시 완료');
            break;

          case 'impression':
            console.log('[BannerAdService] 배너 노출');
            trackAnalyticsEvent({
              name: 'ad_banner_impression',
              meta: { source: 'apps-in-toss' },
            });
            break;

          case 'clicked':
            console.log('[BannerAdService] 배너 클릭');
            trackAnalyticsEvent({
              name: 'ad_banner_click',
              meta: { source: 'apps-in-toss' },
            });
            break;

          case 'dismissed':
            this.showStatus = 'idle';
            this.setBannerHeightPx(0);
            console.log('[BannerAdService] 배너 닫힘');
            break;

          case 'failedToShow':
            this.showStatus = 'failed';
            this.setBannerHeightPx(0);
            console.error('[BannerAdService] 배너 표시 실패');
            this.scheduleLoadRetry();
            break;
        }
      },
      onError: (error) => {
        this.showStatus = 'failed';
        this.setBannerHeightPx(0);
        console.error('[BannerAdService] 앱인토스 배너 에러:', error);
        this.scheduleLoadRetry();
      },
    });

    // 앱인토스는 이벤트 콜백 전에 hide 요청이 들어올 수 있어
    // cleanup 함수 확보 시점에 표시 상태로 취급한다.
    this.showStatus = 'showing';
  }

  /**
   * AdMob 배너 광고 표시 (iOS/Android)
   */
  private async showAdMobBanner(bottomMarginPx: number): Promise<void> {
    console.log('[BannerAdService] AdMob 배너 표시 시작');

    const requestPolicy = await getAdMobRequestPolicy();
    const effectiveAdId = requestPolicy.shouldUseTestAds
      ? this.getAdMobTestBannerAdId()
      : this.adUnitId;

    const options: BannerAdOptions = {
      adId: effectiveAdId,
      isTesting: requestPolicy.shouldUseTestAds,
      adSize: BannerAdSize.BANNER, // 표준 배너 (320x50)
      position: BannerAdPosition.BOTTOM_CENTER, // 하단 중앙 고정
      margin: bottomMarginPx,
    };

    try {
      this.diagAdMobLoadSeq++;
      console.log(`[AdMobBannerDiag] AdMob.showBanner loadSeq=${this.diagAdMobLoadSeq} adId=${effectiveAdId} isTesting=${requestPolicy.shouldUseTestAds} size=${options.adSize} margin=${bottomMarginPx} users=${this.bannerUsers} status=${this.showStatus}`);
      await AdMob.showBanner(options);
      this.showStatus = 'showing';
      if (this.bannerHeightPx <= 0) this.setBannerHeightPx(50);
      if (!this.hasTrackedAdMobImpressionForCurrentBanner) {
        trackAnalyticsEvent({
          name: 'ad_banner_impression',
          meta: { source: 'admob-show-fallback', testAds: requestPolicy.shouldUseTestAds },
        });
        this.hasTrackedAdMobImpressionForCurrentBanner = true;
      }
      console.log('[BannerAdService] AdMob 배너 표시 완료');
    } catch (error) {
      this.showStatus = 'failed';
      console.error('[BannerAdService] AdMob 배너 표시 실패:', error);
      throw error;
    }
  }

  private getAdMobTestBannerAdId(): string {
    if (CURRENT_AD_PLATFORM === 'admob-ios') return ADMOB_TEST_AD_IDS.IOS.BANNER;
    return ADMOB_TEST_AD_IDS.ANDROID.BANNER;
  }

  private setupAdMobBannerListeners(): void {
    if (this.isAdMobListenersRegistered) return;
    this.isAdMobListenersRegistered = true;

    AdMob.addListener(BannerAdPluginEvents.AdImpression, () => {
      if (this.hasTrackedAdMobImpressionForCurrentBanner) return;
      trackAnalyticsEvent({
        name: 'ad_banner_impression',
        meta: { source: 'admob' },
      });
      this.hasTrackedAdMobImpressionForCurrentBanner = true;
    });

    AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
      this.showStatus = 'showing';
      this.bannerRetryCount = 0;
      this.loadRetryBackoff.reset();
      console.log(`[AdMobBannerDiag] Loaded users=${this.bannerUsers} status=${this.showStatus} margin=${this.activeBottomMarginPx} height=${this.bannerHeightPx}`);
    });

    AdMob.addListener(BannerAdPluginEvents.Opened, () => {
      trackAnalyticsEvent({
        name: 'ad_banner_click',
        meta: { source: 'admob' },
      });
    });

    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info: unknown) => {
      const height = typeof info === 'object' && info !== null
        ? (info as { height?: unknown }).height
        : 0;
      this.setBannerHeightPx(height);
    });

    AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
      this.showStatus = 'failed';
      this.setBannerHeightPx(0);
      console.error(`[AdMobBannerDiag] FailedToLoad users=${this.bannerUsers} status=${this.showStatus} margin=${this.activeBottomMarginPx} error=${safeStringify(error)}`);
      console.error('[AdMobBannerDiag] FailedToLoad raw:', error);
      this.scheduleLoadRetry();
    });
  }

  // ==========================================
  // 📌 배너 광고 숨기기
  // ==========================================

  public async hideBanner(): Promise<void> {
    this.bannerUsers = Math.max(0, this.bannerUsers - 1);
    this.diagHideSeq++;
    console.log(`[AdMobBannerDiag] hideBanner requested seq=${this.diagHideSeq} usersAfter=${this.bannerUsers} status=${this.showStatus}`);
    if (import.meta.env.DEV) {
      console.log('[BannerAdService] hide 요청, 사용자 수:', this.bannerUsers);
    }

    await this.enqueueSync();
  }

  // ==========================================
  // 📌 리소스 정리
  // ==========================================

  public cleanup(): void {
    console.log('[BannerAdService] 리소스 정리 시작');

    this.bannerUsers = 0;
    this.loadRetryBackoff.reset();

    // 배너 숨기기 (큐 직렬 처리)
    this.enqueueSync().catch((error) => {
      console.error('[BannerAdService] cleanup 중 hideBanner 실패:', error);
    });

    console.log('[BannerAdService] 리소스 정리 완료');
  }

  // ==========================================
  // 📌 상태 조회
  // ==========================================

  public isShowing(): boolean {
    return this.showStatus === 'showing';
  }

  public getStatus(): BannerShowStatus {
    return this.showStatus;
  }

  public getCurrentBannerHeightPx(): number {
    return this.bannerHeightPx;
  }

  public onBannerSizeChange(listener: BannerSizeListener): () => void {
    this.bannerSizeListeners.add(listener);
    listener(this.bannerHeightPx);
    return () => {
      this.bannerSizeListeners.delete(listener);
    };
  }

  private enqueueSync(): Promise<void> {
    this.syncQueue = this.syncQueue
      .catch(() => undefined)
      .then(() => this.syncBannerVisibility());
    return this.syncQueue;
  }

  private async syncBannerVisibility(): Promise<void> {
    const shouldShow = this.bannerUsers > 0;
    const targetBottomMarginPx = shouldShow ? this.requestedBottomMarginPx : 0;

    this.diagSyncSeq++;
    console.log(`[AdMobBannerDiag] syncBannerVisibility seq=${this.diagSyncSeq} shouldShow=${shouldShow} targetMargin=${targetBottomMarginPx} activeMargin=${this.activeBottomMarginPx} status=${this.showStatus} users=${this.bannerUsers}`);

    if (shouldShow) {
      if (this.showStatus === 'showing') {
        if (this.activeBottomMarginPx === targetBottomMarginPx) return;
        await this.hideCurrentBanner();
      }

      if (!this.adUnitId) {
        console.error('[BannerAdService] 광고 ID 없음');
        this.showStatus = 'failed';
        return;
      }

      try {
        if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
          await this.showAppsInTossBanner(targetBottomMarginPx);
        } else if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
          const canRequest = await ensureAdMobReady();
          if (!canRequest) {
            this.showStatus = 'failed';
            this.setBannerHeightPx(0);
            return;
          }
          await this.showAdMobBanner(targetBottomMarginPx);
        }
        this.activeBottomMarginPx = targetBottomMarginPx;
        // AdSense는 AdBanner.tsx에서 직접 처리 (SSR/CSR 호환성 때문)
      } catch (error) {
        console.error('[BannerAdService] 배너 표시 실패:', error);
        this.showStatus = 'failed';
        this.scheduleLoadRetry();
      }
      return;
    }

    await this.hideCurrentBanner();
  }

  private normalizeBottomMarginPx(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
  }

  private normalizeBannerHeightPx(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
  }

  private setBannerHeightPx(value: unknown): void {
    const next = this.normalizeBannerHeightPx(value);
    if (next === this.bannerHeightPx) return;
    this.bannerHeightPx = next;
    this.bannerSizeListeners.forEach((listener) => {
      try {
        listener(next);
      } catch {
        // Listener 오류는 서비스 동작을 중단시키지 않는다.
      }
    });
  }

  private scheduleLoadRetry(): void {
    if (this.bannerUsers <= 0) {
      console.log(`[AdMobBannerDiag] scheduleLoadRetry skip (no users) users=${this.bannerUsers}`);
      return;
    }

    this.diagRetrySeq++;
    console.log(`[AdMobBannerDiag] scheduleLoadRetry scheduled seq=${this.diagRetrySeq} users=${this.bannerUsers} status=${this.showStatus}`);
    this.loadRetryBackoff.schedule(() => {
      if (this.bannerUsers <= 0 || this.showStatus !== 'failed') {
        console.log(`[AdMobBannerDiag] scheduleLoadRetry fire skip users=${this.bannerUsers} status=${this.showStatus}`);
        return;
      }

      this.bannerRetryCount++;
      if (this.bannerRetryCount > BannerAdService.MAX_BANNER_RETRY_COUNT) {
        console.log(`[AdMobBannerDiag] scheduleLoadRetry max retries reached count=${this.bannerRetryCount}/${BannerAdService.MAX_BANNER_RETRY_COUNT}`);
        return;
      }

      console.log(`[AdMobBannerDiag] scheduleLoadRetry fire seq=${this.diagRetrySeq} users=${this.bannerUsers} status=${this.showStatus} retryCount=${this.bannerRetryCount}/${BannerAdService.MAX_BANNER_RETRY_COUNT}`);
      this.enqueueSync().catch((error) => {
        console.error('[BannerAdService] 배너 재시도 실패:', error);
      });
    });
  }

  private async hideCurrentBanner(): Promise<void> {
    if (this.showStatus !== 'showing') {
      this.showStatus = 'idle';
      this.activeBottomMarginPx = 0;
      this.setBannerHeightPx(0);
      this.loadRetryBackoff.clearPending();
      return;
    }

    console.log('[BannerAdService] 배너 숨기기 시작');

    try {
      if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
        // 앱인토스: cleanup 함수 호출
        this.cleanupFn?.();
        this.cleanupFn = null;
      } else if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
        // AdMob Android keeps the hidden view around after hideBanner().
        // Recreate instead, so menu/game margin changes cannot leave the banner GONE.
        console.log(`[AdMobBannerDiag] hideCurrentBanner calling removeBanner users=${this.bannerUsers} status=${this.showStatus} margin=${this.activeBottomMarginPx}`);
        await AdMob.removeBanner();
      }

      console.log('[BannerAdService] 배너 숨김 완료');
    } catch (error) {
      console.error('[BannerAdService] 배너 숨기기 실패:', error);
    } finally {
      this.showStatus = 'idle';
      this.hasTrackedAdMobImpressionForCurrentBanner = false;
      this.activeBottomMarginPx = 0;
      this.setBannerHeightPx(0);
      this.loadRetryBackoff.clearPending();
    }
  }
}

// ==========================================
// 📌 싱글톤 인스턴스 (rewardAdService와 동일한 패턴)
// ==========================================

export const bannerAdService = new BannerAdService();
