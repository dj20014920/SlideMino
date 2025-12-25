import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trophy } from 'lucide-react';
import { rankingService, RankEntry } from '../services/rankingService';

interface LeaderboardModalProps {
    open: boolean;
    onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ open, onClose }) => {
    const { t } = useTranslation();
    const [rankings, setRankings] = useState<RankEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [activeTab, setActiveTab] = useState<'ALL' | '4x4' | '5x5' | '7x7' | '8x8' | '10x10'>('ALL');

    const formatDifficultyLabel = (difficulty?: string): string | null => {
        if (!difficulty) return null;
        const trimmed = difficulty.trim();
        const match = trimmed.match(/^(\d+)(?:x\1)?$/i);
        return match ? `${match[1]}x${match[1]}` : trimmed;
    };

    useEffect(() => {
        if (open) {
            setLoading(true);
            setHasError(false);
            rankingService.getLeaderboard()
                .then(data => {
                    setRankings(data);
                })
                .catch(err => {
                    console.error(err);
                    setHasError(true);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open]);

    if (!open) return null;

    const filteredRankings = rankings.filter(r => {
        if (activeTab === 'ALL') return true;
        const label = formatDifficultyLabel(r.difficulty);
        return label === activeTab;
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
                        {t('modals:leaderboard.title')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible border-b border-gray-100 bg-white px-4 py-3">
                    {(['ALL', '4x4', '5x5', '7x7', '8x8', '10x10'] as const).map(tab => (
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
                            {tab === 'ALL' ? t('modals:leaderboard.tabs.all') : tab}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400">{t('common:labels.loading')}</div>
                    ) : hasError ? (
                        <div className="text-center py-10 text-red-400">{t('modals:leaderboard.error')}</div>
                    ) : filteredRankings.length === 0 ? (
                        <div className="text-center py-10 text-gray-400" style={{ whiteSpace: 'pre-line' }}>
                            {t('modals:leaderboard.empty')}
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
                                            <span>{formatDifficultyLabel(entry.difficulty) || '8x8'}</span>
                                            {/* Date optional */}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-emerald-600 tabular-nums">
                                        {entry.score.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400">{t('common:labels.pts')}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
