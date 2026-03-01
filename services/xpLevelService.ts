/**
 * XP & 레벨 시스템 (기능 9 — 메타 진행도)
 *
 * - 게임 행동(미션 완료, 이벤트 참여, 출석, 2048 생성 등)으로 XP 획득
 * - 레벨업 시 스킨 조각 + 5레벨 배지 보상
 * - 시즌 3개월 주기, 종료 시 명예 레벨로 영구 기록
 * - localStorage 기반 영속화 (slidemino.xp.v1)
 * - 이벤트 버스로 XP_GAINED / LEVEL_UP 이벤트 발행
 */

import { gameEventBus } from './gameEventBus';
import { addFragments, loadSkinSettings } from './skinService';
import { getKstDateString } from './streakService';
import { getServerAdjustedNow } from './serverTimeService';

// ====== 상수 ======

const STORAGE_KEY = 'slidemino.xp.v1';
const XP_LOG_KEY = 'slidemino.xp_log.v1';

// ── XP 획득량 (방안 A — 원래 수치 유지) ──
const XP_DAILY_MISSION = 10;
const XP_WEEKLY_MISSION = 15;
const XP_WEEKLY_EVENT = 20;
const XP_STREAK_MULTIPLIER = 1;  // 연속일수 × 1, 최대 10
const XP_STREAK_MAX = 10;
const XP_TILE_2048 = 2;
const XP_SKIN_ACQUIRED = 5;
const XP_GAME_COMPLETE = 10;

// ── 레벨 커브 (방안 A — 1/10 축소) ──
// Lv 1-10: 100 + Lv×10 XP
// Lv 11-25: 200 + Lv×10 XP
// Lv 26-50: 300 + Lv×10 XP
const MAX_LEVEL = 50;

// ── 시즌 정의 ──
// 시즌 = 3개월 (분기)
// S1: 1-3월, S2: 4-6월, S3: 7-9월, S4: 10-12월
function getCurrentSeasonId(): string {
  const now = getServerAdjustedNow();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth(); // 0-based
  const q = Math.floor(m / 3) + 1;
  return `S${y}Q${q}`;
}

/** 현재 시즌 종료 날짜(KST) 반환 */
export function getSeasonEndDate(): Date {
  const now = getServerAdjustedNow();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const q = Math.floor(m / 3);
  // 다음 분기 시작 = 시즌 종료
  const nextQStartMonth = (q + 1) * 3;
  const endYear = nextQStartMonth >= 12 ? y + 1 : y;
  const endMonth = nextQStartMonth % 12;
  // KST 00:00 = UTC 전일 15:00
  return new Date(Date.UTC(endYear, endMonth, 1) - 9 * 60 * 60 * 1000);
}

/** 시즌 종료까지 남은 밀리초 */
export function getSeasonRemainingMs(): number {
  return Math.max(0, getSeasonEndDate().getTime() - getServerAdjustedNow().getTime());
}

// ====== 레벨 계산 ======

/** 주어진 레벨에 필요한 XP (레벨업 비용) */
export function xpRequiredForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level <= 10) return 100 + level * 10;
  if (level <= 25) return 200 + level * 10;
  return 300 + level * 10;
}

// ====== 레벨 보상 ======

/** 5레벨 배지 정의 */
export interface LevelBadge {
  level: number;
  id: string;
  emoji: string;
  nameKey: string;
}

export const LEVEL_BADGES: readonly LevelBadge[] = [
  { level: 5,  id: 'lv5',  emoji: '⭐',  nameKey: 'xp.badges.lv5' },
  { level: 10, id: 'lv10', emoji: '🌟',  nameKey: 'xp.badges.lv10' },
  { level: 15, id: 'lv15', emoji: '💫',  nameKey: 'xp.badges.lv15' },
  { level: 20, id: 'lv20', emoji: '🏅',  nameKey: 'xp.badges.lv20' },
  { level: 25, id: 'lv25', emoji: '🎖️',  nameKey: 'xp.badges.lv25' },
  { level: 30, id: 'lv30', emoji: '👑',  nameKey: 'xp.badges.lv30' },
  { level: 35, id: 'lv35', emoji: '💎',  nameKey: 'xp.badges.lv35' },
  { level: 40, id: 'lv40', emoji: '🔮',  nameKey: 'xp.badges.lv40' },
  { level: 45, id: 'lv45', emoji: '🌈',  nameKey: 'xp.badges.lv45' },
  { level: 50, id: 'lv50', emoji: '🏆',  nameKey: 'xp.badges.lv50' },
];

/** 레벨업 시 보상 계산 */
export interface LevelUpReward {
  level: number;
  fragments: number;
  badge: LevelBadge | null;
  /** 특별 보상 (Lv10: 무료 뽑기, Lv20: 일반 스킨 지정획득 등) */
  special: string | null;
}

function getLevelUpReward(level: number): LevelUpReward {
  // 공통 보상: Lv만큼의 스킨 조각 (최대 20개)
  const fragments = Math.min(level, 20);
  const badge = LEVEL_BADGES.find(b => b.level === level) ?? null;

  // 특별 보상
  let special: string | null = null;
  switch (level) {
    case 5:  special = null; break; // 조각 5개 (공통에 포함)
    case 10: special = 'FREE_DRAW_1'; break; // 스킨 뽑기 1회 무료
    case 15: special = null; break; // 조각 8개 → 공통 min(15,20) = 15
    case 20: special = 'SELECT_NORMAL_SKIN'; break; // 일반 스킨 지정 획득
    case 25: special = null; break;
    case 30: special = 'FREE_DRAW_5'; break; // 스킨 뽑기 5회
    case 40: special = 'SELECT_PREMIUM_SKIN'; break; // 프리미엄 스킨 지정 획득
    case 50: special = 'SELECT_PREMIUM_SKIN_AND_TITLE'; break; // 프리미엄 + 칭호
  }

  return { level, fragments, badge, special };
}

// ====== 데이터 타입 ======

export interface XpData {
  version: 1;
  seasonId: string;
  level: number;
  xp: number;         // 현재 레벨 내 축적 XP
  totalXp: number;    // 이번 시즌 총 누적 XP
  badges: string[];   // 획득 레벨 배지 ID
  /** 명예 레벨 기록 (시즌ID → 최종 레벨) */
  honorLevels: Record<string, number>;
  /** 오늘 날짜 (KST YYYY-MM-DD) — 일일 XP 로그 제한용 */
  todayDate: string;
  /** 이번 시즌 주간 이벤트 XP 수령 주차 (중복 방지) */
  eventXpClaimedWeeks: string[];
  /** 특별 보상 미수령 목록 */
  pendingSpecialRewards: string[];
}

export interface XpLogEntry {
  source: string;  // 'daily_mission', 'weekly_mission', 'event', 'streak', 'tile_2048', 'skin', 'game_complete'
  amount: number;
  timestamp: number;
  dateStr: string;
}

export interface XpLogData {
  version: 1;
  entries: XpLogEntry[];
}

// ====== 저장/로드 ======

const DEFAULT_XP_DATA: XpData = {
  version: 1,
  seasonId: getCurrentSeasonId(),
  level: 0,
  xp: 0,
  totalXp: 0,
  badges: [],
  honorLevels: {},
  todayDate: '',
  eventXpClaimedWeeks: [],
  pendingSpecialRewards: [],
};

export function loadXpData(): XpData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_XP_DATA, seasonId: getCurrentSeasonId() };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return { ...DEFAULT_XP_DATA, seasonId: getCurrentSeasonId() };

    const data: XpData = {
      version: 1,
      seasonId: typeof parsed.seasonId === 'string' ? parsed.seasonId : getCurrentSeasonId(),
      level: typeof parsed.level === 'number' ? Math.max(0, parsed.level) : 0,
      xp: typeof parsed.xp === 'number' ? Math.max(0, parsed.xp) : 0,
      totalXp: typeof parsed.totalXp === 'number' ? Math.max(0, parsed.totalXp) : 0,
      badges: Array.isArray(parsed.badges) ? parsed.badges.filter((b: unknown) => typeof b === 'string') : [],
      honorLevels: (typeof parsed.honorLevels === 'object' && parsed.honorLevels !== null) ? parsed.honorLevels : {},
      todayDate: typeof parsed.todayDate === 'string' ? parsed.todayDate : '',
      eventXpClaimedWeeks: Array.isArray(parsed.eventXpClaimedWeeks) ? parsed.eventXpClaimedWeeks : [],
      pendingSpecialRewards: Array.isArray(parsed.pendingSpecialRewards) ? parsed.pendingSpecialRewards : [],
    };

    // 시즌 전환 감지 → 명예 레벨 기록 후 리셋
    const currentSeason = getCurrentSeasonId();
    if (data.seasonId !== currentSeason) {
      data.honorLevels[data.seasonId] = data.level;
      data.level = 0;
      data.xp = 0;
      data.totalXp = 0;
      data.badges = [];
      data.eventXpClaimedWeeks = [];
      // pendingSpecialRewards는 시즌 전환 시에도 유지 — 미수령 보상 보존
      data.seasonId = currentSeason;
    }

    return data;
  } catch {
    return { ...DEFAULT_XP_DATA, seasonId: getCurrentSeasonId() };
  }
}

function saveXpData(data: XpData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* localStorage 실패 무시 */ }
}

// ====== XP 로그 ======

function loadXpLog(): XpLogData {
  try {
    const raw = localStorage.getItem(XP_LOG_KEY);
    if (!raw) return { version: 1, entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return { version: 1, entries: [] };
    return {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function saveXpLog(log: XpLogData): void {
  try {
    // 최근 7일 데이터만 유지
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    log.entries = log.entries.filter(e => now - e.timestamp < sevenDaysMs);
    localStorage.setItem(XP_LOG_KEY, JSON.stringify(log));
  } catch { /* 무시 */ }
}

function addXpLogEntry(source: string, amount: number): void {
  const log = loadXpLog();
  log.entries.push({
    source,
    amount,
    timestamp: Date.now(),
    dateStr: getKstDateString(),
  });
  saveXpLog(log);
}

// ====== 핵심 XP 추가 로직 ======

export interface XpGainResult {
  xpGained: number;
  source: string;
  newLevel: number;
  leveledUp: boolean;
  levelUpRewards: LevelUpReward[];
}

/**
 * XP를 추가하고 레벨업 처리.
 * 레벨업 시 보상(조각, 배지) 자동 지급하고 이벤트 발행.
 */
function addXp(amount: number, source: string): XpGainResult {
  if (amount <= 0) return { xpGained: 0, source, newLevel: 0, leveledUp: false, levelUpRewards: [] };

  const data = loadXpData();
  const oldLevel = data.level;
  data.xp += amount;
  data.totalXp += amount;

  const levelUpRewards: LevelUpReward[] = [];

  // 레벨업 반복 (한번에 여러 레벨 올라갈 수 있음)
  while (data.level < MAX_LEVEL) {
    const required = xpRequiredForLevel(data.level + 1);
    if (data.xp < required) break;
    data.xp -= required;
    data.level += 1;

    // 레벨업 보상
    const reward = getLevelUpReward(data.level);
    levelUpRewards.push(reward);

    // 조각 지급
    if (reward.fragments > 0) {
      addFragments(reward.fragments);
    }

    // 배지 지급
    if (reward.badge && !data.badges.includes(reward.badge.id)) {
      data.badges.push(reward.badge.id);
    }

    // 특별 보상 추가 (나중에 UI에서 처리)
    if (reward.special) {
      data.pendingSpecialRewards.push(reward.special);
    }
  }

  // Max level 도달 시 초과 XP 버림
  if (data.level >= MAX_LEVEL) {
    data.xp = 0;
  }

  saveXpData(data);
  addXpLogEntry(source, amount);

  const result: XpGainResult = {
    xpGained: amount,
    source,
    newLevel: data.level,
    leveledUp: data.level > oldLevel,
    levelUpRewards,
  };

  // 이벤트 발행
  gameEventBus.emit('XP_GAINED', { amount, source, newLevel: data.level });
  if (result.leveledUp) {
    for (const reward of levelUpRewards) {
      gameEventBus.emit('LEVEL_UP', {
        level: reward.level,
        fragments: reward.fragments,
        badge: reward.badge,
        special: reward.special,
      });
    }
  }

  return result;
}

// ====== 공개 API — XP 소스별 함수 ======

/** 일일 미션 완료 시 호출 */
export function grantXpDailyMission(): XpGainResult {
  return addXp(XP_DAILY_MISSION, 'daily_mission');
}

/** 주간 미션 완료 시 호출 */
export function grantXpWeeklyMission(): XpGainResult {
  return addXp(XP_WEEKLY_MISSION, 'weekly_mission');
}

/** 주간 이벤트 참여 시 호출 (주 1회만 인정) */
export function grantXpWeeklyEvent(): XpGainResult {
  const data = loadXpData();
  // 이번 주 이미 수령했는지 확인
  const now = getServerAdjustedNow();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // ISO 8601 주차 계산 (KST 기준)
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekKey = `${isoYear}-W${weekNum}`;

  if (data.eventXpClaimedWeeks.includes(weekKey)) {
    return { xpGained: 0, source: 'event', newLevel: data.level, leveledUp: false, levelUpRewards: [] };
  }

  data.eventXpClaimedWeeks.push(weekKey);
  saveXpData(data);
  return addXp(XP_WEEKLY_EVENT, 'event');
}

/** 출석 보너스 XP (연속일수 × 1, 최대 10) */
export function grantXpStreak(streakDays: number): XpGainResult {
  const amount = Math.min(streakDays * XP_STREAK_MULTIPLIER, XP_STREAK_MAX);
  if (amount <= 0) return { xpGained: 0, source: 'streak', newLevel: loadXpData().level, leveledUp: false, levelUpRewards: [] };
  return addXp(amount, 'streak');
}

/** 2048 타일 생성 시 호출 */
export function grantXpTile2048(): XpGainResult {
  return addXp(XP_TILE_2048, 'tile_2048');
}

/** 스킨 획득 시 호출 */
export function grantXpSkinAcquired(): XpGainResult {
  return addXp(XP_SKIN_ACQUIRED, 'skin');
}

/** 게임 1회 완료 시 호출 */
export function grantXpGameComplete(): XpGainResult {
  return addXp(XP_GAME_COMPLETE, 'game_complete');
}

// ====== 읽기 전용 API ======

/** 현재 레벨/XP/진행률 정보 */
export interface XpProgress {
  level: number;
  xp: number;
  xpRequired: number;
  progressPercent: number;
  totalXp: number;
  seasonId: string;
  isMaxLevel: boolean;
}

export function getXpProgress(): XpProgress {
  const data = loadXpData();
  const xpRequired = data.level < MAX_LEVEL ? xpRequiredForLevel(data.level + 1) : 0;
  const progressPercent = xpRequired > 0 ? Math.min(100, Math.floor((data.xp / xpRequired) * 100)) : 100;
  return {
    level: data.level,
    xp: data.xp,
    xpRequired,
    progressPercent,
    totalXp: data.totalXp,
    seasonId: data.seasonId,
    isMaxLevel: data.level >= MAX_LEVEL,
  };
}

/** 명예 레벨 기록 조회 */
export function getHonorLevels(): Record<string, number> {
  return loadXpData().honorLevels;
}

/** 획득한 레벨 배지 목록 */
export function getLevelBadges(): LevelBadge[] {
  const data = loadXpData();
  return LEVEL_BADGES.filter(b => data.badges.includes(b.id));
}

/** 미수령 특별 보상 조회 */
export function getPendingSpecialRewards(): string[] {
  return loadXpData().pendingSpecialRewards;
}

/** 특별 보상 수령 처리 */
export function claimSpecialReward(rewardType: string): boolean {
  const data = loadXpData();
  const idx = data.pendingSpecialRewards.indexOf(rewardType);
  if (idx === -1) return false;
  data.pendingSpecialRewards.splice(idx, 1);
  saveXpData(data);
  return true;
}

/** 오늘 XP 획득 로그 */
export function getTodayXpLog(): XpLogEntry[] {
  const today = getKstDateString();
  const log = loadXpLog();
  return log.entries.filter(e => e.dateStr === today);
}

/** 최근 7일 일별 XP 합산 */
export function getWeeklyXpSummary(): { date: string; total: number }[] {
  const log = loadXpLog();
  const map = new Map<string, number>();
  for (const entry of log.entries) {
    map.set(entry.dateStr, (map.get(entry.dateStr) ?? 0) + entry.amount);
  }
  // 최근 7일 정렬
  const today = getServerAdjustedNow();
  const result: { date: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() + 9 * 60 * 60 * 1000 - i * 24 * 60 * 60 * 1000);
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    result.push({ date: dateStr, total: map.get(dateStr) ?? 0 });
  }
  return result;
}

// ====== 이벤트 버스 자동 구독 (초기화 시 1회 호출) ======

let _initialized = false;

/**
 * XP 추적 초기화 — 앱 시작 시 1회 호출.
 * 이벤트 버스의 MISSION_COMPLETED, GAME_OVER, TILE_CREATED 등에 구독하여
 * 자동으로 XP를 지급합니다.
 */
export function initXpTracking(): void {
  if (_initialized) return;
  _initialized = true;

  // 미션 완료 → XP
  gameEventBus.on('MISSION_COMPLETED', (info) => {
    if (info.isDaily) {
      grantXpDailyMission();
    } else {
      grantXpWeeklyMission();
    }
  });

  // 2048 타일 생성 → XP
  gameEventBus.on('TILE_CREATED', (data) => {
    if (data.value === 2048) {
      grantXpTile2048();
    }
  });

  // 게임 완료 → XP
  gameEventBus.on('GAME_OVER', () => {
    grantXpGameComplete();
  });
}
