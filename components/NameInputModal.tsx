import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play } from 'lucide-react';
import { PLAYER_NAME_MAX_LENGTH, validatePlayerName, normalizePlayerName } from '../utils/playerName';
import { isAndroidApp } from '../utils/platform';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface NameInputModalProps {
    open: boolean;
    difficulty: number | null;
    initialName?: string;
    hasActiveGame?: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const NameInputModal: React.FC<NameInputModalProps> = ({ open, difficulty, initialName, hasActiveGame, onClose, onSubmit }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const isAndroid = isAndroidApp();
    useBodyScrollLock(open);
    const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
    const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
    const premiumUiWindowClassName = premiumUiObjects.windowClassName;
    const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
    const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
    const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
    const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
    const premiumUiModalWindowClassName = premiumUiObjects.extended.windows.modalWindowClassName;
    const isPremiumUi = Boolean(isPremiumUiThemeActive);

    useEffect(() => {
        if (open) {
            setName(initialName ?? '');
            setError(null);
        }
    }, [open, initialName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = normalizePlayerName(name);
        const errorKey = validatePlayerName(trimmedName);
        if (errorKey) {
            setError(t(`modals:nameInput.errors.${errorKey}`));
            return;
        }

        onSubmit(trimmedName);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        // Pre-validation to prevent typing too long
        if (newVal.length <= PLAYER_NAME_MAX_LENGTH) {
            setName(newVal);
            setError(null);
        }
    };

    if (!open) return null;

    return (
        <div className={isPremiumUi ? 'fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4 modal-safe-overlay' : 'fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4 modal-safe-overlay'}>
            {/* Backdrop */}
            <div
                className={isPremiumUi ? `absolute inset-0 ${premiumUiModalOverlayClassName}` : 'absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in'}
                onClick={onClose}
            />

            <div className={isPremiumUi
                ? `${premiumUiWindowClassName} ${premiumUiModalWindowClassName} relative w-full max-w-sm overflow-hidden flex flex-col min-h-0 animate-scale-in mb-safe modal-safe-panel`
                : 'relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-0 animate-scale-in mb-safe modal-safe-panel'}>
                {isPremiumUi && (
                    <div className={premiumUiTitleBarClassName}>
                        <div className={premiumUiTitleBarTextClassName}>{String(t('modals:nameInput.title', { difficulty } as any))}</div>
                        <div className={premiumUiTitleBarControlsClassName}>
                            <button aria-label="Close" onClick={onClose} />
                        </div>
                    </div>
                )}
                <div className={isPremiumUi ? `${premiumUiWindowBodyClassName} p-4 flex-1 min-h-0 overflow-y-auto modal-scroll-panel` : 'p-6 flex-1 min-h-0 overflow-y-auto modal-scroll-panel'}>
                    {!isPremiumUi && (
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">
                                {String(t('modals:nameInput.title', { difficulty } as any))}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    )}

                    {hasActiveGame && (
                        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex flex-col gap-1">
                            <span className="font-bold">{t('modals:nameInput.activeGameWarning')}</span>
                            <span className="text-amber-700/80">{t('modals:nameInput.activeGameMessage')}</span>
                        </div>
                    )}

                    <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 leading-relaxed">
                        {t('modals:nameInput.privacyNotice')}
                    </div>

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
                                maxLength={PLAYER_NAME_MAX_LENGTH}
                                enterKeyHint="done"
                                className={`
                            w-full px-4 py-3 rounded-xl border-2 outline-none transition-all
                            font-medium text-gray-800 placeholder-gray-400
                            ${error
                                        ? 'border-red-300 focus:border-red-500 bg-red-50'
                                        : 'border-gray-200 focus:border-blue-500 bg-gray-50 focus:bg-white'
                                    }
                        `}
                                autoFocus={!isAndroid}
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
