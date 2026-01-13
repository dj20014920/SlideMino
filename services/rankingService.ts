import { isNativeApp } from '../utils/platform';

export interface RankEntry {
    name: string;
    score: number;
    timestamp: number;
    difficulty: string;
}

export interface SubmitScoreResponse {
    success: boolean;
    rank?: number;
    queued?: boolean;
    offline?: boolean;
}

export interface LeaderboardResponse {
    data: RankEntry[];
    offline: boolean;
    fromCache: boolean;
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
}

interface LeaderboardCache {
    data: RankEntry[];
    updatedAt: number;
}

const STORAGE_KEY_NAME = 'slidemino_player_name';
const STORAGE_KEY_QUEUE = 'slidemino_pending_scores_v1';
const STORAGE_KEY_LEADERBOARD_CACHE = 'slidemino_leaderboard_cache_v1';

const API_BASE_URL = 'https://www.slidemino.emozleep.space';

const getApiUrl = (path: string): string => {
    // In native (Capacitor) builds the app is served from a local origin
    // (e.g. capacitor://localhost), so relative `/api/*` calls won't hit Cloudflare.
    // Use the production origin explicitly for API calls.
    if (isNativeApp()) return `${API_BASE_URL}${path}`;
    return path;
};

const normalizeDifficultyForApi = (difficulty: string): string => {
    const trimmed = difficulty.trim();
    const match = trimmed.match(/^(\d+)(?:x\1)?$/i);
    return match ? match[1] : trimmed;
};

const isOnline = (): boolean => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
};

const loadQueue = (): Record<string, PendingScore> => {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
        return {};
    } catch {
        return {};
    }
};

const saveQueue = (queue: Record<string, PendingScore>): void => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
};

const enqueueScore = (payload: Omit<PendingScore, 'updatedAt'>): void => {
    const queue = loadQueue();
    queue[payload.sessionId] = {
        ...payload,
        updatedAt: Date.now(),
    };
    saveQueue(queue);
};

const loadLeaderboardCache = (): LeaderboardCache | null => {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY_LEADERBOARD_CACHE);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LeaderboardCache;
        if (!parsed || !Array.isArray(parsed.data)) return null;
        return parsed;
    } catch {
        return null;
    }
};

const saveLeaderboardCache = (data: RankEntry[]): void => {
    if (typeof localStorage === 'undefined') return;
    const payload: LeaderboardCache = { data, updatedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY_LEADERBOARD_CACHE, JSON.stringify(payload));
};

const shouldRetry = (status?: number): boolean => {
    if (status === 0 || status === undefined) return true;
    return status >= 500;
};

const shouldQueue = (status?: number): boolean => {
    if (status === 0 || status === undefined) return true;
    return status === 429 || status >= 500;
};

const postScore = async (
    payload: Omit<PendingScore, 'updatedAt'>
): Promise<{ success: boolean; rank?: number; status?: number }> => {
    try {
        const response = await fetch(getApiUrl('/api/submit'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            return { success: false, status: response.status };
        }

        const data = await response.json();
        return { success: true, rank: data.rank };
    } catch (error) {
        console.error('Failed to submit score:', error);
        return { success: false, status: 0 };
    }
};

const flushPendingScores = async (): Promise<void> => {
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

let syncInitialized = false;

const initSync = (): void => {
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
    moves: number
): Omit<PendingScore, 'updatedAt'> => {
    return {
        sessionId,
        name,
        score,
        difficulty: normalizeDifficultyForApi(difficulty),
        duration,
        moves,
        timestamp: Date.now(),
    };
};

export const rankingService = {
    initSync,
    flushPendingScores,
    /**
     * Get the saved player name from LocalStorage
     */
    getSavedName: (): string => {
        return localStorage.getItem(STORAGE_KEY_NAME) || '';
    },

    /**
     * Save player name to LocalStorage for persistence
     */
    saveName: (name: string) => {
        localStorage.setItem(STORAGE_KEY_NAME, name);
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
        moves: number
    ): Promise<SubmitScoreResponse> => {
        // Save name locally first
        rankingService.saveName(name);
        const payload = buildPayload(sessionId, name, score, difficulty, duration, moves);

        if (!isOnline()) {
            enqueueScore(payload);
            return { success: false, queued: true, offline: true };
        }

        const result = await postScore(payload);
        if (result.success) {
            return { success: true, rank: result.rank };
        }

        if (shouldQueue(result.status)) {
            enqueueScore(payload);
            return { success: false, queued: true, offline: !isOnline() };
        }

        return { success: false };
    },

    /**
     * Update score during gameplay (자동 업데이트용)
     */
    updateScore: async (
        sessionId: string,
        name: string,
        score: number,
        difficulty: string,
        duration: number,
        moves: number,
        retryCount = 0 // 재시도 횟수 추적
    ): Promise<SubmitScoreResponse> => {
        const payload = buildPayload(sessionId, name, score, difficulty, duration, moves);

        if (!isOnline()) {
            enqueueScore(payload);
            return { success: false, queued: true, offline: true };
        }

        const result = await postScore(payload);
        if (result.success) {
            return { success: true, rank: result.rank };
        }

        if (shouldRetry(result.status) && retryCount < 2) {
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return rankingService.updateScore(sessionId, name, score, difficulty, duration, moves, retryCount + 1);
        }

        if (shouldQueue(result.status)) {
            enqueueScore(payload);
            return { success: false, queued: true, offline: !isOnline() };
        }

        return { success: false };
    },

    /**
     * Fetch top scores
     */
    getLeaderboard: async (): Promise<LeaderboardResponse> => {
        const cached = loadLeaderboardCache();

        if (!isOnline()) {
            return {
                data: cached?.data ?? [],
                offline: true,
                fromCache: Boolean(cached),
            };
        }

        try {
            const response = await fetch(getApiUrl('/api/rankings'));
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            saveLeaderboardCache(data as RankEntry[]);
            return { data: data as RankEntry[], offline: false, fromCache: false };
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            if (cached) {
                return { data: cached.data, offline: false, fromCache: true };
            }
            throw error;
        }
    }
};
