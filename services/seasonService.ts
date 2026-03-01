/**
 * 시즌 서비스 (클라이언트)
 * - 시즌 경계 계산 (서버와 동일 로직)
 * - 시즌 카운트다운
 * - 보상 확인/수령 API 호출
 */

import { isNativeApp } from '../utils/platform';
import { BASE_URL, KST_OFFSET_MS } from '../config/constants';
import { getAnalyticsInstallId } from './analyticsService';
import { loadSkinSettings, saveSkinSettings } from './skinService';
import { updateServerTimeOffset, getServerAdjustedNow } from './serverTimeService';

const API_BASE_URL = (() => {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!fromEnv) return BASE_URL;
  return fromEnv.replace(/\/+$/, '');
})();

const getApiUrl = (path: string): string => {
  if (isNativeApp()) return `${API_BASE_URL}${path}`;
  return path;
};

// ====== 시즌 보상 타입 ======
export interface SeasonReward {
  season_id: string;
  difficulty: string;
  reward_type: string;   // 'top1' | 'top2' | 'top3' | 'participant'
  fragment_amount: number;
}

export interface SeasonInfo {
  seasonId: string;
  endsAt: number; // ms timestamp
}

export interface SeasonCountdown {
  days: number;
  hours: number;
  minutes: number;
  isUrgent: boolean; // 24시간 이내
  totalMs: number;
}

// ====== 시즌 경계 계산 (서버 seasonReset.ts와 동일 로직) ======
function getKstDate(now: Date): { year: number; month: number; day: number } {
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  };
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getSeasonBoundaries(now: Date = getServerAdjustedNow()): {
  seasonId: string;
  seasonStartMs: number;
  seasonEndMs: number;
} {
  const { year, month, day } = getKstDate(now);
  const lastDay = getLastDayOfMonth(year, month);

  let startDay: number;
  let endDay: number;
  if (day <= 15) {
    startDay = 1;
    endDay = 15;
  } else {
    startDay = 16;
    endDay = lastDay;
  }

  const seasonStartMs = Date.UTC(year, month - 1, startDay) - KST_OFFSET_MS;
  const seasonEndMs = Date.UTC(year, month - 1, endDay, 23, 59, 59, 999) - KST_OFFSET_MS;
  const seasonId = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  return { seasonId, seasonStartMs, seasonEndMs };
}

/** 시즌 종료까지 남은 시간 */
export function getSeasonCountdown(now: Date = getServerAdjustedNow()): SeasonCountdown {
  const { seasonEndMs } = getSeasonBoundaries(now);
  const totalMs = Math.max(0, seasonEndMs - now.getTime());

  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return {
    days,
    hours,
    minutes,
    isUrgent: totalMs < 24 * 60 * 60 * 1000,
    totalMs,
  };
}

// ====== 보상 API ======

/** 미수령 시즌 보상 확인 */
export async function checkSeasonRewards(): Promise<{
  rewards: SeasonReward[];
  seasonInfo: SeasonInfo | null;
}> {
  try {
    const installId = getAnalyticsInstallId();
    if (!installId) return { rewards: [], seasonInfo: null };

    const url = new URL(getApiUrl('/api/season-rewards/check'), window.location.origin);
    url.searchParams.set('installId', installId);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    updateServerTimeOffset(response);
    if (!response.ok) return { rewards: [], seasonInfo: null };

    const data = await response.json() as {
      rewards?: SeasonReward[];
      seasonInfo?: { seasonId?: string; endsAt?: number };
    };

    return {
      rewards: Array.isArray(data.rewards) ? data.rewards : [],
      seasonInfo: data.seasonInfo?.seasonId
        ? { seasonId: data.seasonInfo.seasonId, endsAt: data.seasonInfo.endsAt ?? 0 }
        : null,
    };
  } catch {
    return { rewards: [], seasonInfo: null };
  }
}

/** 시즌 보상 수령 (조각을 스킨 설정에 추가) */
export async function claimSeasonReward(
  seasonId: string,
  difficulty: string
): Promise<{ success: boolean; fragmentAmount: number }> {
  try {
    const installId = getAnalyticsInstallId();
    if (!installId) return { success: false, fragmentAmount: 0 };

    const response = await fetch(getApiUrl('/api/season-rewards/claim'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId, seasonId, difficulty }),
    });

    if (!response.ok) return { success: false, fragmentAmount: 0 };

    const data = await response.json() as {
      success?: boolean;
      fragmentAmount?: number;
    };

    const fragments = data.fragmentAmount ?? 0;

    // 로컬 스킨 설정에 조각 추가
    if (fragments > 0) {
      const settings = loadSkinSettings();
      settings.fragments += fragments;
      saveSkinSettings(settings);
    }

    return { success: true, fragmentAmount: fragments };
  } catch {
    return { success: false, fragmentAmount: 0 };
  }
}

/** 모든 미수령 보상을 일괄 수령 */
export async function claimAllSeasonRewards(rewards: SeasonReward[]): Promise<number> {
  let totalFragments = 0;
  for (const reward of rewards) {
    const result = await claimSeasonReward(reward.season_id, reward.difficulty);
    totalFragments += result.fragmentAmount;
  }
  return totalFragments;
}
