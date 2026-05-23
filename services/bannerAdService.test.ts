import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ==========================================
// Mock setup
// ==========================================

const { addListenerCallbacks } = vi.hoisted(() => ({
  addListenerCallbacks: {} as Record<string, (data?: unknown) => void>,
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    showBanner: vi.fn(),
    removeBanner: vi.fn(),
    addListener: vi.fn(
      (event: string, callback: (data?: unknown) => void) => {
        addListenerCallbacks[event] = callback;
        return { remove: vi.fn() };
      },
    ),
  },
  BannerAdPosition: { BOTTOM_CENTER: 'bottomCenter' },
  BannerAdSize: { BANNER: 'BANNER' },
  BannerAdPluginEvents: {
    AdImpression: 'admob.ad.impression',
    Loaded: 'admob.banner.loaded',
    Opened: 'admob.banner.opened',
    SizeChanged: 'admob.banner.sizeChanged',
    FailedToLoad: 'admob.banner.failedToLoad',
  },
}));

vi.mock('./adConfig', () => ({
  CURRENT_AD_PLATFORM: 'admob-android',
  getBannerAdId: () => 'test-banner-id',
  isBannerAdSupported: () => true,
  ADMOB_TEST_AD_IDS: {
    IOS: { BANNER: 'ios-test-banner' },
    ANDROID: { BANNER: 'android-test-banner' },
  },
}));

vi.mock('./admob', () => ({
  ensureAdMobReady: () => Promise.resolve(true),
  getAdMobRequestPolicy: () => Promise.resolve({ shouldUseTestAds: true }),
  AD_MOB_CONSENT_UPDATED_EVENT: 'slidemino:admob-consent-updated',
}));

vi.mock('./analyticsService', () => ({
  trackAnalyticsEvent: vi.fn(),
}));

// ==========================================
// Tests
// ==========================================

describe('BannerAdService retry behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.keys(addListenerCallbacks).forEach(
      (key) => delete addListenerCallbacks[key],
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops retrying banner load after reaching max retry attempts', async () => {
    vi.useFakeTimers();

    const { AdMob } = await import('@capacitor-community/admob');
    vi.mocked(AdMob.showBanner).mockRejectedValue(
      new Error('Ad failed to load'),
    );

    const { bannerAdService } = await import('./bannerAdService');

    // Start showing banner — this will fail and schedule a retry
    bannerAdService.showBanner();

    // Advance time enough for multiple retry cycles.
    // Backoff schedule: ~3s, ~6s, ~12s, ~15s, ~15s, ...
    // 100s is enough for ~8 retries.
    await vi.advanceTimersByTimeAsync(100_000);

    const totalCalls = vi.mocked(AdMob.showBanner).mock.calls.length;

    // RED: currently there is NO max retry limit, so this assertion FAILS.
    // Expected after fix: retries stop after a reasonable max (e.g. 5).
    expect(totalCalls).toBeLessThanOrEqual(6);
  });
});