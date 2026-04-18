import { isNativeApp } from '../utils/platform';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from '../utils/apiUrl';
import { updateServerTimeOffset } from './serverTimeService';

export interface RankEntry {
    name: string;
    score: number;
    timestamp: number;
    difficulty: string;
    levelBadge?: string | null;
}

export interface SubmitScoreResponse {
    success: boolean;
    rank?: number;
    queued?: boolean;
    offline?: boolean;
    status?: number;
    code?: string;
    errorMessage?: string;
}

export interface LeaderboardResponse {
    data: RankEntry[];
    offline: boolean;
    fromCache: boolean;
    seasonInfo?: { seasonId: string; endsAt: number } | null;
}

export type LeaderboardTab = 'ALL' | '4x4' | '5x5' | '7x7' | '8x8' | '10x10';

export interface LiveRankEstimate {
    rank: number;
    pointsToNext: number;
    totalEntries: number;
}

interface LiveRankApiResponse {
    rank?: unknown;
    pointsToNext?: unknown;
    totalEntries?: unknown;
}

interface PendingScore {
    sessionId: string;
    name: string;
    score: number;
    difficulty: string;
    duration: number;
    moves: number;
    timestamp: number;
    updatedAt: number;
    installId?: string;
    platform?: string;
    levelBadge?: string;
    mode?: 'final' | 'progress';
}

interface PendingScoreQueueEnvelopeV2 {
    version: 2;
    entries: Record<string, PendingScore>;
}

const STORAGE_KEY_NAME = 'slidemino_player_name';
const STORAGE_KEY_QUEUE = 'slidemino_pending_scores_v1';
const PENDING_SCORE_QUEUE_VERSION = 2;
const LEADERBOARD_ERROR_LOG_COOLDOWN_MS = 60_000;
// 기본값은 false(오프라인 큐 활성화). 필요 시 빌드 플래그로만 실시간 전용 모드 활성화.
const REALTIME_RANKING_ONLY = import.meta.env.VITE_REALTIME_RANKING_ONLY === 'true';

let lastLeaderboardErrorLogAt = 0;

const normalizeDifficultyForApi = (difficulty: string): string => {
    const trimmed = difficulty.trim();
    const match = trimmed.match(/^(\d+)(?:x\1)?$/i);
    return match ? match[1] : trimmed;
};

const normalizeLeaderboardTabForApi = (tab: LeaderboardTab): string => {
    if (tab === 'ALL') return 'ALL';
    return normalizeDifficultyForApi(tab);
};

const normalizeDurationForSubmit = (duration: number): number => {
    if (!Number.isFinite(duration)) return 1;
    // 서버 검증(validateDuration)과 동일한 범위로 클램프해
    // 장시간 백그라운드/재개 세션에서 등록 실패를 방지한다.
    return Math.max(1, Math.min(86400, Math.floor(duration)));
};

const isOnline = (): boolean => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
};

const safeReadLocalStorage = (key: string): string | null => {
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeWriteLocalStorage = (key: string, value: string): void => {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(key, value);
    } catch {
        // localStorage 저장 실패는 기능 동작을 막지 않는다.
    }
};

const logLeaderboardFetchFailure = (error: unknown): void => {
    const now = Date.now();
    if (now - lastLeaderboardErrorLogAt < LEADERBOARD_ERROR_LOG_COOLDOWN_MS) return;
    lastLeaderboardErrorLogAt = now;
    console.error('Failed to fetch leaderboard:', error);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const sanitizePendingScore = (sessionId: string, raw: unknown): PendingScore | null => {
    if (!isPlainRecord(raw)) return null;

    const resolvedSessionId = typeof raw.sessionId === 'string' && raw.sessionId.trim().length > 0
        ? raw.sessionId.trim()
        : sessionId.trim();
    if (!resolvedSessionId) return null;

    const name = typeof raw.name === 'string' && raw.name.trim().length > 0
        ? raw.name.trim()
        : '익명';
    const difficulty = typeof raw.difficulty === 'string'
        ? normalizeDifficultyForApi(raw.difficulty)
        : '';
    if (!difficulty) return null;

    const score = typeof raw.score === 'number' && Number.isFinite(raw.score)
        ? Math.max(0, Math.floor(raw.score))
        : 0;
    const moves = typeof raw.moves === 'number' && Number.isFinite(raw.moves)
        ? Math.max(0, Math.floor(raw.moves))
        : 0;
    const duration = normalizeDurationForSubmit(
        typeof raw.duration === 'number' && Number.isFinite(raw.duration) ? raw.duration : 1
    );

    const timestamp = typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
        ? Math.max(0, Math.floor(raw.timestamp))
        : Date.now();
    const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? Math.max(0, Math.floor(raw.updatedAt))
        : timestamp;

    return {
        sessionId: resolvedSessionId,
        name,
        score,
        difficulty,
        duration,
        moves,
        timestamp,
        updatedAt,
        installId: typeof raw.installId === 'string' && raw.installId.length > 0 ? raw.installId : undefined,
        platform: typeof raw.platform === 'string' && raw.platform.length > 0 ? raw.platform : undefined,
        levelBadge: typeof raw.levelBadge === 'string' && raw.levelBadge.length > 0 ? raw.levelBadge : undefined,
        mode: raw.mode === 'progress' ? 'progress' : 'final',
    };
};

const normalizeQueueEntries = (rawEntries: unknown): Record<string, PendingScore> => {
    if (!isPlainRecord(rawEntries)) return {};

    const normalized: Record<string, PendingScore> = {};
    for (const [sessionId, entry] of Object.entries(rawEntries)) {
        const sanitized = sanitizePendingScore(sessionId, entry);
        if (sanitized) {
            normalized[sanitized.sessionId] = sanitized;
        }
    }
    return normalized;
};

const loadQueue = (): Record<string, PendingScore> => {
    try {
        const raw = safeReadLocalStorage(STORAGE_KEY_QUEUE);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (isPlainRecord(parsed) && parsed.version === PENDING_SCORE_QUEUE_VERSION) {
            return normalizeQueueEntries(parsed.entries);
        }
        return normalizeQueueEntries(parsed);
    } catch {
        return {};
    }
};

const saveQueue = (queue: Record<string, PendingScore>): void => {
    const payload: PendingScoreQueueEnvelopeV2 = {
        version: PENDING_SCORE_QUEUE_VERSION,
        entries: queue,
    };
    safeWriteLocalStorage(STORAGE_KEY_QUEUE, JSON.stringify(payload));
};

const getPendingScoreMode = (item: Pick<PendingScore, 'mode'>): 'final' | 'progress' => {
    return item.mode === 'progress' ? 'progress' : 'final';
};

const mergePendingScore = (
    existing: PendingScore,
    incoming: Omit<PendingScore, 'updatedAt'>
): PendingScore => {
    const existingMode = getPendingScoreMode(existing);
    const incomingMode = getPendingScoreMode(incoming);

    // final/progress 충돌 시 final 페이로드를 보존한다.
    const finalPreferredBase = existingMode === 'final' && incomingMode !== 'final'
        ? existing
        : incoming;

    // 점수는 동일 session 내 더 높은 값 우선으로 유지한다.
    const scorePreferredBase = existing.score >= incoming.score ? existing : incoming;

    return {
        ...finalPreferredBase,
        score: Math.max(existing.score, incoming.score),
        duration: scorePreferredBase.duration,
        moves: scorePreferredBase.moves,
        timestamp: Math.max(existing.timestamp, incoming.timestamp),
        installId: incoming.installId ?? existing.installId,
        platform: incoming.platform ?? existing.platform,
        levelBadge: incoming.levelBadge ?? existing.levelBadge,
        mode: existingMode === 'final' || incomingMode === 'final' ? 'final' : 'progress',
        updatedAt: Date.now(),
    };
};

const enqueueScore = (payload: Omit<PendingScore, 'updatedAt'>): void => {
    const queue = loadQueue();
    const existing = queue[payload.sessionId];
    queue[payload.sessionId] = existing
        ? mergePendingScore(existing, payload)
        : {
            ...payload,
            updatedAt: Date.now(),
        };
    saveQueue(queue);
};

const shouldQueue = (status?: number): boolean => {
    if (status === 0 || status === undefined) return true;
    return status === 429 || status >= 500;
};

const postScore = async (
    payload: Omit<PendingScore, 'updatedAt'>
): Promise<{ success: boolean; rank?: number; status?: number; code?: string; errorMessage?: string }> => {
    try {
        const response = await fetch(getApiUrl('/api/submit'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        updateServerTimeOffset(response);

        if (!response.ok) {
            let code: string | undefined;
            let errorMessage: string | undefined;
            try {
                const errorBody = await response.json() as { code?: unknown; error?: unknown; message?: unknown };
                if (typeof errorBody?.code === 'string') {
                    code = errorBody.code;
                }
                if (typeof errorBody?.error === 'string') {
                    errorMessage = errorBody.error;
                } else if (typeof errorBody?.message === 'string') {
                    errorMessage = errorBody.message;
                }
            } catch {
                // ignore non-json error body
            }
            console.error('[RankingService] submit failed', {
                status: response.status,
                code,
                errorMessage,
                difficulty: payload.difficulty,
                score: payload.score,
                duration: payload.duration,
                moves: payload.moves,
                isNative: isNativeApp(),
            });
            return { success: false, status: response.status, code, errorMessage };
        }

        const data = await response.json() as { rank?: unknown };
        const rank = typeof data.rank === 'number' ? data.rank : undefined;
        return { success: true, rank };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[RankingService] submit network error', {
            errorMessage,
            difficulty: payload.difficulty,
            score: payload.score,
            duration: payload.duration,
            moves: payload.moves,
            isNative: isNativeApp(),
        });
        return { success: false, status: 0, errorMessage };
    }
};

let flushPendingScoresLock: Promise<void> | null = null;

const runFlushPendingScores = async (): Promise<void> => {
    if (REALTIME_RANKING_ONLY) return;
    if (!isOnline()) return;
    const queue = loadQueue();
    const items = Object.values(queue).sort((a, b) => a.updatedAt - b.updatedAt);
    if (items.length === 0) return;

    for (const item of items) {
        const { updatedAt: _ignore, ...payload } = item;
        const result = await postScore(payload);
        if (result.success) {
            delete queue[item.sessionId];
            saveQueue(queue);
            continue;
        }

        if (result.status && result.status < 500 && result.status !== 429) {
            delete queue[item.sessionId];
            saveQueue(queue);
            continue;
        }

        break;
    }
};

const flushPendingScores = async (): Promise<void> => {
    if (flushPendingScoresLock) {
        await flushPendingScoresLock;
        return;
    }

    flushPendingScoresLock = runFlushPendingScores();
    try {
        await flushPendingScoresLock;
    } finally {
        flushPendingScoresLock = null;
    }
};

let syncInitialized = false;

const initSync = (): void => {
    if (REALTIME_RANKING_ONLY) return;
    if (syncInitialized) return;
    if (typeof window === 'undefined') return;
    syncInitialized = true;
    window.addEventListener('online', () => {
        void flushPendingScores();
    });
    void flushPendingScores();
};

const buildPayload = (
    sessionId: string,
    name: string,
    score: number,
    difficulty: string,
    duration: number,
    moves: number,
    installId?: string,
    levelBadge?: string,
    mode: 'final' | 'progress' = 'final'
): Omit<PendingScore, 'updatedAt'> => {
    return {
        sessionId,
        name,
        score,
        difficulty: normalizeDifficultyForApi(difficulty),
        duration: normalizeDurationForSubmit(duration),
        moves,
        timestamp: Date.now(),
        installId,
        platform: Capacitor.getPlatform(),
        levelBadge,
        mode,
    };
};

const estimateLiveRank = (score: number, difficulty: string, leaderboard: RankEntry[]): LiveRankEstimate | null => {
    if (leaderboard.length === 0) return null;

    const normalizedDifficulty = normalizeDifficultyForApi(difficulty);
    const sameDifficultyScores = leaderboard
        .filter((entry) => normalizeDifficultyForApi(entry.difficulty) === normalizedDifficulty)
        .map((entry) => entry.score)
        .sort((a, b) => b - a);

    if (sameDifficultyScores.length === 0) {
        return {
            rank: 1,
            pointsToNext: 0,
            totalEntries: 0,
        };
    }

    const higherScores = sameDifficultyScores.filter((entryScore) => entryScore > score);
    const rank = higherScores.length + 1;
    const nextHigherScore = higherScores.length > 0 ? higherScores[higherScores.length - 1] : null;

    return {
        rank,
        pointsToNext: nextHigherScore === null ? 0 : Math.max(0, nextHigherScore - score),
        totalEntries: sameDifficultyScores.length,
    };
};

const parseLiveRankEstimate = (payload: LiveRankApiResponse): LiveRankEstimate | null => {
    const rank = typeof payload.rank === 'number' ? payload.rank : Number(payload.rank);
    const pointsToNext = typeof payload.pointsToNext === 'number'
        ? payload.pointsToNext
        : Number(payload.pointsToNext);
    const totalEntries = typeof payload.totalEntries === 'number'
        ? payload.totalEntries
        : Number(payload.totalEntries ?? 0);

    if (!Number.isFinite(rank) || !Number.isFinite(pointsToNext)) {
        return null;
    }

    return {
        rank: Math.max(1, Math.floor(rank)),
        pointsToNext: Math.max(0, Math.floor(pointsToNext)),
        totalEntries: Math.max(0, Math.floor(totalEntries)),
    };
};

export const rankingService = {
    initSync,
    flushPendingScores,
    estimateLiveRank,
    getLiveRankEstimate: async (score: number, difficulty: string): Promise<LiveRankEstimate | null> => {
        if (!isOnline()) return null;

        const normalizedDifficulty = normalizeDifficultyForApi(difficulty);
        const query = new URLSearchParams({
            mode: 'live',
            difficulty: normalizedDifficulty,
            score: String(Math.max(0, Math.floor(score))),
            _ts: String(Date.now()),
        });

        const response = await fetch(getApiUrl(`/api/rankings?${query.toString()}`), {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Live rank request failed: ${response.status}`);
        }

        const data = await response.json() as LiveRankApiResponse;
        return parseLiveRankEstimate(data);
    },
    /**
     * Get the saved player name from LocalStorage
     */
    getSavedName: (): string => {
        return safeReadLocalStorage(STORAGE_KEY_NAME) || '';
    },

    /**
     * Save player name to LocalStorage for persistence
     */
    saveName: (name: string) => {
        safeWriteLocalStorage(STORAGE_KEY_NAME, name);
    },

    /**
     * Submit score to the ranking backend (게임 종료 시)
     */
    submitScore: async (
        sessionId: string,
        name: string,
        score: number,
        difficulty: string,
        duration: number,
        moves: number,
        installId?: string,
        levelBadge?: string
    ): Promise<SubmitScoreResponse> => {
        // Save name locally first
        rankingService.saveName(name);
        const payload = buildPayload(sessionId, name, score, difficulty, duration, moves, installId, levelBadge, 'final');

        if (!isOnline()) {
            if (!REALTIME_RANKING_ONLY) {
                enqueueScore(payload);
                return { success: false, queued: true, offline: true };
            }
            return { success: false, offline: true };
        }

        const result = await postScore(payload);
        if (result.success) {
            return { success: true, rank: result.rank };
        }

        if (!REALTIME_RANKING_ONLY && shouldQueue(result.status)) {
            enqueueScore(payload);
            return {
                success: false,
                queued: true,
                offline: !isOnline(),
                status: result.status,
                code: result.code,
                errorMessage: result.errorMessage,
            };
        }

        if (result.status === 0 && !isOnline()) {
            return {
                success: false,
                offline: true,
                status: result.status,
                code: result.code,
                errorMessage: result.errorMessage,
            };
        }

        return {
            success: false,
            offline: !isOnline(),
            status: result.status,
            code: result.code,
            errorMessage: result.errorMessage,
        };
    },
    /**
     * 게임 진행 중 자동 저장용 진행 점수 제출
     * - 네트워크/서버 일시 장애 시 오프라인 큐로 재전송 보장
     */
    submitProgressScore: async (
        sessionId: string,
        name: string,
        score: number,
        difficulty: string,
        duration: number,
        moves: number,
        installId?: string
    ): Promise<SubmitScoreResponse> => {
        rankingService.saveName(name);
        const payload = buildPayload(sessionId, name, score, difficulty, duration, moves, installId, undefined, 'progress');

        if (!isOnline()) {
            if (!REALTIME_RANKING_ONLY) {
                enqueueScore(payload);
                return { success: false, queued: true, offline: true };
            }
            return { success: false, offline: true };
        }

        const result = await postScore(payload);
        if (result.success) {
            return { success: true };
        }

        if (!REALTIME_RANKING_ONLY && shouldQueue(result.status)) {
            enqueueScore(payload);
            return {
                success: false,
                queued: true,
                offline: !isOnline(),
                status: result.status,
                code: result.code,
                errorMessage: result.errorMessage,
            };
        }

        return {
            success: false,
            offline: !isOnline(),
            status: result.status,
            code: result.code,
            errorMessage: result.errorMessage,
        };
    },

    /**
     * Fetch top scores
     */
    getLeaderboard: async (tab: LeaderboardTab = 'ALL'): Promise<LeaderboardResponse> => {
        if (!isOnline()) {
            return {
                data: [],
                offline: true,
                fromCache: false,
            };
        }

        try {
            const url = new URL(getApiUrl('/api/rankings'), typeof window !== 'undefined' ? window.location.origin : 'https://slidemino.emozleep.space');
            url.searchParams.set('tab', normalizeLeaderboardTabForApi(tab));
            url.searchParams.set('_ts', String(Date.now()));
            const response = await fetch(url.toString(), { cache: 'no-store' });
            updateServerTimeOffset(response);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            // 새 형식: { rankings: [...], seasonInfo: {...} } / 이전 형식: 배열 직접 반환
            if (data && typeof data === 'object' && 'rankings' in data) {
                const typed = data as { rankings: RankEntry[]; seasonInfo?: { seasonId: string; endsAt: number } };
                return { data: typed.rankings, offline: false, fromCache: false, seasonInfo: typed.seasonInfo };
            }
            const normalized = Array.isArray(data)
                ? (data as Record<string, unknown>[]).map((entry) => ({
                    ...entry,
                    levelBadge: typeof entry.levelBadge === 'string' ? entry.levelBadge : null,
                })) as RankEntry[]
                : [];
            return { data: normalized, offline: false, fromCache: false };
        } catch (error) {
            logLeaderboardFetchFailure(error);
            throw error;
        }
    }
};
