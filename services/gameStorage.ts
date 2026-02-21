/**
 * 게임 상태 영속성 서비스
 * 
 * 기능:
 * - 진행중인 게임 상태를 localStorage에 저장
 * - 앱 재시작 시 게임 상태 복원
 * - 앱을 껐다 켜도, 홈화면에 갔다 와도 게임 이어하기 가능
 */

import { Grid, Piece, Phase, BoardSize, GameState } from '../types';
import { INITIAL_BLOCK_REFRESH_AMOUNT, INITIAL_UNDO_AMOUNT } from '../constants';

// 로컬 스토리지 키
const GAME_STATE_STORAGE_KEY = 'slidemino_game_state_v1';
const GAME_STATE_BACKUP_STORAGE_KEY = 'slidemino_game_state_backup_v1';
const LEGACY_SCORE_FRAGMENT_MIGRATION_STORAGE_KEY = 'slidemino_legacy_score_fragment_migration_v1';
const LEGACY_SCORE_FRAGMENT_MIGRATION_VERSION = 1;
const LEGACY_SCORE_FRAGMENT_MIGRATION_MAX_KEYS = 128;
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
    blockRefreshRemaining?: number;
    showBlockRefreshAdButton?: boolean;
    lastSnapshot?: StoredUndoSnapshot | null;
    hasUsedRevive?: boolean;
    isReviveSelectionMode?: boolean;
    reviveBreakRemaining?: number;
    revivePendingTileId?: string | null;
    sessionId?: string;
    moveCount?: number;
    startedAt?: number;
    activeDurationMs?: number;
    maxScoreThisRun?: number;
    scoreFragmentMilestonesGranted?: number;
    playerName?: string;
    sessionLockedPlayerName?: string;
    savedAt: number; // timestamp
}

interface LegacyScoreFragmentMigrationState {
    version: 1;
    claimedSessionKeys: string[];
}

const getLegacyScoreFragmentMigrationSessionKey = (saved: SavedGameState): string => {
    const sessionId = typeof saved.sessionId === 'string' ? saved.sessionId.trim() : '';
    if (sessionId) return `session:${sessionId}`;

    const startedAt = typeof saved.startedAt === 'number' && Number.isFinite(saved.startedAt)
        ? Math.floor(saved.startedAt)
        : 0;
    const savedAt = typeof saved.savedAt === 'number' && Number.isFinite(saved.savedAt)
        ? Math.floor(saved.savedAt)
        : 0;
    const moveCount = typeof saved.moveCount === 'number' && Number.isFinite(saved.moveCount)
        ? Math.max(0, Math.floor(saved.moveCount))
        : 0;
    const score = typeof saved.score === 'number' && Number.isFinite(saved.score)
        ? Math.max(0, Math.floor(saved.score))
        : 0;

    return `legacy:${saved.boardSize}:${startedAt}:${savedAt}:${moveCount}:${score}`;
};

const loadLegacyScoreFragmentMigrationState = (): LegacyScoreFragmentMigrationState => {
    try {
        const raw = localStorage.getItem(LEGACY_SCORE_FRAGMENT_MIGRATION_STORAGE_KEY);
        if (!raw) {
            return { version: LEGACY_SCORE_FRAGMENT_MIGRATION_VERSION, claimedSessionKeys: [] };
        }

        const parsed = JSON.parse(raw) as Partial<LegacyScoreFragmentMigrationState>;
        if (
            parsed?.version !== LEGACY_SCORE_FRAGMENT_MIGRATION_VERSION ||
            !Array.isArray(parsed.claimedSessionKeys)
        ) {
            return { version: LEGACY_SCORE_FRAGMENT_MIGRATION_VERSION, claimedSessionKeys: [] };
        }

        const claimedSessionKeys = parsed.claimedSessionKeys
            .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
            .slice(-LEGACY_SCORE_FRAGMENT_MIGRATION_MAX_KEYS);

        return { version: LEGACY_SCORE_FRAGMENT_MIGRATION_VERSION, claimedSessionKeys };
    } catch {
        return { version: LEGACY_SCORE_FRAGMENT_MIGRATION_VERSION, claimedSessionKeys: [] };
    }
};

const saveLegacyScoreFragmentMigrationState = (state: LegacyScoreFragmentMigrationState): void => {
    try {
        localStorage.setItem(LEGACY_SCORE_FRAGMENT_MIGRATION_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // 스토리지 실패 시에도 게임 진행을 막지 않는다.
    }
};

export function hasLegacyInProgressScoreFragmentMigrationClaim(saved: SavedGameState): boolean {
    try {
        const sessionKey = getLegacyScoreFragmentMigrationSessionKey(saved);
        const state = loadLegacyScoreFragmentMigrationState();
        return state.claimedSessionKeys.includes(sessionKey);
    } catch {
        return false;
    }
}

export function markLegacyInProgressScoreFragmentMigrationClaim(saved: SavedGameState): void {
    try {
        const sessionKey = getLegacyScoreFragmentMigrationSessionKey(saved);
        const state = loadLegacyScoreFragmentMigrationState();
        if (state.claimedSessionKeys.includes(sessionKey)) return;

        state.claimedSessionKeys.push(sessionKey);
        if (state.claimedSessionKeys.length > LEGACY_SCORE_FRAGMENT_MIGRATION_MAX_KEYS) {
            state.claimedSessionKeys = state.claimedSessionKeys.slice(-LEGACY_SCORE_FRAGMENT_MIGRATION_MAX_KEYS);
        }
        saveLegacyScoreFragmentMigrationState(state);
    } catch {
        // 스토리지 실패 시에도 게임 진행을 막지 않는다.
    }
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

    // 그리드 차원과 boardSize 일치 검증: 불일치 시 복원 거부 (손상 데이터 방어)
    if (
        parsed.grid.length !== parsed.boardSize ||
        parsed.grid.some(row => !Array.isArray(row) || row.length !== parsed.boardSize)
    ) {
        console.warn('[GameStorage] 그리드 차원 불일치:', parsed.grid.length, '!=', parsed.boardSize);
        return null;
    }

    const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined;
    const moveCount = typeof parsed.moveCount === 'number' ? parsed.moveCount : undefined;
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now();
    // startedAt가 없는 구버전 데이터는 마지막 저장 시각으로 보정해 안티치트 오탐을 줄인다.
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : savedAt;
    const activeDurationMs = typeof parsed.activeDurationMs === 'number' && Number.isFinite(parsed.activeDurationMs)
        ? Math.max(0, Math.floor(parsed.activeDurationMs))
        : Math.max(0, savedAt - startedAt);
    const maxScoreThisRun = typeof parsed.maxScoreThisRun === 'number' && Number.isFinite(parsed.maxScoreThisRun)
        ? Math.max(0, Math.floor(parsed.maxScoreThisRun))
        : undefined;
    const scoreFragmentMilestonesGranted =
        typeof parsed.scoreFragmentMilestonesGranted === 'number' && Number.isFinite(parsed.scoreFragmentMilestonesGranted)
            ? Math.max(0, Math.floor(parsed.scoreFragmentMilestonesGranted))
            : undefined;
    const playerName = typeof parsed.playerName === 'string' ? parsed.playerName : undefined;
    const sessionLockedPlayerName = typeof parsed.sessionLockedPlayerName === 'string'
        ? parsed.sessionLockedPlayerName
        : undefined;
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
        : INITIAL_UNDO_AMOUNT;
    const blockRefreshRemaining = typeof parsed.blockRefreshRemaining === 'number'
        ? Math.max(0, Math.min(99, Math.floor(parsed.blockRefreshRemaining)))
        : INITIAL_BLOCK_REFRESH_AMOUNT;
    const showBlockRefreshAdButton = typeof parsed.showBlockRefreshAdButton === 'boolean'
        ? parsed.showBlockRefreshAdButton
        : false;

    return {
        ...parsed,
        savedAt,
        sessionId,
        moveCount,
        startedAt,
        activeDurationMs,
        maxScoreThisRun,
        scoreFragmentMilestonesGranted,
        playerName,
        sessionLockedPlayerName,
        hasUsedRevive,
        isReviveSelectionMode,
        reviveBreakRemaining,
        revivePendingTileId,
        lastSnapshot,
        undoRemaining,
        blockRefreshRemaining,
        showBlockRefreshAdButton,
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
