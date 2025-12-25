import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Send, Check, X, Medal } from 'lucide-react';
import { rankingService } from '../services/rankingService';
import AdBanner from './AdBanner';

interface GameOverModalProps {
    sessionId: string;
    score: number;
    difficulty: string;
    duration: number;
    moves: number;
    playerName?: string;
    onClose: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ sessionId, score, difficulty, duration, moves, playerName, onClose }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'INITIAL' | 'REGISTER' | 'SUBMITTED'>('INITIAL');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Load saved name or use provided playerName
        setName(playerName || rankingService.getSavedName());
    }, [playerName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        // Submit score with anti-cheat metadata and session ID
        await rankingService.submitScore(sessionId, name, score, difficulty, duration, moves);
        setIsSubmitting(false);
        setStep('SUBMITTED');
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl animate-fade-in" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm animate-slide-up">

                {step === 'INITIAL' && (
                    <div className="flex flex-col items-center space-y-8 w-full">
                        {/* Trophy Icon */}
                        <div className="
              w-24 h-24 rounded-full 
              bg-gradient-to-br from-amber-100 to-yellow-200
              border border-amber-200/50
              shadow-xl shadow-amber-900/10
              flex items-center justify-center
            ">
                            <Trophy size={40} className="text-amber-600 drop-shadow-sm" />
                        </div>

                        {/* Title */}
                        <h2 className="text-4xl font-bold text-gray-900 tracking-tight">{t('modals:gameOver.title')}</h2>

                        {/* Score Display */}
                        <div className="
              w-full text-center px-6 py-8 rounded-3xl
              bg-white/60 backdrop-blur-md
              border border-white/60
              shadow-lg
            ">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
                                {t('common:labels.finalScore')}
                            </p>
                            <p className="text-6xl font-black text-gray-900 tabular-nums tracking-tighter loading-none">
                                {score}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 w-full pt-2">
                            <button
                                onClick={() => setStep('REGISTER')}
                                className="
                  group relative w-full py-4 rounded-2xl
                  bg-gradient-to-br from-indigo-500 to-purple-600
                  text-white font-bold text-lg
                  shadow-lg shadow-indigo-500/25
                  hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5
                  active:translate-y-0 active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Medal size={20} className="text-indigo-100" />
                                    {t('modals:gameOver.registerRanking')}
                                </span>
                            </button>

                            <button
                                onClick={onClose}
                                className="
                  w-full py-4 rounded-2xl
                  bg-white border border-gray-200
                  text-gray-900 font-semibold text-lg
                  shadow-sm
                  hover:bg-gray-50 hover:border-gray-300
                  active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                {t('modals:gameOver.backToMenu')}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'REGISTER' && (
                    <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-6 w-full">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900">{t('modals:rankingRegister.title')}</h3>
                            <p className="text-gray-500 text-sm" style={{ whiteSpace: 'pre-line' }}>
                                {t('modals:rankingRegister.description')}
                            </p>
                        </div>

                        <div className="w-full space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="playerName" className="text-xs font-bold text-gray-500 uppercase ml-1">
                                    {t('common:labels.name')}
                                </label>
                                <input
                                    id="playerName"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('modals:nameInput.placeholder')}
                                    maxLength={12}
                                    className="
                    w-full px-5 py-4 rounded-2xl
                    bg-white/80 border border-gray-200
                    text-xl font-bold text-gray-900 text-center
                    placeholder:text-gray-300 placeholder:font-normal
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                    transition-all shadow-sm
                  "
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting || !name.trim()}
                                className="
                  relative w-full py-4 rounded-2xl
                  bg-gray-900 text-white font-bold text-lg
                  shadow-lg
                  hover:bg-gray-800 hover:-translate-y-0.5
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        {t('modals:rankingRegister.submitting')}
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <Send size={18} />
                                        {t('modals:rankingRegister.submit')}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('INITIAL')}
                                className="
                  w-full py-3 rounded-2xl
                  text-gray-500 font-medium
                  hover:text-gray-900 hover:bg-gray-100/50
                  transition-colors
                "
                            >
                                {t('common:buttons.cancel')}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'SUBMITTED' && (
                    <div className="flex flex-col items-center space-y-8 w-full animate-pop-in">
                        <div className="
              w-24 h-24 rounded-full
              bg-green-100 border border-green-200
              flex items-center justify-center
            ">
                            <Check size={40} className="text-green-600" />
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900">{t('modals:rankingRegister.success')}</h3>
                            <p className="text-gray-500">
                                {t('modals:rankingRegister.successMessage')}
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="
                w-full py-4 rounded-2xl
                bg-gray-900 text-white font-bold text-lg
                shadow-lg
                hover:bg-gray-800 hover:-translate-y-0.5
                active:scale-[0.98]
                transition-all duration-200
              "
                        >
                            {t('common:buttons.confirm')}
                        </button>
                    </div>
                )}


                <div className="w-full mt-4">
                    <AdBanner />
                </div>
            </div>
        </div>
    );
};
