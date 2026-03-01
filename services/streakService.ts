/**
 * 연속 출석 + 배지 서비스
 *
 * - 하루 100점 이상 획득 시 출석 인정 (KST 기준)
 * - 연속 출석 시 배지 마일스톤 + 스킨 조각 보상
 * - 3일마다 프리즈 1개 지급 (최대 보유 3개)
 * - 프리즈로 빠진 날 자동 보전 (설정에 따라 ON/OFF)
 */

import { loadSkinSettings, saveSkinSettings } from './skinService';
import { getServerAdjustedNow } from './serverTimeService';
import { KST_OFFSET_MS } from '../config/constants';

const STORAGE_KEY = 'slidemino.streak.v1';

// 출석 인정 최소 점수
const ATTENDANCE_MIN_SCORE = 100;
const MAX_FREEZE_COUNT = 3;
const FREEZE_GRANT_INTERVAL = 3; // 연속 출석 3일마다 프리즈 1개

// ====== 배지 마일스톤 ======
export interface BadgeMilestone {
  days: number;
  id: string;
  emoji: string;
  fragments: number;
  nameKey: string; // i18n key: 'badges.newbie' 등
}

export const BADGE_MILESTONES: readonly BadgeMilestone[] = [
  { days: 3,   id: 'newbie',  emoji: '🌱', fragments: 1,  nameKey: 'badges.newbie' },
  { days: 7,   id: 'bronze',  emoji: '🥉', fragments: 2,  nameKey: 'badges.bronze' },
  { days: 14,  id: 'silver',  emoji: '🥈', fragments: 3,  nameKey: 'badges.silver' },
  { days: 30,  id: 'gold',    emoji: '🥇', fragments: 5,  nameKey: 'badges.gold' },
  { days: 60,  id: 'diamond', emoji: '💎', fragments: 8,  nameKey: 'badges.diamond' },
  { days: 100, id: 'legend',  emoji: '🏆', fragments: 15, nameKey: 'badges.legend' },
];

// ====== 데이터 타입 ======
export interface StreakData {
  version: 1;
  currentStreak: number;
  lastAttendanceDate: string; // "YYYY-MM-DD" (KST)
  freezeCount: number;
  autoFreezeEnabled: boolean;
  totalAttendanceDays: number;
  badges: string[];           // 획득한 배지 ID 목록
  highestBadge: string | null;
  todayAttended: boolean;     // 오늘 출석 완료 여부 (캐시)
  todayDate: string;          // todayAttended를 판단할 때의 날짜
}

export interface StreakUpdateResult {
  streakBroken: boolean;
  freezeUsed: number;
  currentStreak: number;
  freezeCount: number;
}

export interface AttendanceResult {
  alreadyAttended: boolean;
  newlyAttended: boolean;
  currentStreak: number;
  newBadges: BadgeMilestone[];
  fragmentsEarned: number;
  freezeGranted: boolean;
}

// ====== 유틸 ======

/** KST 기준 "YYYY-MM-DD" 문자열 */
export function getKstDateString(now: Date = getServerAdjustedNow()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 두 날짜 문자열 사이의 일수 차이 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z').getTime();
  const b = new Date(dateB + 'T00:00:00Z').getTime();
  return Math.round(Math.abs(b - a) / (24 * 60 * 60 * 1000));
}

// ====== 저장/로드 ======

const DEFAULT_STREAK_DATA: StreakData = {
  version: 1,
  currentStreak: 0,
  lastAttendanceDate: '',
  freezeCount: 0,
  autoFreezeEnabled: true,
  totalAttendanceDays: 0,
  badges: [],
  highestBadge: null,
  todayAttended: false,
  todayDate: '',
};

export function loadStreakData(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STREAK_DATA };

    const parsed = JSON.parse(raw) as Partial<StreakData>;
    if (parsed.version !== 1) return { ...DEFAULT_STREAK_DATA };

    return {
      version: 1,
      currentStreak: Math.max(0, Number(parsed.currentStreak) || 0),
      lastAttendanceDate: typeof parsed.lastAttendanceDate === 'string' ? parsed.lastAttendanceDate : '',
      freezeCount: Math.min(MAX_FREEZE_COUNT, Math.max(0, Number(parsed.freezeCount) || 0)),
      autoFreezeEnabled: parsed.autoFreezeEnabled !== false,
      totalAttendanceDays: Math.max(0, Number(parsed.totalAttendanceDays) || 0),
      badges: Array.isArray(parsed.badges) ? parsed.badges.filter(b => typeof b === 'string') : [],
      highestBadge: typeof parsed.highestBadge === 'string' ? parsed.highestBadge : null,
      todayAttended: parsed.todayAttended === true,
      todayDate: typeof parsed.todayDate === 'string' ? parsed.todayDate : '',
    };
  } catch {
    return { ...DEFAULT_STREAK_DATA };
  }
}

export function saveStreakData(data: StreakData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 저장 실패 무시
  }
}

// ====== 핵심 로직 ======

/**
 * 앱 접속 시 호출: 스트릭 상태 확인 + 프리즈 소모/리셋 처리
 * (출석 인정과는 별개 — 여기서는 빠진 날 처리만)
 */
export function checkAndUpdateStreak(now: Date = getServerAdjustedNow()): StreakUpdateResult {
  const data = loadStreakData();
  const today = getKstDateString(now);

  // todayAttended 캐시 날짜가 오늘과 다르면 초기화
  if (data.todayDate !== today) {
    data.todayAttended = false;
    data.todayDate = today;
  }

  // 출석 기록이 없으면 (신규 유저) 아무 처리 불필요
  if (!data.lastAttendanceDate) {
    saveStreakData(data);
    return { streakBroken: false, freezeUsed: 0, currentStreak: 0, freezeCount: data.freezeCount };
  }

  // 마지막 출석이 오늘이면 아무 처리 불필요
  if (data.lastAttendanceDate === today) {
    return { streakBroken: false, freezeUsed: 0, currentStreak: data.currentStreak, freezeCount: data.freezeCount };
  }

  // 마지막 출석이 어제면 연속 유지 (빠진 날 없음)
  const missedDays = daysBetween(data.lastAttendanceDate, today) - 1;
  if (missedDays <= 0) {
    saveStreakData(data);
    return { streakBroken: false, freezeUsed: 0, currentStreak: data.currentStreak, freezeCount: data.freezeCount };
  }

  // 빠진 날이 있음 → 프리즈 처리
  if (data.autoFreezeEnabled && data.freezeCount > 0) {
    const daysToFreeze = Math.min(data.freezeCount, missedDays);
    const unfrozenDays = missedDays - daysToFreeze;
    data.freezeCount -= daysToFreeze;

    if (unfrozenDays === 0) {
      // 프리즈로 모든 빠진 날 커버 → 스트릭 유지
      saveStreakData(data);
      return { streakBroken: false, freezeUsed: daysToFreeze, currentStreak: data.currentStreak, freezeCount: data.freezeCount };
    }

    // 일부만 커버 → 프리즈 소모 후 스트릭 리셋
    data.currentStreak = 0;
    saveStreakData(data);
    return { streakBroken: true, freezeUsed: daysToFreeze, currentStreak: 0, freezeCount: data.freezeCount };
  }

  // 프리즈 없음 또는 자동 사용 OFF → 스트릭 리셋
  data.currentStreak = 0;
  saveStreakData(data);
  return { streakBroken: true, freezeUsed: 0, currentStreak: 0, freezeCount: data.freezeCount };
}

/**
 * 게임 중 점수 달성 시 호출: 출석 인정 + 배지 체크 + 프리즈 지급
 */
export function recordAttendance(score: number, now: Date = getServerAdjustedNow()): AttendanceResult {
  const data = loadStreakData();
  const today = getKstDateString(now);

  // 이미 오늘 출석 완료
  if (data.todayAttended && data.todayDate === today) {
    return {
      alreadyAttended: true,
      newlyAttended: false,
      currentStreak: data.currentStreak,
      newBadges: [],
      fragmentsEarned: 0,
      freezeGranted: false,
    };
  }

  // 점수 미달
  if (score < ATTENDANCE_MIN_SCORE) {
    return {
      alreadyAttended: false,
      newlyAttended: false,
      currentStreak: data.currentStreak,
      newBadges: [],
      fragmentsEarned: 0,
      freezeGranted: false,
    };
  }

  // 출석 인정!
  data.currentStreak += 1;
  data.totalAttendanceDays += 1;
  data.lastAttendanceDate = today;
  data.todayAttended = true;
  data.todayDate = today;

  // 배지 마일스톤 체크
  const newBadges: BadgeMilestone[] = [];
  let fragmentsEarned = 0;

  for (const milestone of BADGE_MILESTONES) {
    if (data.currentStreak >= milestone.days && !data.badges.includes(milestone.id)) {
      data.badges.push(milestone.id);
      newBadges.push(milestone);
      fragmentsEarned += milestone.fragments;
    }
  }

  // 최고 배지 갱신
  const highestMilestone = [...BADGE_MILESTONES]
    .reverse()
    .find(m => data.badges.includes(m.id));
  data.highestBadge = highestMilestone?.id ?? null;

  // 프리즈 지급 체크 (3일마다)
  let freezeGranted = false;
  if (data.currentStreak > 0 && data.currentStreak % FREEZE_GRANT_INTERVAL === 0) {
    if (data.freezeCount < MAX_FREEZE_COUNT) {
      data.freezeCount += 1;
      freezeGranted = true;
    }
  }

  // 스킨 조각 지급
  if (fragmentsEarned > 0) {
    const skinSettings = loadSkinSettings();
    skinSettings.fragments += fragmentsEarned;
    saveSkinSettings(skinSettings);
  }

  saveStreakData(data);

  return {
    alreadyAttended: false,
    newlyAttended: true,
    currentStreak: data.currentStreak,
    newBadges,
    fragmentsEarned,
    freezeGranted,
  };
}

/** 오늘 출석 완료 여부 (빠른 캐시 조회) */
export function isTodayAttended(now: Date = getServerAdjustedNow()): boolean {
  const data = loadStreakData();
  const today = getKstDateString(now);
  return data.todayAttended && data.todayDate === today;
}

/** 현재 최고 배지 정보 */
export function getHighestBadge(): BadgeMilestone | null {
  const data = loadStreakData();
  if (!data.highestBadge) return null;
  return BADGE_MILESTONES.find(m => m.id === data.highestBadge) ?? null;
}

/** 자동 프리즈 ON/OFF 토글 */
export function setAutoFreeze(enabled: boolean): void {
  const data = loadStreakData();
  data.autoFreezeEnabled = enabled;
  saveStreakData(data);
}

/** 출석 인정까지 남은 점수 (100 미만일 때만 의미) */
export function getPointsToAttendance(currentScore: number): number {
  if (currentScore >= ATTENDANCE_MIN_SCORE) return 0;
  return ATTENDANCE_MIN_SCORE - currentScore;
}
