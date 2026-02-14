/**
 * 블록 새로고침 보상형 전면 광고 서비스
 */

import { MAX_DAILY_BLOCK_REFRESH_AD_VIEWS } from '../constants';
import {
  getBlockRefreshRewardInterstitialAdId,
  isBlockRefreshRewardInterstitialAdSupported,
} from './adConfig';
import { RewardInterstitialAdService } from './rewardInterstitialAdService';

export const blockRefreshRewardInterstitialAdService = new RewardInterstitialAdService({
  adUnitId: getBlockRefreshRewardInterstitialAdId(),
  isSupported: isBlockRefreshRewardInterstitialAdSupported,
  maxDailyViews: MAX_DAILY_BLOCK_REFRESH_AD_VIEWS,
  dailyStorageKey: 'slidemino_daily_block_refresh_ad_data',
  logTag: 'BlockRefreshRewardInterstitialAdService',
});
