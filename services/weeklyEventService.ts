/**
 * 주간 이벤트 서비스 — 기능 6: 주간 룰 변형 이벤트
 *
 * 매주 월요일 00:00 KST에 새 이벤트가 시작되어 7일간 운영.
 * 8종 이벤트가 순환하며, 각 이벤트마다 고유 규칙이 적용됨.
 * - 기본 2회 + 광고 해금 1회 (서버 최대 3회 검증)
 * - 30분 타이머 (게임 플레이 중에만 진행)
 * - 일반 게임과 병행 가능 (독립 저장 슬롯)
 */

import { BoardSize, ShapeType, WeeklyEventType, Piece, Phase } from '../types';
import { STANDARD_SHAPES } from '../constants';
import { getRotatedCells, getTurnActionAvailability } from './gameLogic';
import { getAnalyticsInstallId } from './analyticsService';
import { getServerAdjustedNow } from './serverTimeService';
import { KST_OFFSET_MS } from '../config/constants';

// ============================================
// 이벤트 정의 & 스케줄
// ============================================

/** 이벤트 규칙 정의 */
export interface WeeklyEventRule {
  type: WeeklyEventType;
  /** 고정 보드 크기 (null이면 이벤트 기본값 5×5) */
  boardSize: BoardSize;
  /** 회전 비활성화 여부 */
  disableRotation: boolean;
  /** 점수 배율 (1.0 = 기본) */
  scoreMultiplier: number;
  /** 사용 가능한 블록 ShapeType 목록 (null이면 기본) */
  allowedShapes: ShapeType[] | null;
  /** 블록별 가중치 (null이면 균등) — type → 가중치 */
  shapeWeights: Record<string, number> | null;
  /** 시간 제한(초). 0 = 30분 기본 */
  timeLimitSeconds: number;
  /** 트리플킬 보너스 점수 (0이면 비활성) */
  tripleKillBonus: number;
  /** Undo 비활성화 */
  disableUndo: boolean;
  /** BlockRefresh 비활성화 */
  disableBlockRefresh: boolean;
  /** Revive 비활성화 */
  disableRevive: boolean;
}

/** 8종 이벤트 규칙 테이블 */
export const EVENT_RULES: Record<WeeklyEventType, WeeklyEventRule> = {
  NO_ROTATION: {
    type: 'NO_ROTATION',
    boardSize: 5,
    disableRotation: true,
    scoreMultiplier: 1.0,
    allowedShapes: null,
    shapeWeights: null,
    timeLimitSeconds: 1800, // 30분
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  BURNING: {
    type: 'BURNING',
    boardSize: 5,
    disableRotation: false,
    scoreMultiplier: 1.5,
    allowedShapes: null,
    shapeWeights: null,
    timeLimitSeconds: 1800,
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  PLUS_RUSH: {
    type: 'PLUS_RUSH',
    boardSize: 5,
    disableRotation: false,
    scoreMultiplier: 1.0,
    // PLUS 블록 포함, 모든 블록 사용 가능
    allowedShapes: [...STANDARD_SHAPES, ShapeType.PLUS],
    // PLUS 가중치 3배: 일반 블록 1, PLUS 3
    shapeWeights: {
      [ShapeType.I]: 1, [ShapeType.O]: 1, [ShapeType.T]: 1,
      [ShapeType.S]: 1, [ShapeType.Z]: 1, [ShapeType.J]: 1,
      [ShapeType.L]: 1, [ShapeType.PLUS]: 3,
    },
    timeLimitSeconds: 1800,
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  EXPERT_4X4: {
    type: 'EXPERT_4X4',
    boardSize: 4,
    disableRotation: false,
    scoreMultiplier: 1.0,
    allowedShapes: null,
    shapeWeights: null,
    timeLimitSeconds: 1800,
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  SPEED_RUN: {
    type: 'SPEED_RUN',
    boardSize: 5,
    disableRotation: false,
    scoreMultiplier: 1.0,
    allowedShapes: null,
    shapeWeights: null,
    timeLimitSeconds: 900, // 15분
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  TRIPLE_KILL: {
    type: 'TRIPLE_KILL',
    boardSize: 5,
    disableRotation: false,
    scoreMultiplier: 1.0,
    allowedShapes: null,
    shapeWeights: null,
    timeLimitSeconds: 1800,
    tripleKillBonus: 333,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  I_BLOCK_RUSH: {
    type: 'I_BLOCK_RUSH',
    boardSize: 5,
    disableRotation: false,
    scoreMultiplier: 1.0,
    allowedShapes: null,
    shapeWeights: {
      [ShapeType.I]: 3, [ShapeType.O]: 1, [ShapeType.T]: 1,
      [ShapeType.S]: 1, [ShapeType.Z]: 1, [ShapeType.J]: 1,
      [ShapeType.L]: 1,
    },
    timeLimitSeconds: 1800,
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
  PLAINS_10X10: {
    type: 'PLAINS_10X10',
    boardSize: 10,
    disableRotation: false,
    scoreMultiplier: 1.0,
    allowedShapes: null,
    shapeWeights: null,
    timeLimitSeconds: 1800,
    tripleKillBonus: 0,
    disableUndo: true,
    disableBlockRefresh: true,
    disableRevive: true,
  },
};

/** 이벤트 순환 순서 (8종, 매주 1개씩) */
const EVENT_ROTATION_ORDER: WeeklyEventType[] = [
  'NO_ROTATION', 'BURNING', 'PLUS_RUSH', 'EXPERT_4X4',
  'SPEED_RUN', 'TRIPLE_KILL', 'I_BLOCK_RUSH', 'PLAINS_10X10',
];

/** 기준 에포크: 2026-01-05 (월요일) KST → UTC ms */
// 2026-01-05 00:00 KST = 2026-01-04 15:00 UTC
const EPOCH_MONDAY_UTC = Date.UTC(2026, 0, 4, 15, 0, 0);

/** KST 기준 현재 시각 ms */
function nowKstMs(): number {
  return getServerAdjustedNow().getTime() + KST_OFFSET_MS;
}

/** KST 기준 현재 시각의 Date 객체 (UTC 필드가 KST 값) */
function nowKstDate(): Date {
  return new Date(nowKstMs());
}

/** 현재 이벤트 주차 인덱스 (0부터) */
function getCurrentWeekIndex(): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((getServerAdjustedNow().getTime() - EPOCH_MONDAY_UTC) / msPerWeek);
}

/** 현재 주의 월요일 00:00 KST (UTC ms) */
function getCurrentWeekStartUtcMs(): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekIndex = getCurrentWeekIndex();
  return EPOCH_MONDAY_UTC + weekIndex * msPerWeek;
}

/** 다음 주의 월요일 00:00 KST (UTC ms) */
function getNextWeekStartUtcMs(): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return getCurrentWeekStartUtcMs() + msPerWeek;
}

// ============================================
// 이벤트 스케줄 API
// ============================================

export interface CurrentEventInfo {
  eventType: WeeklyEventType;
  rule: WeeklyEventRule;
  eventId: string;        // "YYYYMMDD_eventType" 형식
  startsAt: number;       // UTC ms
  endsAt: number;         // UTC ms
  remainingMs: number;    // 이벤트 종료까지 남은 ms
}

/** 오늘 날짜 YYYYMMDD (KST) */
function getKstDateString(utcMs: number): string {
  const d = new Date(utcMs + KST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

/** 현재 진행 중인 주간 이벤트 정보 */
export function getCurrentEvent(): CurrentEventInfo {
  const weekIndex = getCurrentWeekIndex();
  const eventType = EVENT_ROTATION_ORDER[weekIndex % EVENT_ROTATION_ORDER.length];
  const rule = EVENT_RULES[eventType];
  const startsAt = getCurrentWeekStartUtcMs();
  const endsAt = getNextWeekStartUtcMs();
  const eventId = `${getKstDateString(startsAt)}_${eventType}`;
  return {
    eventType,
    rule,
    eventId,
    startsAt,
    endsAt,
    remainingMs: Math.max(0, endsAt - getServerAdjustedNow().getTime()),
  };
}

/** 이벤트 종료까지 남은 시간 포맷 (Xd Xh Xm) */
export function formatEventRemaining(ms: number): string {
  if (ms <= 0) return '종료';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ============================================
// 이벤트 전용 피스 생성 (가중치 적용)
// ============================================

/** 가중치 기반 블록 생성 */
export function generateEventPiece(rule: WeeklyEventRule): Piece {
  const shapes = rule.allowedShapes ?? STANDARD_SHAPES;
  let type: ShapeType;

  if (rule.shapeWeights) {
    // 가중치 기반 선택
    const entries = shapes.map(s => ({ shape: s, weight: rule.shapeWeights![s] ?? 1 }));
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * totalWeight;
    type = entries[0].shape; // fallback
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) { type = e.shape; break; }
    }
  } else {
    type = shapes[Math.floor(Math.random() * shapes.length)];
  }

  const rotation = rule.disableRotation ? 0 : Math.floor(Math.random() * 4);

  return {
    id: Math.random().toString(36).substr(2, 9),
    type,
    rotation,
    initialRotation: rotation,
    cells: getRotatedCells(type, rotation),
    value: 1,
  };
}

// ============================================
// 이벤트 게임 상태 분리 저장 (localStorage)
// ============================================

const EVENT_GAME_STATE_KEY = 'slidemino_event_game_state_v1';

export interface EventGameSaveData {
  eventId: string;
  eventType: WeeklyEventType;
  grid: any;
  slots: any;
  score: number;
  phase: string;
  boardSize: BoardSize;
  moveCount: number;
  /** 이벤트 타이머: 누적 플레이 시간(ms) */
  eventPlayedMs: number;
  /** 현재 도전 회차 (1, 2, 3) */
  attemptNumber: number;
  sessionId: string;
  startedAt: number;
  savedAt: number;
}

export function saveEventGameState(data: EventGameSaveData): void {
  try {
    localStorage.setItem(EVENT_GAME_STATE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[WeeklyEvent] 이벤트 게임 저장 실패:', e);
  }
}

export function loadEventGameState(): EventGameSaveData | null {
  try {
    const raw = localStorage.getItem(EVENT_GAME_STATE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as EventGameSaveData;
    // 이미 종료된 이벤트의 저장 데이터는 폐기
    const current = getCurrentEvent();
    if (data.eventId !== current.eventId) {
      clearEventGameState();
      return null;
    }
    // 저장은 존재하지만 재개 불가능(이미 게임오버 상태)한 데이터는 즉시 정리.
    const rule = EVENT_RULES[data.eventType as WeeklyEventType];
    if (!rule || !Array.isArray(data.grid) || !Array.isArray(data.slots)) {
      clearEventGameState();
      return null;
    }
    if (!Number.isFinite(data.eventPlayedMs) || data.eventPlayedMs >= rule.timeLimitSeconds * 1000) {
      clearEventGameState();
      return null;
    }
    const availability = getTurnActionAvailability(data.grid, data.slots, rule.disableRotation);
    const phase = data.phase === Phase.SLIDE ? Phase.SLIDE : Phase.PLACE;
    const isTerminal =
      (phase === Phase.PLACE && availability.isGameOver) ||
      (phase === Phase.SLIDE && !availability.canSwipe && !availability.canPlace);
    if (isTerminal) {
      clearEventGameState();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearEventGameState(): void {
  try {
    localStorage.removeItem(EVENT_GAME_STATE_KEY);
  } catch (e) { /* ignore */ }
}

/** 진행중인 이벤트 게임이 있는지 확인 */
export function hasActiveEventGame(): boolean {
  return loadEventGameState() !== null;
}

// ============================================
// 도전 횟수 관리 (로컬 캐시 + 서버 검증)
// ============================================

export const WEEKLY_EVENT_BASE_ATTEMPTS = 2;
export const WEEKLY_EVENT_AD_BONUS_ATTEMPTS = 1;
export const WEEKLY_EVENT_MAX_ATTEMPTS = WEEKLY_EVENT_BASE_ATTEMPTS + WEEKLY_EVENT_AD_BONUS_ATTEMPTS;

const EVENT_ATTEMPTS_KEY = 'slidemino.event_attempts.v1';
const EVENT_ATTEMPT_AD_BONUS_KEY = 'slidemino.event_attempt_ad_bonus.v1';

interface LocalEventAttempts {
  eventId: string;
  count: number;       // 완료된 도전 횟수
  bestScore: number;   // 로컬 최고점 (서버와 동기화)
}

function loadLocalAttempts(): LocalEventAttempts | null {
  try {
    const raw = localStorage.getItem(EVENT_ATTEMPTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalEventAttempts>;
    if (typeof parsed.eventId !== 'string') return null;
    return {
      eventId: parsed.eventId,
      count: typeof parsed.count === 'number' ? Math.max(0, Math.floor(parsed.count)) : 0,
      bestScore: typeof parsed.bestScore === 'number' ? Math.max(0, Math.floor(parsed.bestScore)) : 0,
    };
  } catch { return null; }
}

function saveLocalAttempts(data: LocalEventAttempts): void {
  try {
    localStorage.setItem(EVENT_ATTEMPTS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

interface LocalEventAttemptAdBonus {
  eventId: string;
  unlocked: boolean;
}

function loadLocalAttemptAdBonus(): LocalEventAttemptAdBonus | null {
  try {
    const raw = localStorage.getItem(EVENT_ATTEMPT_AD_BONUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalEventAttemptAdBonus>;
    if (typeof parsed.eventId !== 'string' || typeof parsed.unlocked !== 'boolean') return null;
    return { eventId: parsed.eventId, unlocked: parsed.unlocked };
  } catch { return null; }
}

function saveLocalAttemptAdBonus(data: LocalEventAttemptAdBonus): void {
  try {
    localStorage.setItem(EVENT_ATTEMPT_AD_BONUS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function isEventAttemptAdBonusUnlocked(): boolean {
  const current = getCurrentEvent();
  const bonus = loadLocalAttemptAdBonus();
  return Boolean(bonus && bonus.eventId === current.eventId && bonus.unlocked);
}

export function unlockEventAttemptAdBonus(): void {
  const current = getCurrentEvent();
  saveLocalAttemptAdBonus({
    eventId: current.eventId,
    unlocked: true,
  });
}

export function getWeeklyEventAttemptLimit(isAdBonusUnlocked: boolean): number {
  const unlockedBonus = isAdBonusUnlocked ? WEEKLY_EVENT_AD_BONUS_ATTEMPTS : 0;
  return Math.min(WEEKLY_EVENT_MAX_ATTEMPTS, WEEKLY_EVENT_BASE_ATTEMPTS + unlockedBonus);
}

export function canUnlockWeeklyEventAdBonus(attemptCount: number, isAdBonusUnlocked: boolean): boolean {
  const normalizedCount = Math.max(0, Math.floor(attemptCount));
  return !isAdBonusUnlocked
    && normalizedCount >= WEEKLY_EVENT_BASE_ATTEMPTS
    && normalizedCount < WEEKLY_EVENT_MAX_ATTEMPTS;
}

export function canStartWeeklyEventAttempt(attemptCount: number, isAdBonusUnlocked: boolean): boolean {
  const normalizedCount = Math.max(0, Math.floor(attemptCount));
  return normalizedCount < getWeeklyEventAttemptLimit(isAdBonusUnlocked);
}

export function getRemainingWeeklyEventAttempts(attemptCount: number, isAdBonusUnlocked: boolean): number {
  const normalizedCount = Math.max(0, Math.floor(attemptCount));
  return Math.max(0, getWeeklyEventAttemptLimit(isAdBonusUnlocked) - normalizedCount);
}

/** 현재 이벤트의 로컬 도전 횟수 (서버 확인 전 빠른 체크) */
export function getLocalAttemptCount(): number {
  const current = getCurrentEvent();
  const local = loadLocalAttempts();
  if (!local || local.eventId !== current.eventId) return 0;
  return Math.max(0, Math.min(WEEKLY_EVENT_MAX_ATTEMPTS, local.count));
}

/** 로컬 도전 횟수 증가 */
export function incrementLocalAttemptCount(score: number): void {
  const current = getCurrentEvent();
  const local = loadLocalAttempts();
  const prev = (local && local.eventId === current.eventId)
    ? local
    : { eventId: current.eventId, count: 0, bestScore: 0 };
  prev.count = Math.min(WEEKLY_EVENT_MAX_ATTEMPTS, prev.count + 1);
  prev.bestScore = Math.max(prev.bestScore, score);
  saveLocalAttempts(prev);
}

/**
 * 서버에서 실제 도전 횟수를 조회해 로컬 캐시와 동기화한다.
 * 서버 값을 권위 원장으로 신뢰하여 로컬 조작값을 무시한다.
 * 네트워크 오류 시 로컬 값을 그대로 반환.
 */
export async function syncAttemptCountFromServer(): Promise<number> {
  try {
    const current = getCurrentEvent();
    const installId = getAnalyticsInstallId();
    const res = await fetch(
      `${API_BASE}/attempts?eventId=${encodeURIComponent(current.eventId)}&installId=${encodeURIComponent(installId)}`
    );
    if (!res.ok) return getLocalAttemptCount();
    const data = await res.json() as { count: number };
    const serverCount = Math.min(WEEKLY_EVENT_MAX_ATTEMPTS, Math.max(0, data.count ?? 0));
    // 서버 값을 권위 원장으로 신뢰 — 로컬 조작값 무시
    const local = loadLocalAttempts();
    saveLocalAttempts({
      eventId: current.eventId,
      count: serverCount,
      bestScore: local?.bestScore ?? 0,
    });
    return serverCount;
  } catch {
    return getLocalAttemptCount();
  }
}

/** 현재 이벤트 참여 보상 수령 여부 */
export function hasClaimedEventReward(): boolean {
  try {
    const raw = localStorage.getItem('slidemino.event_reward_claimed.v1');
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.eventId === getCurrentEvent().eventId;
  } catch { return false; }
}

/** 이벤트 참여 보상 수령 표시 */
export function markEventRewardClaimed(): void {
  try {
    localStorage.setItem('slidemino.event_reward_claimed.v1', JSON.stringify({
      eventId: getCurrentEvent().eventId,
      claimedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

// ============================================
// 서버 API 호출
// ============================================

const API_BASE = '/api/weekly-event';

export interface EventSubmitResult {
  success: boolean;
  rank?: number;
  total?: number;
  bestScore?: number;
  attemptNumber?: number;
  error?: string;
}

/** 이벤트 점수 제출 */
export async function submitEventScore(params: {
  name: string;
  score: number;
  moves: number;
  duration: number;
  attemptNumber: number;
  levelBadge?: string;
}): Promise<EventSubmitResult> {
  try {
    const current = getCurrentEvent();
    const installId = getAnalyticsInstallId();
    const res = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: current.eventId,
        eventType: current.eventType,
        installId,
        ...params,
      }),
    });
    const data = await res.json() as EventSubmitResult;
    if (data.success) {
      incrementLocalAttemptCount(params.score);
    }
    return data;
  } catch (e) {
    return { success: false, error: 'network_error' };
  }
}

export interface EventRankingEntry {
  rank: number;
  name: string;
  score: number;
  moves: number;
  duration: number;
  levelBadge?: string | null;
}

export interface EventRankingsResult {
  rankings: EventRankingEntry[];
  myRank?: number;
  myScore?: number;
  total: number;
}

/** 이전 주 이벤트 정보 (종료된 이벤트의 랭킹 조회용) */
export function getPreviousEvent(): CurrentEventInfo {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const prevWeekIndex = getCurrentWeekIndex() - 1;
  const eventType = EVENT_ROTATION_ORDER[((prevWeekIndex % EVENT_ROTATION_ORDER.length) + EVENT_ROTATION_ORDER.length) % EVENT_ROTATION_ORDER.length];
  const rule = EVENT_RULES[eventType];
  const startsAt = EPOCH_MONDAY_UTC + prevWeekIndex * msPerWeek;
  const endsAt = startsAt + msPerWeek;
  const eventId = `${getKstDateString(startsAt)}_${eventType}`;
  return {
    eventType,
    rule,
    eventId,
    startsAt,
    endsAt,
    remainingMs: 0, // 종료된 이벤트
  };
}

/** 이벤트 랭킹 조회 */
export async function fetchEventRankings(eventId?: string): Promise<EventRankingsResult> {
  try {
    const resolvedEventId = eventId ?? getCurrentEvent().eventId;
    const installId = getAnalyticsInstallId();
    const res = await fetch(`${API_BASE}/rankings?eventId=${encodeURIComponent(resolvedEventId)}&installId=${encodeURIComponent(installId)}`);
    if (!res.ok) return { rankings: [], total: 0 };
    return await res.json() as EventRankingsResult;
  } catch {
    return { rankings: [], total: 0 };
  }
}

// ============================================
// 유틸: 이벤트 타이머 (30분 제한)
// ============================================

/** 남은 이벤트 타이머 시간(ms) 계산 */
export function getEventTimerRemainingMs(
  timeLimitSeconds: number,
  eventPlayedMs: number
): number {
  return Math.max(0, timeLimitSeconds * 1000 - eventPlayedMs);
}

/** 타이머 포맷 mm:ss */
export function formatTimerMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
