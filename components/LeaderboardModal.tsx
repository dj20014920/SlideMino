import React, { useEffect, useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { rankingService, RankEntry } from '../services/rankingService';

interface LeaderboardModalProps {
    open: boolean;
    onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ open, onClose }) => {
    const [rankings, setRankings] = useState<RankEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'ALL' | '10x10' | '8x8' | '7x7' | '5x5'>('ALL');

    useEffect(() => {
        if (open) {
            setLoading(true);
            setError(null);
            rankingService.getLeaderboard()
                .then(data => {
                    setRankings(data);
                })
                .catch(err => {
                    console.error(err);
                    setError('랭킹을 불러오는데 실패했습니다.');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open]);

    if (!open) return null;

    const filteredRankings = rankings.filter(r => {
        if (activeTab === 'ALL') return true;
        // Check difficulty string format (e.g. "8x8")
        return r.difficulty === activeTab;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-6 pb-2 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Trophy className="text-yellow-500 fill-yellow-500" />
                        Leaderboard
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 gap-1 overflow-x-auto border-b border-gray-100 bg-white sticky top-0 z-10 no-scrollbar">
                    {(['ALL', '10x10', '8x8', '7x7', '5x5'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                                ${activeTab === tab
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }
                            `}
                        >
                            {tab === 'ALL' ? '전체' : tab}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">LOADING...</div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-400">{error}</div>
                    ) : filteredRankings.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            아직 등록된 랭킹이 없습니다.<br />
                            첫 주인공이 되어보세요!
                        </div>
                    ) : (
                        filteredRankings.map((entry, index) => (
                            <div
                                key={index}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                        ${index === 0 ? 'bg-yellow-100 text-yellow-600' :
                                            index === 1 ? 'bg-gray-100 text-gray-600' :
                                                index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}
                                    `}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800">{entry.name}</div>
                                        <div className="text-xs text-gray-400 flex items-center gap-2">
                                            <span>{entry.difficulty || '8x8'}</span>
                                            {/* Date optional */}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-emerald-600 tabular-nums">
                                        {entry.score.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400">pts</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
