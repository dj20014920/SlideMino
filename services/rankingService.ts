import { GameState } from '../types';

export interface RankEntry {
    name: string;
    score: number;
    timestamp: number;
    difficulty: string;
}

export interface SubmitScoreResponse {
    success: boolean;
    rank?: number;
}

const STORAGE_KEY_NAME = 'slidemino_player_name';


export const rankingService = {
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

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId,
                    name,
                    score,
                    difficulty,
                    duration,
                    moves,
                    timestamp: Date.now()
                }),
            });

            if (!response.ok) {
                return { success: false };
            }

            const data = await response.json();
            return {
                success: true,
                rank: data.rank
            };
        } catch (error) {
            console.error('Failed to submit score:', error);
            return { success: false };
        }
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
        moves: number
    ): Promise<SubmitScoreResponse> => {
        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId,
                    name,
                    score,
                    difficulty,
                    duration,
                    moves,
                    timestamp: Date.now()
                }),
            });

            if (!response.ok) {
                return { success: false };
            }

            const data = await response.json();
            return {
                success: true,
                rank: data.rank
            };
        } catch (error) {
            console.error('Failed to update score:', error);
            return { success: false };
        }
    },

    /**
     * Fetch top scores
     */
    getLeaderboard: async (): Promise<RankEntry[]> => {
        try {
            const response = await fetch('/api/rankings');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data as RankEntry[];
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
            return [];
        }
    }
};
