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
const GAME_STATE_BACKUP_STORAGE_KEY = 'slidemino_game_state_backup_v1';
const VALID_BOARD_SIZES: BoardSize[] = [4, 5, 7, 8, 10];

export interface StoredUndoSnapshot {
    grid: Grid;
    slots: (Piece | null)[];
    score: number;
    phase: Phase;
    canSkipSlide: boolean;
}

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
    lastSnapshot?: StoredUndoSnapshot | null;
    hasUsedRevive?: boolean;
    isReviveSelectionMode?: boolean;
    reviveBreakRemaining?: number;
    revivePendingTileId?: string | null;
    sessionId?: string;
    moveCount?: number;
    startedAt?: number;
    playerName?: string;
    savedAt: number; // timestamp
}

const parseSavedGameState = (raw: string | null): SavedGameState | null => {
    if (!raw) return null;

    let parsed: SavedGameState;
    try {
        parsed = JSON.parse(raw) as SavedGameState;
    } catch {
        return null;
    }

    // 버전 체크
    if (parsed.version !== 1) return null;

    const isValidGameState = parsed.gameState === GameState.PLAYING || parsed.gameState === GameState.GAME_OVER;
    if (
        !isValidGameState ||
        !Array.isArray(parsed.grid) ||
        !Array.isArray(parsed.slots) ||
        typeof parsed.score !== 'number' ||
        typeof parsed.phase !== 'string' ||
        typeof parsed.boardSize !== 'number' ||
        !VALID_BOARD_SIZES.includes(parsed.boardSize as BoardSize)
    ) {
        console.warn('[GameStorage] 저장된 데이터 형식 오류');
        return null;
    }

    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined;
    const moveCount = typeof parsed.moveCount === 'number' ? parsed.moveCount : undefined;
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
    // startedAt가 없는 구버전 데이터는 마지막 저장 시각으로 보정해 안티치트 오탐을 줄인다.
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : savedAt;
    const playerName = typeof parsed.playerName === 'string' ? parsed.playerName : undefined;
    const hasUsedRevive = typeof parsed.hasUsedRevive === 'boolean' ? parsed.hasUsedRevive : undefined;
    const isReviveSelectionMode = typeof parsed.isReviveSelectionMode === 'boolean'
        ? parsed.isReviveSelectionMode
        : false;
    const reviveBreakRemaining = typeof parsed.reviveBreakRemaining === 'number'
        ? Math.max(0, Math.min(99, Math.floor(parsed.reviveBreakRemaining)))
        : 0;
    const revivePendingTileId =
        parsed.revivePendingTileId === null || typeof parsed.revivePendingTileId === 'string'
            ? parsed.revivePendingTileId
            : null;
    const snapshot = parsed.lastSnapshot;
    const lastSnapshot =
        snapshot &&
            Array.isArray(snapshot.grid) &&
            Array.isArray(snapshot.slots) &&
            typeof snapshot.score === 'number' &&
            typeof snapshot.phase === 'string' &&
            typeof snapshot.canSkipSlide === 'boolean'
            ? snapshot
            : null;
    const undoRemaining = typeof parsed.undoRemaining === 'number'
        ? Math.max(0, Math.min(99, Math.floor(parsed.undoRemaining)))
        : 3;

    return {
        ...parsed,
        savedAt,
        sessionId,
        moveCount,
        startedAt,
        playerName,
        hasUsedRevive,
        isReviveSelectionMode,
        reviveBreakRemaining,
        revivePendingTileId,
        lastSnapshot,
        undoRemaining,
    };
};

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
        const serialized = JSON.stringify(savedState);
        localStorage.setItem(GAME_STATE_STORAGE_KEY, serialized);
        // 앱 업데이트/스토리지 흔들림 상황 대비 백업 키에도 동시 저장.
        localStorage.setItem(GAME_STATE_BACKUP_STORAGE_KEY, serialized);
    } catch (e) {
        console.warn('[GameStorage] 게임 저장 실패:', e);
    }
}

/**
 * 저장된 게임 상태를 불러옵니다.
 * 복구 가능한 게임 상태가 없거나 데이터가 손상된 경우 null 반환.
 */
export function loadGameState(): SavedGameState | null {
    try {
        const primary = parseSavedGameState(localStorage.getItem(GAME_STATE_STORAGE_KEY));
        if (primary) return primary;

        const backup = parseSavedGameState(localStorage.getItem(GAME_STATE_BACKUP_STORAGE_KEY));
        if (!backup) return null;

        // 백업 복구 성공 시 주 저장 키를 재생성해 이후 경로를 단순화.
        localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(backup));
        return backup;
    } catch (e) {
        console.warn('[GameStorage] 게임 로드 실패:', e);
        return null;
    }
}

/**
 * 저장된 게임 상태를 삭제합니다 (게임오버 종료 확정/새 게임 시작 시).
 */
export function clearGameState(): void {
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEY);
        localStorage.removeItem(GAME_STATE_BACKUP_STORAGE_KEY);
    } catch (e) {
        console.warn('[GameStorage] 게임 삭제 실패:', e);
    }
}

/**
 * 진행중인 게임이 있는지 확인합니다.
 */
export function hasActiveGame(): boolean {
    const saved = loadGameState();
    return saved?.gameState === GameState.PLAYING;
}
