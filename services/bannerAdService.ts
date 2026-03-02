/**
 * 배너 광고 서비스 (중앙집중형 설계)
 * - 리워드 광고(rewardAdService)와 동일한 아키텍처 패턴 적용
 * - 멀티 플랫폼 지원 (Apps-in-Toss, AdMob iOS/Android, AdSense)
 * - 중복 표시 방지 및 리소스 관리
 */

import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { AdMob, BannerAdPosition, BannerAdSize, BannerAdOptions, BannerAdPluginEvents } from '@capacitor-community/admob';
import { getBannerAdId, isBannerAdSupported, CURRENT_AD_PLATFORM } from './adConfig';
import { ensureAdMobReady } from './admob';
import { trackAnalyticsEvent } from './analyticsService';

// ==========================================
// 📌 타입 정의
// ==========================================

type BannerShowStatus = 'idle' | 'showing' | 'failed';

interface BannerShowOptions {
  bottomMarginPx?: number;
}

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
        // @ts-expect-error - 앱인토스 SDK 타입 정의에 position/margin이 없을 수 있음
        position: 'bottom',
        // @ts-expect-error - 일부 런타임에서 margin을 지원할 수 있어 best-effort로 전달
        margin: bottomMarginPx,
      },
      onEvent: (event) => {
        switch (event.type) {
          case 'show':
            this.showStatus = 'showing';
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
            console.log('[BannerAdService] 배너 닫힘');
            break;

          case 'failedToShow':
            this.showStatus = 'failed';
            console.error('[BannerAdService] 배너 표시 실패');
            break;
        }
      },
      onError: (error) => {
        this.showStatus = 'failed';
        console.error('[BannerAdService] 앱인토스 배너 에러:', error);
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

    const options: BannerAdOptions = {
      adId: this.adUnitId,
      adSize: BannerAdSize.BANNER, // 표준 배너 (320x50)
      position: BannerAdPosition.BOTTOM_CENTER, // 하단 중앙 고정
      margin: bottomMarginPx,
    };

    try {
      await AdMob.showBanner(options);
      this.showStatus = 'showing';
      if (!this.hasTrackedAdMobImpressionForCurrentBanner) {
        trackAnalyticsEvent({
          name: 'ad_banner_impression',
          meta: { source: 'admob-show-fallback' },
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

    AdMob.addListener(BannerAdPluginEvents.Opened, () => {
      trackAnalyticsEvent({
        name: 'ad_banner_click',
        meta: { source: 'admob' },
      });
    });
  }

  // ==========================================
  // 📌 배너 광고 숨기기
  // ==========================================

  public async hideBanner(): Promise<void> {
    this.bannerUsers = Math.max(0, this.bannerUsers - 1);
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

  private enqueueSync(): Promise<void> {
    this.syncQueue = this.syncQueue
      .catch(() => undefined)
      .then(() => this.syncBannerVisibility());
    return this.syncQueue;
  }

  private async syncBannerVisibility(): Promise<void> {
    const shouldShow = this.bannerUsers > 0;
    const targetBottomMarginPx = shouldShow ? this.requestedBottomMarginPx : 0;

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
            return;
          }
          await this.showAdMobBanner(targetBottomMarginPx);
        }
        this.activeBottomMarginPx = targetBottomMarginPx;
        // AdSense는 AdBanner.tsx에서 직접 처리 (SSR/CSR 호환성 때문)
      } catch (error) {
        console.error('[BannerAdService] 배너 표시 실패:', error);
        this.showStatus = 'failed';
      }
      return;
    }

    await this.hideCurrentBanner();
  }

  private normalizeBottomMarginPx(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
  }

  private async hideCurrentBanner(): Promise<void> {
    if (this.showStatus !== 'showing') {
      this.showStatus = 'idle';
      this.activeBottomMarginPx = 0;
      return;
    }

    console.log('[BannerAdService] 배너 숨기기 시작');

    try {
      if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
        // 앱인토스: cleanup 함수 호출
        this.cleanupFn?.();
        this.cleanupFn = null;
      } else if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
        // AdMob: hideBanner API 호출
        await AdMob.hideBanner();
      }

      console.log('[BannerAdService] 배너 숨김 완료');
    } catch (error) {
      console.error('[BannerAdService] 배너 숨기기 실패:', error);
    } finally {
      this.showStatus = 'idle';
      this.hasTrackedAdMobImpressionForCurrentBanner = false;
      this.activeBottomMarginPx = 0;
    }
  }
}

// ==========================================
// 📌 싱글톤 인스턴스 (rewardAdService와 동일한 패턴)
// ==========================================

export const bannerAdService = new BannerAdService();
