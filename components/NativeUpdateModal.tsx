import React from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type NativeUpdateRequirement } from '../services/nativeUpdate';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface NativeUpdateModalProps {
  open: boolean;
  requirement: NativeUpdateRequirement | null;
  isOpeningStore: boolean;
  onUpdateNow: () => void;
}

export const NativeUpdateModal: React.FC<NativeUpdateModalProps> = ({
  open,
  requirement,
  isOpeningStore,
  onUpdateNow,
}) => {
  const { t } = useTranslation();
  useBodyScrollLock(open);

  if (!open || !requirement) return null;

  const storeLabel = requirement.platform === 'ios'
    ? t('modals:updateRequired.store.apple')
    : t('modals:updateRequired.store.google');

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 modal-safe-overlay">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/30 bg-white/95 shadow-2xl shadow-slate-900/30 modal-safe-panel overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll-panel p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            <ArrowUpCircle size={28} />
          </div>

          <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">
            {t('modals:updateRequired.title')}
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-gray-600">
            {t('modals:updateRequired.description')}
          </p>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {t('modals:updateRequired.currentVersionLabel')}
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{requirement.currentVersion}</p>

          {requirement.latestVersion && (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {t('modals:updateRequired.latestVersionLabel')}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{requirement.latestVersion}</p>
            </>
          )}
          </div>

          <p className="mt-3 text-center text-xs text-gray-500">
            {String(t('modals:updateRequired.storeHint', { store: storeLabel } as any))}
          </p>

          <button
          type="button"
          onClick={onUpdateNow}
          disabled={isOpeningStore}
          className={`
            mt-5 w-full rounded-2xl px-4 py-3.5 text-base font-bold text-white transition-all duration-200
            ${isOpeningStore
              ? 'cursor-wait bg-blue-400'
              : 'bg-blue-600 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/35 active:translate-y-0 active:scale-[0.99]'}
          `}
        >
          {isOpeningStore
            ? t('modals:updateRequired.openingButton')
            : t('modals:updateRequired.updateButton')}
          </button>
        </div>
      </div>
    </div>
  );
};
