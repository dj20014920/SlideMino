import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';

interface NameInputModalProps {
    open: boolean;
    difficulty: number | null;
    hasActiveGame?: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const NameInputModal: React.FC<NameInputModalProps> = ({ open, difficulty, hasActiveGame, onClose, onSubmit }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setName('');
            setError(null);
        }
    }, [open]);

    const validateName = (value: string) => {
        // 1. Length check (1~10)
        if (value.length === 0) return t('modals:nameInput.errors.required');
        if (value.length > 10) return t('modals:nameInput.errors.tooLong');

        // 2. Injection Prevention (allow only safe chars)
        // Allowed: Korean (Hangul syllables, Jamo), English, Numbers, Space
        const safePattern = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s]+$/;
        if (!safePattern.test(value)) {
            return t('modals:nameInput.errors.invalidChars');
        }

        return null;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();

        const validationError = validateName(trimmedName);
        if (validationError) {
            setError(validationError);
            return;
        }

        onSubmit(trimmedName);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        // Pre-validation to prevent typing too long
        if (newVal.length <= 10) {
            setName(newVal);
            setError(null);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800">
                            {t('modals:nameInput.title', { difficulty } as any)}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {hasActiveGame && (
                        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex flex-col gap-1">
                            <span className="font-bold">{t('modals:nameInput.activeGameWarning')}</span>
                            <span className="text-amber-700/80">{t('modals:nameInput.activeGameMessage')}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">
                                {t('modals:nameInput.label')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={handleChange}
                                placeholder={t('modals:nameInput.placeholder')}
                                className={`
                            w-full px-4 py-3 rounded-xl border-2 outline-none transition-all
                            font-medium text-gray-800 placeholder-gray-400
                            ${error
                                        ? 'border-red-300 focus:border-red-500 bg-red-50'
                                        : 'border-gray-200 focus:border-blue-500 bg-gray-50 focus:bg-white'
                                    }
                        `}
                                autoFocus
                            />
                            {error && (
                                <p className="mt-1 text-xs text-red-500 font-medium">
                                    {error}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="
                        w-full py-3.5 rounded-xl
                        bg-gray-900 text-white font-bold text-lg
                        shadow-lg shadow-gray-900/20
                        hover:bg-gray-800 hover:-translate-y-0.5
                        active:translate-y-0 active:shadow-md
                        transition-all duration-200 ease-out
                        flex items-center justify-center gap-2
                    "
                        >
                            <span>{t('modals:nameInput.submit')}</span>
                            <Play size={18} fill="currentColor" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
