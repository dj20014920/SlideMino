import { GameState } from '../types';

export interface RankEntry {
    name: string;
    score: number;
    timestamp: number;
    difficulty: string;
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
     * Submit score to the ranking backend
     */
    submitScore: async (name: string, score: number, difficulty: string, duration: number, moves: number): Promise<boolean> => {
        // Save name locally first
        rankingService.saveName(name);

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    score,
                    difficulty,
                    duration,
                    moves,
                    timestamp: Date.now()
                }),
            });
            return response.ok;
        } catch (error) {
            console.error('Failed to submit score:', error);
            return false;
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
