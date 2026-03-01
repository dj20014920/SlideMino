/**
 * 일일/주간 미션 시스템
 *
 * - 하루 3개 미션 (쉬움·보통·어려움), 00:00 KST 리셋
 * - 주간 3개 미션 (쉬움·보통·어려움), 매주 월요일 00:00 KST 리셋
 * - 미션 풀 60개 (난이도별 20개)
 * - 보상: 일일 1/1/1 + 보너스 3, 주간 3/5/8 조각
 * - 하루 1회 무료 미션 다시굴리기
 * - 이벤트 버스 구독으로 자동 추적
 */

import type { ShapeType } from '../types';
import { gameEventBus, type GameEventMap } from './gameEventBus';
import { addFragments } from './skinService';
import { mulberry32 } from './prng';
import { getKstDateString } from './streakService';

// ====== 상수 ======

const STORAGE_KEY = 'slidemino.missions.v1';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 미션 보상 조각 수
const DAILY_REWARD_EASY = 1;
const DAILY_REWARD_MEDIUM = 1;
const DAILY_REWARD_HARD = 1;
const DAILY_BONUS_ALL_COMPLETE = 3;
const WEEKLY_REWARD_EASY = 3;
const WEEKLY_REWARD_MEDIUM = 5;
const WEEKLY_REWARD_HARD = 8;

// ====== 미션 추적 타입 ======

export type MissionTrackingType =
  | 'SCORE_ACCUMULATE'        // 누적 점수 N 달성
  | 'BLOCK_TYPE_COUNT'        // 특정 블록 N번 배치
  | 'SLIDE_COUNT'             // 슬라이드 N번
  | 'SUBMIT_RANKING'          // 랭킹 반영 N번
  | 'SHARE_SCORE'             // 점수 공유 N번
  | 'MERGE_SIMULTANEOUS'      // 한 슬라이드에서 N개 동시 병합
  | 'TILE_VALUE_CREATE'       // N 값 타일 생성
  | 'NO_ROTATION_CONSECUTIVE' // 회전 없이 N개 연속 배치
  | 'NO_TOOLS_SCORE'          // 도구 미사용으로 N점 달성 (단일 게임)
  | 'GAME_COMPLETE'           // 게임 N판 완료
  | 'BLOCK_PLACE_COUNT'       // 블록 총 N개 배치
  | 'SLIDE_ALL_DIRECTIONS';   // 4방향 모두 슬라이드

export type MissionDifficulty = 'easy' | 'medium' | 'hard';

// ====== 미션 정의 ======

export interface MissionDefinition {
  id: string;
  difficulty: MissionDifficulty;
  type: MissionTrackingType;
  target: number;
  /** 블록 타입 (BLOCK_TYPE_COUNT 전용) */
  param?: string;
  /** i18n 키 (game:missions.pool.{id}) */
  nameKey: string;
  /** 충돌 그룹: 같은 그룹 미션이 동시에 출현하지 않음 */
  conflictGroup: string;
}

/** 진행 중인 미션 상태 */
export interface ActiveMission {
  definitionId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

/** 미션 완료 알림 정보 */
export interface MissionCompleteInfo {
  definitionId: string;
  nameKey: string;
  isDaily: boolean;
  fragmentReward: number;
}

/** 미션 진행도 알림 정보 (점수 미션의 "남은 점수" 표시) */
export interface MissionProgressInfo {
  definitionId: string;
  nameKey: string;
  current: number;
  target: number;
  remaining: number;
}

// ====== 미션 풀 (60개) ======

const MISSION_POOL: readonly MissionDefinition[] = [
  // ─── 쉬움 (20개) ───
  { id: 'e_score_300',   difficulty: 'easy', type: 'SCORE_ACCUMULATE',   target: 300,  nameKey: 'game:missions.pool.e_score_300',   conflictGroup: 'score' },
  { id: 'e_score_500',   difficulty: 'easy', type: 'SCORE_ACCUMULATE',   target: 500,  nameKey: 'game:missions.pool.e_score_500',   conflictGroup: 'score' },
  { id: 'e_score_1000',  difficulty: 'easy', type: 'SCORE_ACCUMULATE',   target: 1000, nameKey: 'game:missions.pool.e_score_1000',  conflictGroup: 'score' },
  { id: 'e_block_i_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'I', nameKey: 'game:missions.pool.e_block_i_3',   conflictGroup: 'block_i' },
  { id: 'e_block_o_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'O', nameKey: 'game:missions.pool.e_block_o_3',   conflictGroup: 'block_o' },
  { id: 'e_block_t_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'T', nameKey: 'game:missions.pool.e_block_t_3',   conflictGroup: 'block_t' },
  { id: 'e_block_s_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'S', nameKey: 'game:missions.pool.e_block_s_3',   conflictGroup: 'block_s' },
  { id: 'e_block_z_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'Z', nameKey: 'game:missions.pool.e_block_z_3',   conflictGroup: 'block_z' },
  { id: 'e_block_j_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'J', nameKey: 'game:missions.pool.e_block_j_3',   conflictGroup: 'block_j' },
  { id: 'e_block_l_3',   difficulty: 'easy', type: 'BLOCK_TYPE_COUNT',   target: 3, param: 'L', nameKey: 'game:missions.pool.e_block_l_3',   conflictGroup: 'block_l' },
  { id: 'e_slide_10',    difficulty: 'easy', type: 'SLIDE_COUNT',        target: 10, nameKey: 'game:missions.pool.e_slide_10',    conflictGroup: 'slide_count' },
  { id: 'e_slide_15',    difficulty: 'easy', type: 'SLIDE_COUNT',        target: 15, nameKey: 'game:missions.pool.e_slide_15',    conflictGroup: 'slide_count' },
  { id: 'e_submit',      difficulty: 'easy', type: 'SUBMIT_RANKING',     target: 1,  nameKey: 'game:missions.pool.e_submit',      conflictGroup: 'submit' },
  { id: 'e_share',       difficulty: 'easy', type: 'SHARE_SCORE',        target: 1,  nameKey: 'game:missions.pool.e_share',       conflictGroup: 'share' },
  { id: 'e_game_1',      difficulty: 'easy', type: 'GAME_COMPLETE',      target: 1,  nameKey: 'game:missions.pool.e_game_1',      conflictGroup: 'game_complete' },
  { id: 'e_game_2',      difficulty: 'easy', type: 'GAME_COMPLETE',      target: 2,  nameKey: 'game:missions.pool.e_game_2',      conflictGroup: 'game_complete' },
  { id: 'e_place_10',    difficulty: 'easy', type: 'BLOCK_PLACE_COUNT',  target: 10, nameKey: 'game:missions.pool.e_place_10',    conflictGroup: 'place_count' },
  { id: 'e_place_15',    difficulty: 'easy', type: 'BLOCK_PLACE_COUNT',  target: 15, nameKey: 'game:missions.pool.e_place_15',    conflictGroup: 'place_count' },
  { id: 'e_all_dirs',    difficulty: 'easy', type: 'SLIDE_ALL_DIRECTIONS', target: 1, nameKey: 'game:missions.pool.e_all_dirs',   conflictGroup: 'all_dirs' },
  { id: 'e_tile_16',     difficulty: 'easy', type: 'TILE_VALUE_CREATE',  target: 16, nameKey: 'game:missions.pool.e_tile_16',     conflictGroup: 'tile_value' },

  // ─── 보통 (20개) ───
  { id: 'm_tile_256',    difficulty: 'medium', type: 'TILE_VALUE_CREATE',    target: 256,  nameKey: 'game:missions.pool.m_tile_256',    conflictGroup: 'tile_value' },
  { id: 'm_tile_128',    difficulty: 'medium', type: 'TILE_VALUE_CREATE',    target: 128,  nameKey: 'game:missions.pool.m_tile_128',    conflictGroup: 'tile_value' },
  { id: 'm_tile_64',     difficulty: 'medium', type: 'TILE_VALUE_CREATE',    target: 64,   nameKey: 'game:missions.pool.m_tile_64',     conflictGroup: 'tile_value' },
  { id: 'm_merge_2',     difficulty: 'medium', type: 'MERGE_SIMULTANEOUS',   target: 2,    nameKey: 'game:missions.pool.m_merge_2',     conflictGroup: 'merge_sim' },
  { id: 'm_score_3000',  difficulty: 'medium', type: 'SCORE_ACCUMULATE',     target: 3000, nameKey: 'game:missions.pool.m_score_3000',  conflictGroup: 'score' },
  { id: 'm_score_5000',  difficulty: 'medium', type: 'SCORE_ACCUMULATE',     target: 5000, nameKey: 'game:missions.pool.m_score_5000',  conflictGroup: 'score' },
  { id: 'm_score_7000',  difficulty: 'medium', type: 'SCORE_ACCUMULATE',     target: 7000, nameKey: 'game:missions.pool.m_score_7000',  conflictGroup: 'score' },
  { id: 'm_no_rot_3',    difficulty: 'medium', type: 'NO_ROTATION_CONSECUTIVE', target: 3, nameKey: 'game:missions.pool.m_no_rot_3',   conflictGroup: 'no_rot' },
  { id: 'm_no_rot_5',    difficulty: 'medium', type: 'NO_ROTATION_CONSECUTIVE', target: 5, nameKey: 'game:missions.pool.m_no_rot_5',   conflictGroup: 'no_rot' },
  { id: 'm_block_t_5',   difficulty: 'medium', type: 'BLOCK_TYPE_COUNT',     target: 5, param: 'T', nameKey: 'game:missions.pool.m_block_t_5',  conflictGroup: 'block_t' },
  { id: 'm_block_i_5',   difficulty: 'medium', type: 'BLOCK_TYPE_COUNT',     target: 5, param: 'I', nameKey: 'game:missions.pool.m_block_i_5',  conflictGroup: 'block_i' },
  { id: 'm_block_o_5',   difficulty: 'medium', type: 'BLOCK_TYPE_COUNT',     target: 5, param: 'O', nameKey: 'game:missions.pool.m_block_o_5',  conflictGroup: 'block_o' },
  { id: 'm_block_s_5',   difficulty: 'medium', type: 'BLOCK_TYPE_COUNT',     target: 5, param: 'S', nameKey: 'game:missions.pool.m_block_s_5',  conflictGroup: 'block_s' },
  { id: 'm_block_j_5',   difficulty: 'medium', type: 'BLOCK_TYPE_COUNT',     target: 5, param: 'J', nameKey: 'game:missions.pool.m_block_j_5',  conflictGroup: 'block_j' },
  { id: 'm_block_l_5',   difficulty: 'medium', type: 'BLOCK_TYPE_COUNT',     target: 5, param: 'L', nameKey: 'game:missions.pool.m_block_l_5',  conflictGroup: 'block_l' },
  { id: 'm_place_30',    difficulty: 'medium', type: 'BLOCK_PLACE_COUNT',    target: 30, nameKey: 'game:missions.pool.m_place_30',   conflictGroup: 'place_count' },
  { id: 'm_place_40',    difficulty: 'medium', type: 'BLOCK_PLACE_COUNT',    target: 40, nameKey: 'game:missions.pool.m_place_40',   conflictGroup: 'place_count' },
  { id: 'm_slide_30',    difficulty: 'medium', type: 'SLIDE_COUNT',          target: 30, nameKey: 'game:missions.pool.m_slide_30',   conflictGroup: 'slide_count' },
  { id: 'm_slide_50',    difficulty: 'medium', type: 'SLIDE_COUNT',          target: 50, nameKey: 'game:missions.pool.m_slide_50',   conflictGroup: 'slide_count' },
  { id: 'm_game_3',      difficulty: 'medium', type: 'GAME_COMPLETE',        target: 3,  nameKey: 'game:missions.pool.m_game_3',     conflictGroup: 'game_complete' },

  // ─── 어려움 (20개) ───
  { id: 'h_tile_512',      difficulty: 'hard', type: 'TILE_VALUE_CREATE',      target: 512,   nameKey: 'game:missions.pool.h_tile_512',      conflictGroup: 'tile_value' },
  { id: 'h_tile_1024',     difficulty: 'hard', type: 'TILE_VALUE_CREATE',      target: 1024,  nameKey: 'game:missions.pool.h_tile_1024',     conflictGroup: 'tile_value' },
  { id: 'h_tile_2048',     difficulty: 'hard', type: 'TILE_VALUE_CREATE',      target: 2048,  nameKey: 'game:missions.pool.h_tile_2048',     conflictGroup: 'tile_value' },
  { id: 'h_merge_3',       difficulty: 'hard', type: 'MERGE_SIMULTANEOUS',     target: 3,     nameKey: 'game:missions.pool.h_merge_3',       conflictGroup: 'merge_sim' },
  { id: 'h_merge_4',       difficulty: 'hard', type: 'MERGE_SIMULTANEOUS',     target: 4,     nameKey: 'game:missions.pool.h_merge_4',       conflictGroup: 'merge_sim' },
  { id: 'h_score_10000',   difficulty: 'hard', type: 'SCORE_ACCUMULATE',       target: 10000, nameKey: 'game:missions.pool.h_score_10000',   conflictGroup: 'score' },
  { id: 'h_score_15000',   difficulty: 'hard', type: 'SCORE_ACCUMULATE',       target: 15000, nameKey: 'game:missions.pool.h_score_15000',   conflictGroup: 'score' },
  { id: 'h_score_20000',   difficulty: 'hard', type: 'SCORE_ACCUMULATE',       target: 20000, nameKey: 'game:missions.pool.h_score_20000',   conflictGroup: 'score' },
  { id: 'h_score_25000',   difficulty: 'hard', type: 'SCORE_ACCUMULATE',       target: 25000, nameKey: 'game:missions.pool.h_score_25000',   conflictGroup: 'score' },
  { id: 'h_score_30000',   difficulty: 'hard', type: 'SCORE_ACCUMULATE',       target: 30000, nameKey: 'game:missions.pool.h_score_30000',   conflictGroup: 'score' },
  { id: 'h_no_tools_5000', difficulty: 'hard', type: 'NO_TOOLS_SCORE',         target: 5000,  nameKey: 'game:missions.pool.h_no_tools_5000', conflictGroup: 'no_tools' },
  { id: 'h_no_tools_10000',difficulty: 'hard', type: 'NO_TOOLS_SCORE',         target: 10000, nameKey: 'game:missions.pool.h_no_tools_10000',conflictGroup: 'no_tools' },
  { id: 'h_no_tools_15000',difficulty: 'hard', type: 'NO_TOOLS_SCORE',         target: 15000, nameKey: 'game:missions.pool.h_no_tools_15000',conflictGroup: 'no_tools' },
  { id: 'h_no_rot_10',     difficulty: 'hard', type: 'NO_ROTATION_CONSECUTIVE',target: 10,    nameKey: 'game:missions.pool.h_no_rot_10',     conflictGroup: 'no_rot' },
  { id: 'h_place_50',      difficulty: 'hard', type: 'BLOCK_PLACE_COUNT',      target: 50,    nameKey: 'game:missions.pool.h_place_50',      conflictGroup: 'place_count' },
  { id: 'h_slide_80',      difficulty: 'hard', type: 'SLIDE_COUNT',            target: 80,    nameKey: 'game:missions.pool.h_slide_80',      conflictGroup: 'slide_count' },
  { id: 'h_slide_100',     difficulty: 'hard', type: 'SLIDE_COUNT',            target: 100,   nameKey: 'game:missions.pool.h_slide_100',     conflictGroup: 'slide_count' },
  { id: 'h_game_5',        difficulty: 'hard', type: 'GAME_COMPLETE',          target: 5,     nameKey: 'game:missions.pool.h_game_5',        conflictGroup: 'game_complete' },
  { id: 'h_block_i_10',    difficulty: 'hard', type: 'BLOCK_TYPE_COUNT',       target: 10, param: 'I', nameKey: 'game:missions.pool.h_block_i_10', conflictGroup: 'block_i' },
  { id: 'h_block_t_10',    difficulty: 'hard', type: 'BLOCK_TYPE_COUNT',       target: 10, param: 'T', nameKey: 'game:missions.pool.h_block_t_10', conflictGroup: 'block_t' },
];

// 난이도별 풀 캐시
const EASY_POOL = MISSION_POOL.filter(m => m.difficulty === 'easy');
const MEDIUM_POOL = MISSION_POOL.filter(m => m.difficulty === 'medium');
const HARD_POOL = MISSION_POOL.filter(m => m.difficulty === 'hard');

// ====== 저장 데이터 구조 ======

interface MissionState {
  version: 1;
  // 일일 미션
  dailyDate: string;             // "YYYY-MM-DD" (KST)
  dailyMissions: ActiveMission[];
  dailyRerollUsed: boolean;
  dailyBonusClaimed: boolean;
  // 주간 미션
  weekStartDate: string;         // 주 시작 월요일 "YYYY-MM-DD" (KST)
  weeklyMissions: ActiveMission[];
  // 게임 세션 추적 (per-game 상태)
  gameSessionActive: boolean;
  gameNoUndo: boolean;
  gameNoRefresh: boolean;
  gameNoRotation: boolean;
  gameScore: number;
  consecutiveNoRotation: number;
  slideDirectionsUsed: string[];
}

const DEFAULT_STATE: MissionState = {
  version: 1,
  dailyDate: '',
  dailyMissions: [],
  dailyRerollUsed: false,
  dailyBonusClaimed: false,
  weekStartDate: '',
  weeklyMissions: [],
  gameSessionActive: false,
  gameNoUndo: true,
  gameNoRefresh: true,
  gameNoRotation: true,
  gameScore: 0,
  consecutiveNoRotation: 0,
  slideDirectionsUsed: [],
};

// ====== 유틸 함수 ======

/** KST 기준 이번 주 월요일 날짜 문자열 반환 */
function getKstMondayString(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const dayOfWeek = kst.getUTCDay(); // 0=일, 1=월, ..., 6=토
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(kst.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 날짜 문자열을 시드 정수로 변환 */
function dateToSeed(dateStr: string): number {
  const num = parseInt(dateStr.replace(/-/g, ''), 10);
  return (num * 2654435761) >>> 0; // Knuth 해시
}

/** 시드 기반으로 난이도별 미션 3개 선택 (충돌 그룹 고려) */
function selectMissions(seed: number): string[] {
  const rng = mulberry32(seed);
  const usedConflictGroups = new Set<string>();

  const pick = (pool: readonly MissionDefinition[]): string => {
    // 충돌 그룹 필터링
    const candidates = pool.filter(m => !usedConflictGroups.has(m.conflictGroup));
    if (candidates.length === 0) return pool[0].id; // 안전장치
    const idx = Math.floor(rng() * candidates.length);
    const selected = candidates[idx];
    usedConflictGroups.add(selected.conflictGroup);
    return selected.id;
  };

  return [pick(EASY_POOL), pick(MEDIUM_POOL), pick(HARD_POOL)];
}

/** 미션 정의 조회 */
export function getMissionDefinition(id: string): MissionDefinition | undefined {
  return MISSION_POOL.find(m => m.id === id);
}

// ====== 상태 로드/저장 ======

let state: MissionState = { ...DEFAULT_STATE };

function loadState(): MissionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return { ...DEFAULT_STATE };
    return {
      ...DEFAULT_STATE,
      ...parsed,
      // 배열 필드 안전 보장
      dailyMissions: Array.isArray(parsed.dailyMissions) ? parsed.dailyMissions : [],
      weeklyMissions: Array.isArray(parsed.weeklyMissions) ? parsed.weeklyMissions : [],
      slideDirectionsUsed: Array.isArray(parsed.slideDirectionsUsed) ? parsed.slideDirectionsUsed : [],
    } as MissionState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패 무시 (private mode 등)
  }
}

// ====== 날짜 전환 감지 & 미션 생성 ======

/** 현재 날짜/주에 맞게 미션을 갱신하고, 새 미션이면 생성 */
function ensureMissionsUpToDate(): void {
  const today = getKstDateString();
  const monday = getKstMondayString();

  // 일일 미션 갱신
  if (state.dailyDate !== today) {
    const seed = dateToSeed(today);
    const ids = selectMissions(seed);
    state.dailyDate = today;
    state.dailyMissions = ids.map(id => ({
      definitionId: id,
      progress: 0,
      completed: false,
      claimed: false,
    }));
    state.dailyRerollUsed = false;
    state.dailyBonusClaimed = false;
  }

  // 주간 미션 갱신
  if (state.weekStartDate !== monday) {
    const seed = dateToSeed(monday) + 7777; // 일일과 다른 시드
    const ids = selectMissions(seed);
    state.weekStartDate = monday;
    state.weeklyMissions = ids.map(id => ({
      definitionId: id,
      progress: 0,
      completed: false,
      claimed: false,
    }));
  }

  saveState();
}

// ====== 미션 진행도 업데이트 핵심 로직 ======

/** 미션 1개의 진행도를 업데이트하고, 새로 완료되었으면 true 반환 */
function updateMissionProgress(
  mission: ActiveMission,
  type: MissionTrackingType,
  amount: number,
  param?: string,
): boolean {
  if (mission.completed) return false;
  const def = getMissionDefinition(mission.definitionId);
  if (!def || def.type !== type) return false;

  // 블록 타입 미션은 param이 일치해야 함
  if (def.type === 'BLOCK_TYPE_COUNT' && def.param !== param) return false;

  // 누적형 미션: 진행도에 amount 추가
  if (['SCORE_ACCUMULATE', 'BLOCK_TYPE_COUNT', 'SLIDE_COUNT', 'SUBMIT_RANKING',
       'SHARE_SCORE', 'GAME_COMPLETE', 'BLOCK_PLACE_COUNT'].includes(type)) {
    mission.progress = Math.min(mission.progress + amount, def.target);
  }

  // 최대값형 미션: 현재 값과 비교하여 큰 값 유지
  if (['MERGE_SIMULTANEOUS', 'TILE_VALUE_CREATE'].includes(type)) {
    mission.progress = Math.max(mission.progress, amount);
  }

  // 연속형: 외부에서 관리하는 값을 직접 설정
  if (['NO_ROTATION_CONSECUTIVE'].includes(type)) {
    mission.progress = Math.max(mission.progress, amount);
  }

  // 도구 미사용 점수: 외부에서 관리
  if (type === 'NO_TOOLS_SCORE') {
    mission.progress = Math.max(mission.progress, amount);
  }

  // 4방향 슬라이드: 외부에서 관리
  if (type === 'SLIDE_ALL_DIRECTIONS') {
    mission.progress = Math.max(mission.progress, amount);
  }

  // 완료 체크
  if (mission.progress >= def.target && !mission.completed) {
    mission.completed = true;
    return true;
  }
  return false;
}

/** 모든 활성 미션에 대해 진행도를 업데이트하고, 완료된 미션 알림 목록 반환 */
function processUpdate(
  type: MissionTrackingType,
  amount: number,
  param?: string,
): MissionCompleteInfo[] {
  ensureMissionsUpToDate();
  const completedList: MissionCompleteInfo[] = [];

  // 일일 미션 처리
  for (const mission of state.dailyMissions) {
    const justCompleted = updateMissionProgress(mission, type, amount, param);
    if (justCompleted) {
      const def = getMissionDefinition(mission.definitionId)!;
      completedList.push({
        definitionId: def.id,
        nameKey: def.nameKey,
        isDaily: true,
        fragmentReward: getReward(def.difficulty, true),
      });
    }
  }

  // 주간 미션 처리
  for (const mission of state.weeklyMissions) {
    const justCompleted = updateMissionProgress(mission, type, amount, param);
    if (justCompleted) {
      const def = getMissionDefinition(mission.definitionId)!;
      completedList.push({
        definitionId: def.id,
        nameKey: def.nameKey,
        isDaily: false,
        fragmentReward: getReward(def.difficulty, false),
      });
    }
  }

  saveState();
  return completedList;
}

/** 난이도별 보상 조각 수 반환 */
function getReward(difficulty: MissionDifficulty, isDaily: boolean): number {
  if (isDaily) {
    switch (difficulty) {
      case 'easy': return DAILY_REWARD_EASY;
      case 'medium': return DAILY_REWARD_MEDIUM;
      case 'hard': return DAILY_REWARD_HARD;
    }
  }
  switch (difficulty) {
    case 'easy': return WEEKLY_REWARD_EASY;
    case 'medium': return WEEKLY_REWARD_MEDIUM;
    case 'hard': return WEEKLY_REWARD_HARD;
  }
}

// ====== 이벤트 버스 구독 (자동 추적) ======

let subscribed = false;
const unsubscribers: (() => void)[] = [];

/** 이벤트 버스 구독을 시작하여 미션 자동 추적 활성화 */
export function initMissionTracking(): void {
  if (subscribed) return;
  subscribed = true;

  state = loadState();
  ensureMissionsUpToDate();

  // 게임 시작: per-game 상태 리셋
  unsubscribers.push(
    gameEventBus.on('GAME_STARTED', () => {
      state.gameSessionActive = true;
      state.gameNoUndo = true;
      state.gameNoRefresh = true;
      state.gameNoRotation = true;
      state.gameScore = 0;
      state.consecutiveNoRotation = 0;
      state.slideDirectionsUsed = [];
      saveState();
    })
  );

  // 블록 배치
  unsubscribers.push(
    gameEventBus.on('BLOCK_PLACED', (data) => {
      // 1) 블록 타입 카운트
      const completed1 = processUpdate('BLOCK_TYPE_COUNT', 1, data.pieceType);
      // 2) 전체 블록 배치 카운트
      const completed2 = processUpdate('BLOCK_PLACE_COUNT', 1);

      // 3) 회전 연속 추적 (initialRotation과 비교하여 유저가 실제 회전했는지 판정)
      const wasRotated = data.rotation !== data.initialRotation;
      if (!wasRotated) {
        state.consecutiveNoRotation += 1;
      } else {
        state.consecutiveNoRotation = 0;
        state.gameNoRotation = false;
      }
      const completed3 = processUpdate('NO_ROTATION_CONSECUTIVE', state.consecutiveNoRotation);

      emitCompletions([...completed1, ...completed2, ...completed3]);
      saveState();
    })
  );

  // 슬라이드 수행
  unsubscribers.push(
    gameEventBus.on('SLIDE_PERFORMED', (data) => {
      // 1) 슬라이드 카운트
      const completed1 = processUpdate('SLIDE_COUNT', 1);

      // 2) 동시 병합 수
      const completed2 = data.mergeCount > 0
        ? processUpdate('MERGE_SIMULTANEOUS', data.mergeCount)
        : [];

      // 3) 4방향 추적
      if (!state.slideDirectionsUsed.includes(data.direction)) {
        state.slideDirectionsUsed.push(data.direction);
      }
      const dirCount = state.slideDirectionsUsed.length;
      const completed3 = dirCount >= 4 ? processUpdate('SLIDE_ALL_DIRECTIONS', 1) : [];

      // 4) 누적 점수
      if (data.scoreGained > 0) {
        state.gameScore += data.scoreGained;
        const completed4 = processUpdate('SCORE_ACCUMULATE', data.scoreGained);
        emitCompletions([...completed1, ...completed2, ...completed3, ...completed4]);

        // 점수 미션 진행도 알림 (비침습적)
        emitScoreProgress();
      } else {
        emitCompletions([...completed1, ...completed2, ...completed3]);
      }

      // 5) 도구 미사용 점수 (per-game)
      if (state.gameNoUndo && state.gameNoRefresh && state.gameNoRotation) {
        const noToolsComp = processUpdate('NO_TOOLS_SCORE', state.gameScore);
        emitCompletions(noToolsComp);
      }

      saveState();
    })
  );

  // 타일 생성 (슬라이드 시 병합으로 생성된 최대 타일 값)
  unsubscribers.push(
    gameEventBus.on('SCORE_CHANGED', (data) => {
      // SCORE_CHANGED에서는 타일 값 추적만 담당
      // (점수 누적은 SLIDE_PERFORMED에서 이미 처리)
    })
  );

  // 게임 오버
  unsubscribers.push(
    gameEventBus.on('GAME_OVER', () => {
      state.gameSessionActive = false;
      const completed = processUpdate('GAME_COMPLETE', 1);
      emitCompletions(completed);
      saveState();
    })
  );

  // 랭킹 제출
  unsubscribers.push(
    gameEventBus.on('SCORE_SUBMITTED', () => {
      const completed = processUpdate('SUBMIT_RANKING', 1);
      emitCompletions(completed);
    })
  );

  // Undo 사용
  unsubscribers.push(
    gameEventBus.on('UNDO_USED', () => {
      state.gameNoUndo = false;
      saveState();
    })
  );

  // 블록 새로고침 사용
  unsubscribers.push(
    gameEventBus.on('BLOCK_REFRESH_USED', () => {
      state.gameNoRefresh = false;
      saveState();
    })
  );

  // 공유 완료
  unsubscribers.push(
    gameEventBus.on('SHARE_COMPLETED', () => {
      const completed = processUpdate('SHARE_SCORE', 1);
      emitCompletions(completed);
    })
  );

  // 타일 값 생성 (병합 결과)
  unsubscribers.push(
    gameEventBus.on('TILE_CREATED', (data) => {
      const completed = processUpdate('TILE_VALUE_CREATE', data.value);
      emitCompletions(completed);
    })
  );
}

/** 이벤트 버스 구독 해제 */
export function destroyMissionTracking(): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers.length = 0;
  subscribed = false;
}

// ====== 내부 이벤트 발행 ======

/** 미션 완료 이벤트를 이벤트 버스에 발행 */
function emitCompletions(completions: MissionCompleteInfo[]): void {
  for (const info of completions) {
    gameEventBus.emit('MISSION_COMPLETED', info);
  }
}

/** 점수 미션의 잔여 진행도를 비침습적 알림으로 발행 */
function emitScoreProgress(): void {
  const allMissions = [...state.dailyMissions, ...state.weeklyMissions];
  for (const mission of allMissions) {
    if (mission.completed || mission.claimed) continue;
    const def = getMissionDefinition(mission.definitionId);
    if (!def || def.type !== 'SCORE_ACCUMULATE') continue;

    const remaining = def.target - mission.progress;
    if (remaining > 0 && remaining < def.target * 0.8) {
      // 20% 이상 진행되었을 때만 알림
      gameEventBus.emit('MISSION_PROGRESS', {
        definitionId: def.id,
        nameKey: def.nameKey,
        current: mission.progress,
        target: def.target,
        remaining,
      });
    }
  }
}

// ====== 공개 API ======

/** 일일 미션 목록 반환 */
export function getDailyMissions(): ActiveMission[] {
  ensureMissionsUpToDate();
  return [...state.dailyMissions];
}

/** 주간 미션 목록 반환 */
export function getWeeklyMissions(): ActiveMission[] {
  ensureMissionsUpToDate();
  return [...state.weeklyMissions];
}

/** 일일 미션 완료 개수 */
export function getDailyCompletedCount(): number {
  ensureMissionsUpToDate();
  return state.dailyMissions.filter(m => m.completed).length;
}

/** 주간 미션 완료 개수 */
export function getWeeklyCompletedCount(): number {
  ensureMissionsUpToDate();
  return state.weeklyMissions.filter(m => m.completed).length;
}

/** 일일 전체 완료 보너스 수령 가능 여부 */
export function canClaimDailyBonus(): boolean {
  ensureMissionsUpToDate();
  return (
    state.dailyMissions.length === 3 &&
    state.dailyMissions.every(m => m.completed) &&
    !state.dailyBonusClaimed
  );
}

/** 일일 미션 다시굴리기 가능 여부 */
export function canRerollDaily(): boolean {
  ensureMissionsUpToDate();
  return !state.dailyRerollUsed;
}

/** 일일 미션 다시굴리기 (인덱스 0-2) — 같은 난이도 풀에서 새 미션 선택 */
export function rerollDailyMission(index: number): ActiveMission | null {
  ensureMissionsUpToDate();
  if (state.dailyRerollUsed || index < 0 || index >= state.dailyMissions.length) return null;

  const old = state.dailyMissions[index];
  const oldDef = getMissionDefinition(old.definitionId);
  if (!oldDef) return null;

  // 같은 난이도 풀에서 현재 사용 중인 충돌 그룹 제외
  const usedConflictGroups = new Set(
    state.dailyMissions
      .concat(state.weeklyMissions)
      .map(m => getMissionDefinition(m.definitionId)?.conflictGroup)
      .filter((g): g is string => !!g)
  );

  const pool = MISSION_POOL.filter(
    m => m.difficulty === oldDef.difficulty &&
         m.id !== old.definitionId &&
         !usedConflictGroups.has(m.conflictGroup)
  );

  if (pool.length === 0) return null;

  // 랜덤 선택 (시드 기반이 아닌 순수 랜덤 — 다시굴리기니까)
  const newDef = pool[Math.floor(Math.random() * pool.length)];
  state.dailyMissions[index] = {
    definitionId: newDef.id,
    progress: 0,
    completed: false,
    claimed: false,
  };
  state.dailyRerollUsed = true;
  saveState();
  return state.dailyMissions[index];
}

/** 미션 보상 수령 — 조각 지급 후 claimed true로 변경 */
export function claimMissionReward(definitionId: string, isDaily: boolean): number {
  ensureMissionsUpToDate();
  const missions = isDaily ? state.dailyMissions : state.weeklyMissions;
  const mission = missions.find(m => m.definitionId === definitionId);
  if (!mission || !mission.completed || mission.claimed) return 0;

  const def = getMissionDefinition(definitionId);
  if (!def) return 0;

  const reward = getReward(def.difficulty, isDaily);
  mission.claimed = true;
  addFragments(reward);
  saveState();
  return reward;
}

/** 일일 전체 완료 보너스 수령 */
export function claimDailyBonus(): number {
  if (!canClaimDailyBonus()) return 0;
  state.dailyBonusClaimed = true;
  addFragments(DAILY_BONUS_ALL_COMPLETE);
  saveState();
  return DAILY_BONUS_ALL_COMPLETE;
}

/** 모든 미완료 일일 미션 보상을 한번에 수령 */
export function claimAllDailyRewards(): number {
  ensureMissionsUpToDate();
  let total = 0;
  for (const m of state.dailyMissions) {
    if (m.completed && !m.claimed) {
      const def = getMissionDefinition(m.definitionId);
      if (!def) continue;
      const reward = getReward(def.difficulty, true);
      m.claimed = true;
      total += reward;
    }
  }
  // 보너스도 함께
  if (canClaimDailyBonus()) {
    state.dailyBonusClaimed = true;
    total += DAILY_BONUS_ALL_COMPLETE;
  }
  if (total > 0) {
    addFragments(total);
    saveState();
  }
  return total;
}

/** 모든 미완료 주간 미션 보상을 한번에 수령 */
export function claimAllWeeklyRewards(): number {
  ensureMissionsUpToDate();
  let total = 0;
  for (const m of state.weeklyMissions) {
    if (m.completed && !m.claimed) {
      const def = getMissionDefinition(m.definitionId);
      if (!def) continue;
      const reward = getReward(def.difficulty, false);
      m.claimed = true;
      total += reward;
    }
  }
  if (total > 0) {
    addFragments(total);
    saveState();
  }
  return total;
}

/** 미션 전체 상태 새로고침 (날짜 전환 등) */
export function refreshMissions(): void {
  state = loadState();
  ensureMissionsUpToDate();
}

/** 주간 미션 남은 시간 (밀리초) */
export function getWeeklyTimeRemainingMs(): number {
  const now = new Date();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const dayOfWeek = kst.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const nextMonday = new Date(kst.getTime());
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  // KST → UTC 변환
  const nextMondayUtc = new Date(nextMonday.getTime() - KST_OFFSET_MS);
  return Math.max(0, nextMondayUtc.getTime() - now.getTime());
}

/** 일일 미션 남은 시간 (밀리초) */
export function getDailyTimeRemainingMs(): number {
  const now = new Date();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const tomorrow = new Date(kst.getTime());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const tomorrowUtc = new Date(tomorrow.getTime() - KST_OFFSET_MS);
  return Math.max(0, tomorrowUtc.getTime() - now.getTime());
}
