/**
 * 게임 상태 영속성 서비스
 * 
 * 기능:
 * - 진행중인 게임 상태를 localStorage에 저장
 * - 앱 재시작 시 게임 상태 복원
 * - 앱을 껐다 켜도, 홈화면에 갔다 와도 게임 이어하기 가능
 */

import { Grid, Piece, Phase, BoardSize, GameState } from '../types';

// 로컬 스토리지 키
const GAME_STATE_STORAGE_KEY = 'slidemino_game_state_v1';

/**
 * 저장되는 게임 상태 인터페이스
 */
export interface SavedGameState {
    version: 1;
    gameState: GameState;
    grid: Grid;
    slots: (Piece | null)[];
    score: number;
    phase: Phase;
    boardSize: BoardSize;
    canSkipSlide: boolean;
    undoRemaining: number;
    hasUsedRevive?: boolean;
    sessionId?: string;
    moveCount?: number;
    startedAt?: number;
    playerName?: string;
    savedAt: number; // timestamp
}

/**
 * 현재 진행중인 게임 상태를 저장합니다.
 */
export function saveGameState(state: Omit<SavedGameState, 'version' | 'savedAt'>): void {
    try {
        const savedState: SavedGameState = {
            ...state,
            version: 1,
            savedAt: Date.now(),
        };
        localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(savedState));
    } catch (e) {
        console.warn('[GameStorage] 게임 저장 실패:', e);
    }
}

/**
 * 저장된 게임 상태를 불러옵니다.
 * 진행중인 게임이 없거나 데이터가 손상된 경우 null 반환.
 */
export function loadGameState(): SavedGameState | null {
    try {
        const raw = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as SavedGameState;

        // 버전 체크
        if (parsed.version !== 1) return null;

        // 필수 필드 검증
        if (
            typeof parsed.gameState !== 'string' ||
            !Array.isArray(parsed.grid) ||
            !Array.isArray(parsed.slots) ||
            typeof parsed.score !== 'number' ||
            typeof parsed.phase !== 'string' ||
            typeof parsed.boardSize !== 'number'
        ) {
            console.warn('[GameStorage] 저장된 데이터 형식 오류');
            return null;
        }

        // 게임 오버 상태나 메뉴 상태는 복원할 필요 없음
        if (parsed.gameState !== GameState.PLAYING) {
            return null;
        }

        const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined;
        const moveCount = typeof parsed.moveCount === 'number' ? parsed.moveCount : undefined;
        const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : undefined;
        const playerName = typeof parsed.playerName === 'string' ? parsed.playerName : undefined;
        const hasUsedRevive = typeof parsed.hasUsedRevive === 'boolean' ? parsed.hasUsedRevive : undefined;

        return { ...parsed, sessionId, moveCount, startedAt, playerName, hasUsedRevive };
    } catch (e) {
        console.warn('[GameStorage] 게임 로드 실패:', e);
        return null;
    }
}

/**
 * 저장된 게임 상태를 삭제합니다 (게임 오버 또는 새 게임 시작 시).
 */
export function clearGameState(): void {
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEY);
    } catch (e) {
        console.warn('[GameStorage] 게임 삭제 실패:', e);
    }
}

/**
 * 진행중인 게임이 있는지 확인합니다.
 */
export function hasActiveGame(): boolean {
    return loadGameState() !== null;
}
