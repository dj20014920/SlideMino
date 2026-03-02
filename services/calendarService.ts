/**
 * 라이브옵스 캘린더 서비스 (기능 10 — 이번 주 일정 한눈에 보기)
 *
 * - 오늘부터 7일간 이벤트 스케줄 표시
 * - 데일리 챌린지, 주간 이벤트, 시즌 종료, 출석 상태 등 통합
 * - 모든 데이터는 클라이언트에서 규칙 기반으로 계산 (서버 불필요)
 * - 종료 임박 항목(24시간 이내) 우선 표시 + 빨간색 강조
 */

import { getKstDateString, isTodayAttended, loadStreakData } from './streakService';
import { getCurrentEvent } from './weeklyEventService';
import { getSeasonRemainingMs } from './xpLevelService';
import { getDailyCompletedCount } from './missionService';
import { getServerAdjustedNow } from './serverTimeService';
import { KST_OFFSET_MS } from '../config/constants';

// ====== 캘린더 항목 타입 ======

export type CalendarItemType = 'daily_challenge' | 'weekly_event' | 'season_end' | 'attendance' | 'daily_mission' | 'weekly_mission';

export interface CalendarItem {
  type: CalendarItemType;
  titleKey: string;     // i18n 키
  descKey?: string;     // i18n 키 (부가 설명)
  endsAt?: number;      // 밀리초 타임스탬프 (종료 시각)
  isUrgent: boolean;    // 24시간 이내 종료
  isCompleted: boolean; // 오늘 완료 여부
  /** 터치 시 이동할 액션 식별자 */
  action?: string;
}

// ====== KST 유틸 ======

/** 오늘 KST 자정의 UTC 타임스탬프 */
function getTodayKstMidnightMs(): number {
  const now = getServerAdjustedNow();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  return Date.UTC(y, m, d) - KST_OFFSET_MS;
}

/** 다음 KST 자정 타임스탬프 */
function getNextKstMidnightMs(): number {
  return getTodayKstMidnightMs() + 24 * 60 * 60 * 1000;
}

/** 다음 월요일 KST 00:00 타임스탬프 */
function getNextMondayKstMs(): number {
  const now = getServerAdjustedNow();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kst.getUTCDay(); // 0=일, 1=월, ...
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const todayMidnight = getTodayKstMidnightMs();
  return todayMidnight + daysUntilMonday * 24 * 60 * 60 * 1000;
}

// ====== 캘린더 생성 ======

/**
 * 오늘의 캘린더 항목 목록을 생성합니다.
 * 우선순위: 종료 임박 > 오늘 시작 > 진행 중
 * 최대 6개 항목 반환.
 */
export function getCalendarItems(): CalendarItem[] {
  const now = getServerAdjustedNow().getTime();
  const items: CalendarItem[] = [];

  // 1. 출석 상태
  const attended = isTodayAttended();
  items.push({
    type: 'attendance',
    titleKey: 'calendar.attendance',
    descKey: attended ? 'calendar.attendanceComplete' : 'calendar.attendanceIncomplete',
    endsAt: getNextKstMidnightMs(),
    isUrgent: false,
    isCompleted: attended,
    action: 'streak',
  });

  // 2. 일일 미션
  const dailyCompleted = getDailyCompletedCount();
  items.push({
    type: 'daily_mission',
    titleKey: 'calendar.dailyMission',
    descKey: dailyCompleted >= 3 ? 'calendar.missionAllComplete' : 'calendar.missionProgress',
    endsAt: getNextKstMidnightMs(),
    isUrgent: false,
    isCompleted: dailyCompleted >= 3,
    action: 'mission',
  });

  // 사용자 결정사항(임시 운영 정책):
  // 데일리 챌린지는 사용자 증가 시점까지 비활성화하며, 캘린더 노출도 함께 중단한다.
  // 재활성화 시 아래 push 블록을 복구한다.
  // items.push({
  //   type: 'daily_challenge',
  //   titleKey: 'calendar.dailyChallenge',
  //   endsAt: getNextKstMidnightMs(),
  //   isUrgent: false,
  //   isCompleted: false, // 참여 여부는 서버에서만 확인 가능 → false로 표시
  //   action: 'daily_challenge',
  // });

  // 4. 주간 이벤트
  const event = getCurrentEvent();
  if (event) {
    const weekEndMs = getNextMondayKstMs();
    const isEventUrgent = weekEndMs - now < 24 * 60 * 60 * 1000;
    items.push({
      type: 'weekly_event',
      titleKey: 'calendar.weeklyEvent',
      descKey: `game:weeklyEvent.events.${event.eventType}.name`,
      endsAt: weekEndMs,
      isUrgent: isEventUrgent,
      isCompleted: false,
      action: 'weekly_event',
    });
  }

  // 5. 시즌 종료
  const seasonRemMs = getSeasonRemainingMs();
  if (seasonRemMs > 0) {
    const seasonEndMs = now + seasonRemMs;
    const seasonDaysLeft = Math.ceil(seasonRemMs / (24 * 60 * 60 * 1000));
    const isSeasonUrgent = seasonRemMs < 7 * 24 * 60 * 60 * 1000; // 7일 이내면 표시
    if (seasonDaysLeft <= 14) {
      items.push({
        type: 'season_end',
        titleKey: 'calendar.seasonEnd',
        descKey: 'calendar.seasonEndDesc',
        endsAt: seasonEndMs,
        isUrgent: seasonRemMs < 24 * 60 * 60 * 1000,
        isCompleted: false,
        action: 'leaderboard',
      });
    }
  }

  // 6. 주간 미션 (월요일 리셋)
  const weekEndMs = getNextMondayKstMs();
  const weeklyUrgent = weekEndMs - now < 24 * 60 * 60 * 1000;
  items.push({
    type: 'weekly_mission',
    titleKey: 'calendar.weeklyMission',
    endsAt: weekEndMs,
    isUrgent: weeklyUrgent,
    isCompleted: false,
    action: 'mission',
  });

  // 정렬: 긴급(24h 이내) > 미완료 > 완료
  items.sort((a, b) => {
    if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return (a.endsAt ?? Infinity) - (b.endsAt ?? Infinity);
  });

  return items.slice(0, 6);
}

/** 종료까지 남은 시간 포맷 (예: "2일 3시간", "5시간 20분") */
export function formatTimeRemaining(endsAt: number): string {
  const ms = Math.max(0, endsAt - getServerAdjustedNow().getTime());
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `${days}d ${remainingHours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
