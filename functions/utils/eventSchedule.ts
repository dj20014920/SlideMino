/**
 * 주간 이벤트 스케줄 서버 유틸리티
 *
 * 클라이언트(weeklyEventService.ts)와 동일한 이벤트 로테이션 로직을
 * 서버에서 독립적으로 계산한다. 보상 지급 시 서버가 직접 이벤트 ID를
 * 검증하여 클라이언트 조작을 차단.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** 기준 에포크: 2026-01-05 (월요일) KST = 2026-01-04 15:00 UTC */
const EPOCH_MONDAY_UTC = Date.UTC(2026, 0, 4, 15, 0, 0);

/** 이벤트 순환 순서 (8종) — 클라이언트와 동일 */
const EVENT_ROTATION_ORDER = [
  'NO_ROTATION', 'BURNING', 'PLUS_RUSH', 'EXPERT_4X4',
  'SPEED_RUN', 'TRIPLE_KILL', 'I_BLOCK_RUSH', 'PLAINS_10X10',
] as const;

/** KST 기준 날짜 문자열 YYYYMMDD */
function getKstDateString(utcMs: number): string {
  const d = new Date(utcMs + KST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

function getWeekIndex(nowUtcMs: number): number {
  return Math.floor((nowUtcMs - EPOCH_MONDAY_UTC) / MS_PER_WEEK);
}

/** 특정 주차 인덱스의 이벤트 ID 계산 */
function getEventIdForWeek(weekIndex: number): string {
  const safeIdx = ((weekIndex % EVENT_ROTATION_ORDER.length) + EVENT_ROTATION_ORDER.length) % EVENT_ROTATION_ORDER.length;
  const eventType = EVENT_ROTATION_ORDER[safeIdx];
  const startsAt = EPOCH_MONDAY_UTC + weekIndex * MS_PER_WEEK;
  return `${getKstDateString(startsAt)}_${eventType}`;
}

/**
 * 순위별 보상 조각 수 — claim-reward.ts와 reward-status.ts가 공유
 * 한 콴에서 만 관리하면 향후 변경 시 두 파일이 달라지는 문제 방지
 */
export const REWARD_FRAGMENTS = {
  FIRST_PLACE: 10,   // 1위
  TOP_10: 5,          // 2~10위
  PARTICIPATION: 2,   // 11위 이하 참여자
} as const;

/** 현재 진행 중인 이벤트 ID */
export function getCurrentEventId(nowUtcMs: number = Date.now()): string {
  return getEventIdForWeek(getWeekIndex(nowUtcMs));
}

/** 이전 주(직전 종료) 이벤트 ID */
export function getPreviousEventId(nowUtcMs: number = Date.now()): string {
  return getEventIdForWeek(getWeekIndex(nowUtcMs) - 1);
}

/**
 * 주어진 eventId가 이전 주 이벤트인지 검증.
 * 클라이언트가 임의의 eventId를 보내는 것을 차단.
 */
export function isPreviousEventId(eventId: string, nowUtcMs: number = Date.now()): boolean {
  return eventId === getPreviousEventId(nowUtcMs);
}
