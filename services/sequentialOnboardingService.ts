/**
 * 순차 인터랙티브 온보딩 서비스
 *
 * 50점 스킨 보상 수령 후, 3개 기능을 순서대로
 * "스포트라이트 + 한줄요약 + 지금열기 + 탭하여 넘어감" 방식으로 소개.
 *
 * localStorage 기반. 한번 완료된 시퀀스는 다시 표시 안 함.
 */

const STORAGE_KEY = 'slidemino.seq_onboarding.v1';

/** 순차 온보딩 단계 */
export type SequentialStep =
  | 'leaderboard'
  | 'daily_activities'
  | 'game_resume';

/** 단계별 타겟 셀렉터와 텍스트 키 */
export interface SequentialStepConfig {
  selector: string;
  textKey: string;
  fallbackText: string;
}

/** 실행 순서 */
export const SEQUENTIAL_STEPS: SequentialStep[] = [
  'leaderboard',
  'daily_activities',
  'game_resume',
];

export const SEQUENTIAL_STEP_CONFIG: Record<SequentialStep, SequentialStepConfig> = {
  leaderboard: {
    selector: '#leaderboard-btn, [data-tutorial-anchor="leaderboard-btn"]',
    textKey: 'game:onboarding.sequential.leaderboard',
    fallbackText: 'Check rankings and try weekly events',
  },
  daily_activities: {
    selector: '#mission-nav-btn, [data-tutorial-anchor="mission-nav-btn"]',
    textKey: 'game:onboarding.sequential.dailyActivities',
    fallbackText: 'Complete missions, check attendance, and level up',
  },
  game_resume: {
    selector: '#continue-btn',
    textKey: 'game:onboarding.sequential.gameResume',
    fallbackText: 'Use the ▶ button to resume your game',
  },
};

// ====== 데이터 타입 ======

interface SequentialOnboardingData {
  version: 1;
  started: boolean;
  completed: boolean;
  stepIndex: number;
}

const DEFAULT_DATA: SequentialOnboardingData = {
  version: 1,
  started: false,
  completed: false,
  stepIndex: 0,
};

// ====== 저장/로드 ======

function loadData(): SequentialOnboardingData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw);
    // 현재는 v1만 존재하므로 버전 불일치 시 초기화로 충분.
    // 향후 v2+ 스키마 변경 시 버전별 마이그레이션 함수를 추가해야 함.
    if (!parsed || parsed.version !== 1) return { ...DEFAULT_DATA };
    const completed = typeof parsed.completed === 'boolean' ? parsed.completed : false;
    return {
      version: 1,
      started:
        typeof parsed.started === 'boolean'
          ? parsed.started
          : completed || (typeof parsed.stepIndex === 'number' && parsed.stepIndex > 0),
      completed,
      stepIndex:
        typeof parsed.stepIndex === 'number'
          ? Math.max(0, Math.min(parsed.stepIndex, SEQUENTIAL_STEPS.length))
          : 0,
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

function saveData(data: SequentialOnboardingData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* 무시 */ }
}

// ====== 공개 API ======

/** 온보딩 시퀀스가 이미 완료되었는지 */
export function isSequentialOnboardingCompleted(): boolean {
  return loadData().completed;
}

/** 순차 온보딩 시작 (스킨 모달 닫힘 시 호출) */
export function startSequentialOnboarding(): void {
  const data = loadData();
  if (data.completed || data.started) return;
  saveData({ version: 1, started: true, completed: false, stepIndex: 0 });
}

/** 현재 표시할 단계. null이면 완료 */
export function getCurrentSequentialStep(): SequentialStep | null {
  const data = loadData();
  if (!data.started || data.completed) return null;
  if (data.stepIndex < 0 || data.stepIndex >= SEQUENTIAL_STEPS.length) return null;
  return SEQUENTIAL_STEPS[data.stepIndex];
}

/** 다음 단계로 진행. 완료 시 null 반환 */
export function advanceSequentialStep(): SequentialStep | null {
  const data = loadData();
  if (!data.started || data.completed) return null;
  const nextIndex = data.stepIndex + 1;
  if (nextIndex >= SEQUENTIAL_STEPS.length) {
    saveData({ ...data, started: true, completed: true, stepIndex: SEQUENTIAL_STEPS.length });
    return null;
  }
  const newData = { ...data, started: true, stepIndex: nextIndex };
  saveData(newData);
  return SEQUENTIAL_STEPS[nextIndex];
}

/** 현재 단계의 설정 정보 반환 */
export function getSequentialStepConfig(step: SequentialStep): SequentialStepConfig {
  return SEQUENTIAL_STEP_CONFIG[step];
}

/** 온보딩 시퀀스 리셋 (디버그/테스트용) */
export function resetSequentialOnboarding(): void {
  saveData({ ...DEFAULT_DATA });
}
