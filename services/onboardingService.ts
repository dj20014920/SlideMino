/**
 * 점수 기반 온보딩 안내 서비스
 *
 * 점수 기준 충족 시 기능 안내 오버레이를 표시.
 * 기능 잠금은 없으며 안내만 제공.
 *
 * 점수 기준:
 * - 50점 도달 → 스킨 안내 (보상 모달)
 *
 * localStorage 기반. 한번 본 안내는 다시 표시 안 함.
 */

/** 점수 기반 온보딩 단계 */
export type ScoreOnboardingStep = 'skin';

/** 점수 기준: 각 단계별 최소 점수 */
export const SCORE_ONBOARDING_THRESHOLDS: Record<ScoreOnboardingStep, number> = {
  skin: 50,
};

/** 점수 기준 오름차순 순서 */
export const SCORE_ONBOARDING_ORDER: ScoreOnboardingStep[] = ['skin'];

// ====== 점수 기반 온보딩 안내 ======

interface ScoreOnboardingData {
  seenSteps: string[];
}

const SCORE_ONBOARDING_STORAGE_KEY = 'slidemino.score_onboarding.v1';

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
 * 이미 본 단계는 건너뛴다.
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