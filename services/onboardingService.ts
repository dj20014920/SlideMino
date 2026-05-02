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
 * 점수 기반 온보딩 안내 (기능 잠금 없음, 안내만):
 * - 50점 도달 → 스킨 안내
 * - 70점 도달 → 이벤트모드 안내
 * - 100점 도달 → 랭킹 안내
 *
 * localStorage 기반. 한번 해금된 기능은 영구적.
 */

import { loadXpData } from './xpLevelService';

const STORAGE_KEY = 'slidemino.onboarding.v1';
const SCORE_ONBOARDING_STORAGE_KEY = 'slidemino.score_onboarding.v1';

/** 점수 기반 온보딩 단계 */
export type ScoreOnboardingStep = 'skin' | 'weekly_event' | 'ranking';

/** 점수 기준: 각 단계별 최소 점수 */
export const SCORE_ONBOARDING_THRESHOLDS: Record<ScoreOnboardingStep, number> = {
  skin: 50,
  weekly_event: 70,
  ranking: 100,
};

/** 점수 기준 오름차순 순서 */
export const SCORE_ONBOARDING_ORDER: ScoreOnboardingStep[] = ['skin', 'weekly_event', 'ranking'];

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
  streak: { gamesCompleted: 1 },
  daily_mission: { gamesCompleted: 3 },
  daily_challenge: { gamesCompleted: 5 },
  weekly_event: { gamesCompleted: 10 },
  share_card: { level: 3 },
  calendar: { level: 5 },
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

/**
 * 특정 기능이 해금되었는지 확인 — 온보딩 해금 비활성화: 모든 기능 항상 해금
 *
 * @todo 온보딩 시스템 의도적 비활성화 상태. 점진적 해금을 재활성화하려면
 *       아래 주석 처리된 원래 로직(gamesCompleted / hasExistingGameData 기반)을 복원할 것.
 */
export function isFeatureUnlocked(_featureId: FeatureId): boolean {
  return true;
  // --- 아래는 향후 점진적 해금을 재활성화할 때 사용 ---
  // const data = loadData();
  // if (data.gamesCompleted === 0 && hasExistingGameData()) return true;
  // return data.unlockedFeatures.includes(featureId);
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

// ====== 점수 기반 온보딩 안내 (기능 잠금 없음) ======

interface ScoreOnboardingData {
  seenSteps: string[];
}

function loadScoreOnboardingData(): ScoreOnboardingData {
  try {
    const raw = localStorage.getItem(SCORE_ONBOARDING_STORAGE_KEY);
    if (!raw) return { seenSteps: [] };
    const parsed = JSON.parse(raw);
    return {
      seenSteps: Array.isArray(parsed.seenSteps) ? parsed.seenSteps : [],
    };
  } catch {
    return { seenSteps: [] };
  }
}

function saveScoreOnboardingData(data: ScoreOnboardingData): void {
  try {
    localStorage.setItem(SCORE_ONBOARDING_STORAGE_KEY, JSON.stringify(data));
  } catch { /* 무시 */ }
}

/** 이미 본 점수 기반 온보딩 단계 목록 */
export function getSeenScoreOnboardingSteps(): string[] {
  return loadScoreOnboardingData().seenSteps;
}

/**
 * 현재 점수에 따라 표시할 온보딩 단계를 반환.
 * 이미 본 단계는 건너뛰고, 점수 기준을 충족하는 가장 낮은 단계를 반환.
 * 표시할 단계가 없으면 null.
 */
export function shouldShowOnboardingForScore(score: number): ScoreOnboardingStep | null {
  const data = loadScoreOnboardingData();
  for (const step of SCORE_ONBOARDING_ORDER) {
    if (data.seenSteps.includes(step)) continue;
    if (score >= SCORE_ONBOARDING_THRESHOLDS[step]) {
      return step;
    }
  }
  return null;
}

/** 점수 기반 온보딩 단계를 본 것으로 기록 */
export function markScoreOnboardingStepSeen(step: ScoreOnboardingStep): void {
  const data = loadScoreOnboardingData();
  if (!data.seenSteps.includes(step)) {
    data.seenSteps.push(step);
    saveScoreOnboardingData(data);
  }
}

/** 점수 기반 온보딩 초기화 (튜토리얼 리셋 시) */
export function clearScoreOnboardingProgress(): void {
  try {
    localStorage.removeItem(SCORE_ONBOARDING_STORAGE_KEY);
  } catch { /* 무시 */ }
}
