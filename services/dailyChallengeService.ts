/**
 * 데일리 챌린지 서비스
 *
 * 역할:
 * - 서버에서 오늘의 시드 가져오기
 * - 시드 기반 블록 시퀀스 생성 (prng.ts 활용)
 * - 챌린지 점수 제출 / 랭킹 조회
 * - 참여 보상(스킨 조각) 지급
 * - 로컬 상태 관리 (오늘 첫 완료 여부 등)
 */

import { Piece } from '../types';
import { mulberry32, generateSeededPieceData, createPieceFromData } from './prng';
import { getApiUrl } from '../utils/apiUrl';
import { updateServerTimeOffset } from './serverTimeService';
import { getAnalyticsInstallId } from './analyticsService';

// ==========================================
// 타입 정의
// ==========================================

export interface DailyChallengeSeed {
  challengeDate: string;  // YYYYMMDD
  seed: number;
  endsAt: number;         // UTC ms
  boardSize: 5;
}

export interface DailyChallengeSubmitResult {
  success: boolean;
  rank?: number;
  total?: number;
  bestScore?: number;
  bestMoves?: number;
  bestDuration?: number;
  error?: string;
}

export interface DailyChallengeRankEntry {
  name: string;
  score: number;
  moves: number;
  duration: number;
  updatedAt: number;
}

export interface DailyChallengeRankings {
  challengeDate: string;
  rankings: DailyChallengeRankEntry[];
  totalParticipants: number;
  myRecord: { score: number; moves: number; duration: number; rank: number } | null;
}

// ==========================================
// 로컬 저장소 키
// ==========================================

const STORAGE_KEY = 'slidemino.daily_challenge.v1';
const DAILY_CHALLENGE_FIRST_FRAGMENTS = 2;  // 당일 첫 완료 시 조각 보상

interface DailyChallengeLocalState {
  /** 오늘 첫 완료 보상 수령 여부 (날짜별) */
  claimedDates: string[];
  /** 마지막으로 참여한 날짜 */
  lastPlayedDate: string | null;
}

const isOnline = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
};

// ==========================================
// 로컬 상태 관리
// ==========================================

function loadLocalState(): DailyChallengeLocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { claimedDates: [], lastPlayedDate: null };
    const parsed = JSON.parse(raw);
    return {
      claimedDates: Array.isArray(parsed.claimedDates) ? parsed.claimedDates : [],
      lastPlayedDate: typeof parsed.lastPlayedDate === 'string' ? parsed.lastPlayedDate : null,
    };
  } catch {
    return { claimedDates: [], lastPlayedDate: null };
  }
}

function saveLocalState(state: DailyChallengeLocalState): void {
  try {
    // 최근 30일만 보관 (메모리 절약)
    const recent = state.claimedDates.slice(-30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, claimedDates: recent }));
  } catch {
    // localStorage 실패는 무시
  }
}

/** 오늘 첫 완료 보상을 이미 받았는지 확인 */
export function hasClaimedTodayReward(challengeDate: string): boolean {
  const state = loadLocalState();
  return state.claimedDates.includes(challengeDate);
}

/** 오늘 첫 완료 보상 수령 기록 */
export function markTodayRewardClaimed(challengeDate: string): void {
  const state = loadLocalState();
  if (!state.claimedDates.includes(challengeDate)) {
    state.claimedDates.push(challengeDate);
  }
  state.lastPlayedDate = challengeDate;
  saveLocalState(state);
}

/** 첫 완료 시 지급할 조각 수 */
export function getFirstCompletionFragments(): number {
  return DAILY_CHALLENGE_FIRST_FRAGMENTS;
}

// ==========================================
// 시드 기반 블록 시퀀스 생성
// ==========================================

/**
 * 챌린지 시드로부터 N번째 피스를 생성
 * 시퀀스 인덱스 기반이므로 몇 번째 피스든 동일한 시드→동일한 결과
 */
export function generateChallengeSlots(seed: number, startIndex: number, count: number = 3): Piece[] {
  // startIndex까지 PRNG 상태를 진행시킨다
  const rng = mulberry32(seed);
  // 각 피스 생성에 rng를 2번 호출하므로 (type + rotation), startIndex까지 skip
  for (let i = 0; i < startIndex * 2; i++) {
    rng();
  }
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const data = generateSeededPieceData(rng);
    pieces.push(createPieceFromData(data, startIndex + i));
  }
  return pieces;
}

// ==========================================
// 서버 API 호출
// ==========================================

/** 오늘의 챌린지 시드 가져오기 */
export async function fetchDailyChallengeSeed(): Promise<DailyChallengeSeed | null> {
  if (!isOnline()) return null;

  try {
    const url = new URL(getApiUrl('/api/daily-challenge/seed'), window.location.origin);
    url.searchParams.set('_ts', String(Date.now()));
    const response = await fetch(url.toString(), { cache: 'no-store' });
    updateServerTimeOffset(response);
    if (!response.ok) {
      console.error('[DailyChallenge] seed fetch failed:', response.status);
      return null;
    }
    const data = await response.json();
    return data as DailyChallengeSeed;
  } catch (error) {
    console.error('[DailyChallenge] seed fetch error:', error);
    return null;
  }
}

/** 챌린지 점수 제출 */
export async function submitDailyChallengeScore(
  challengeDate: string,
  name: string,
  score: number,
  moves: number,
  duration: number,
  comboCount?: number,
): Promise<DailyChallengeSubmitResult> {
  if (!isOnline()) return { success: false, error: 'offline' };

  try {
    const installId = getAnalyticsInstallId();
    const response = await fetch(getApiUrl('/api/daily-challenge/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeDate,
        name,
        score,
        moves,
        duration,
        installId,
        comboCount: comboCount ?? 0,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
      return {
        success: false,
        error: typeof errorBody.error === 'string' ? errorBody.error : `HTTP ${response.status}`,
      };
    }

    const data = await response.json() as DailyChallengeSubmitResult;
    return data;
  } catch (error) {
    console.error('[DailyChallenge] submit error:', error);
    return { success: false, error: 'network_error' };
  }
}

/** 챌린지 랭킹 조회 */
export async function fetchDailyChallengeRankings(
  challengeDate?: string,
): Promise<DailyChallengeRankings | null> {
  if (!isOnline()) return null;

  try {
    const installId = getAnalyticsInstallId();
    const url = new URL(getApiUrl('/api/daily-challenge/rankings'), window.location.origin);
    if (challengeDate) url.searchParams.set('date', challengeDate);
    url.searchParams.set('installId', installId);
    url.searchParams.set('_ts', String(Date.now()));

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) return null;

    const data = await response.json();
    return data as DailyChallengeRankings;
  } catch (error) {
    console.error('[DailyChallenge] rankings fetch error:', error);
    return null;
  }
}
