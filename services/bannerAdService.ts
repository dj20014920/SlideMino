/**
 * 배너 광고 서비스 (중앙집중형 설계)
 * - 리워드 광고(rewardAdService)와 동일한 아키텍처 패턴 적용
 * - 멀티 플랫폼 지원 (Apps-in-Toss, AdMob iOS/Android, AdSense)
 * - 중복 표시 방지 및 리소스 관리
 */

import { GoogleAdMob } from '@apps-in-toss/web-framework';
import { AdMob, BannerAdPosition, BannerAdSize, BannerAdOptions } from '@capacitor-community/admob';
import { getBannerAdId, isBannerAdSupported, CURRENT_AD_PLATFORM } from './adConfig';
import { ensureAdMobReady, isVirtualDevice } from './admob';

// ==========================================
// 📌 타입 정의
// ==========================================

type BannerShowStatus = 'idle' | 'showing' | 'failed';

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

  constructor() {
    this.adUnitId = getBannerAdId();

    if (import.meta.env.DEV) {
      console.log('[BannerAdService] 초기화');
      console.log('[BannerAdService] 플랫폼:', CURRENT_AD_PLATFORM);
      console.log('[BannerAdService] 광고 ID:', this.adUnitId);
      console.log('[BannerAdService] 지원 여부:', isBannerAdSupported());
    }
  }

  // ==========================================
  // 📌 배너 광고 표시
  // ==========================================

  public async showBanner(): Promise<void> {
    // 1. 플랫폼 지원 체크
    if (!isBannerAdSupported()) {
      console.warn('[BannerAdService] 플랫폼 미지원:', CURRENT_AD_PLATFORM);
      return;
    }

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
  private async showAppsInTossBanner(): Promise<void> {
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
        // @ts-expect-error - 앱인토스 SDK 타입 정의에 position이 없을 수 있음
        position: 'bottom',
      },
      onEvent: (event) => {
        switch (event.type) {
          case 'show':
            this.showStatus = 'showing';
            console.log('[BannerAdService] 배너 표시 완료');
            break;

          case 'impression':
            console.log('[BannerAdService] 배너 노출');
            break;

          case 'clicked':
            console.log('[BannerAdService] 배너 클릭');
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
  private async showAdMobBanner(): Promise<void> {
    console.log('[BannerAdService] AdMob 배너 표시 시작');

    const isVirtual = await isVirtualDevice();
    const shouldUseTestAds = import.meta.env.MODE !== 'production' || isVirtual;

    const options: BannerAdOptions = {
      adId: this.adUnitId,
      adSize: BannerAdSize.BANNER, // 표준 배너 (320x50)
      position: BannerAdPosition.BOTTOM_CENTER, // 하단 중앙 고정
      margin: 0,
      isTesting: shouldUseTestAds, // 에뮬레이터/개발 모드 테스트 광고
    };

    try {
      await AdMob.showBanner(options);
      this.showStatus = 'showing';
      console.log('[BannerAdService] AdMob 배너 표시 완료');
    } catch (error) {
      this.showStatus = 'failed';
      console.error('[BannerAdService] AdMob 배너 표시 실패:', error);
      throw error;
    }
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

    if (shouldShow) {
      if (this.showStatus === 'showing') return;

      if (!this.adUnitId) {
        console.error('[BannerAdService] 광고 ID 없음');
        this.showStatus = 'failed';
        return;
      }

      try {
        if (CURRENT_AD_PLATFORM === 'apps-in-toss') {
          await this.showAppsInTossBanner();
        } else if (CURRENT_AD_PLATFORM === 'admob-ios' || CURRENT_AD_PLATFORM === 'admob-android') {
          const canRequest = await ensureAdMobReady();
          if (!canRequest) {
            this.showStatus = 'failed';
            return;
          }
          await this.showAdMobBanner();
        }
        // AdSense는 AdBanner.tsx에서 직접 처리 (SSR/CSR 호환성 때문)
      } catch (error) {
        console.error('[BannerAdService] 배너 표시 실패:', error);
        this.showStatus = 'failed';
      }
      return;
    }

    if (this.showStatus !== 'showing') {
      this.showStatus = 'idle';
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
    }
  }
}

// ==========================================
// 📌 싱글톤 인스턴스 (rewardAdService와 동일한 패턴)
// ==========================================

export const bannerAdService = new BannerAdService();
