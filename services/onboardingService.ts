/**
 * 온보딩/기능 해금 서비스
 *
 * 신규 유저가 기능에 압도되지 않도록 점진적 해금:
 * - 첫 게임 완료 → 출석 시스템
 * - 3게임 완료 → 일일 미션
 * - 5게임 완료 → 데일리 챌린지
 * - 10게임 완료 → 주간 이벤트
 * - 레벨 3 도달 → 공유 카드
 * - 레벨 5 도달 → 캘린더 전체 표시
 *
 * localStorage 기반. 한번 해금된 기능은 영구적.
 */

import { loadXpData } from './xpLevelService';

const STORAGE_KEY = 'slidemino.onboarding.v1';

// ====== 기능 해금 조건 ======

export type FeatureId =
  | 'streak'           // 출석 시스템
  | 'daily_mission'    // 일일 미션
  | 'daily_challenge'  // 데일리 챌린지
  | 'weekly_event'     // 주간 이벤트
  | 'share_card'       // 공유 카드
  | 'calendar';        // 캘린더

interface UnlockCondition {
  gamesCompleted?: number;
  level?: number;
}

const UNLOCK_CONDITIONS: Record<FeatureId, UnlockCondition> = {
  streak:          { gamesCompleted: 1 },
  daily_mission:   { gamesCompleted: 3 },
  daily_challenge: { gamesCompleted: 5 },
  weekly_event:    { gamesCompleted: 10 },
  share_card:      { level: 3 },
  calendar:        { level: 5 },
};

// ====== 데이터 타입 ======

interface OnboardingData {
  version: 1;
  gamesCompleted: number;
  unlockedFeatures: string[];
  /** 해금 알림을 이미 본 기능들 */
  notifiedFeatures: string[];
}

const DEFAULT_DATA: OnboardingData = {
  version: 1,
  gamesCompleted: 0,
  unlockedFeatures: [],
  notifiedFeatures: [],
};

// ====== 저장/로드 ======

function loadData(): OnboardingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return { ...DEFAULT_DATA };
    return {
      version: 1,
      gamesCompleted: typeof parsed.gamesCompleted === 'number' ? Math.max(0, parsed.gamesCompleted) : 0,
      unlockedFeatures: Array.isArray(parsed.unlockedFeatures) ? parsed.unlockedFeatures : [],
      notifiedFeatures: Array.isArray(parsed.notifiedFeatures) ? parsed.notifiedFeatures : [],
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function saveData(data: OnboardingData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* 무시 */ }
}

// ====== 공개 API ======

/** 게임 완료 카운트 증가 + 해금 확인 */
export function recordGameCompleted(): string[] {
  const data = loadData();
  data.gamesCompleted += 1;
  const newlyUnlocked = checkAndUnlock(data);
  saveData(data);
  return newlyUnlocked;
}

/** 레벨업 후 해금 확인 */
export function checkLevelUnlocks(): string[] {
  const data = loadData();
  const newlyUnlocked = checkAndUnlock(data);
  saveData(data);
  return newlyUnlocked;
}

/** 특정 기능이 해금되었는지 확인 */
export function isFeatureUnlocked(featureId: FeatureId): boolean {
  const data = loadData();
  // 기존 유저(온보딩 데이터 없이 많이 플레이한)를 위한 폴백:
  // gamesCompleted가 0이고 다른 로컬 데이터가 있으면 모두 해금
  if (data.gamesCompleted === 0 && hasExistingGameData()) {
    return true;
  }
  return data.unlockedFeatures.includes(featureId);
}

/** 해금 알림을 아직 보지 않은 기능 목록 */
export function getUnnotifiedFeatures(): FeatureId[] {
  const data = loadData();
  return data.unlockedFeatures
    .filter(f => !data.notifiedFeatures.includes(f)) as FeatureId[];
}

/** 해금 알림 확인 처리 */
export function markFeatureNotified(featureId: FeatureId): void {
  const data = loadData();
  if (!data.notifiedFeatures.includes(featureId)) {
    data.notifiedFeatures.push(featureId);
    saveData(data);
  }
}

/** 완료된 게임 수 조회 */
export function getGamesCompletedCount(): number {
  return loadData().gamesCompleted;
}

// ====== 내부 로직 ======

/** 조건 확인 후 새로 해금된 기능 반환 */
function checkAndUnlock(data: OnboardingData): string[] {
  const xpData = loadXpData();
  const newlyUnlocked: string[] = [];

  for (const [featureId, condition] of Object.entries(UNLOCK_CONDITIONS)) {
    if (data.unlockedFeatures.includes(featureId)) continue;

    let met = true;
    if (condition.gamesCompleted !== undefined && data.gamesCompleted < condition.gamesCompleted) {
      met = false;
    }
    if (condition.level !== undefined && xpData.level < condition.level) {
      met = false;
    }

    if (met) {
      data.unlockedFeatures.push(featureId);
      newlyUnlocked.push(featureId);
    }
  }

  return newlyUnlocked;
}

/** 기존 유저인지 판단 (로컬 데이터 존재 여부) */
function hasExistingGameData(): boolean {
  try {
    // 스트릭이나 미션 데이터가 있으면 기존 유저
    return !!(
      localStorage.getItem('slidemino.streak.v1') ||
      localStorage.getItem('slidemino.missions.v1') ||
      localStorage.getItem('slidemino_game_state_v1')
    );
  } catch {
    return false;
  }
}
