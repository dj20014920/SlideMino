import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Lock, Palette as PaletteIcon, RotateCcw, X } from 'lucide-react';
import { getTileNumberLayout } from '../constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import { getDefaultTileValuesForCustomization } from '../services/blockCustomization';
import type { TileSkinOverride } from '../types';
import { SquareImageCropperModal } from './SquareImageCropperModal';

type BlockCustomizationModalProps = {
  open: boolean;
  onClose: () => void;
};

type TabKey = 'global' | 'perValue';

const isPowerOfTwo = (n: number): boolean => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;

const getOverrideKind = (override: TileSkinOverride | undefined): 'default' | 'color' | 'image' => {
  if (!override) return 'default';
  return override.kind;
};

const TileSwatch = React.memo<{
  value: number;
  tilePx: number;
  selected: boolean;
  overrideKind: 'default' | 'color' | 'image';
  onSelect: () => void;
}>(({ value, tilePx, selected, overrideKind, onSelect }) => {
  const { t } = useTranslation();
  const { resolveTileAppearance } = useBlockCustomization();
  const appearance = resolveTileAppearance(value);
  const { text, fontPx } = getTileNumberLayout(value, tilePx);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative rounded-2xl p-1 transition
        ${selected ? 'ring-2 ring-gray-900/70' : 'ring-1 ring-black/5 hover:ring-black/10'}
      `}
      aria-label={String(t('common:aria.selectTile', { value } as any))}
    >
      <div
        className={`
          rounded-2xl flex items-center justify-center font-semibold overflow-hidden text-center select-none
          ${appearance.className}
        `}
        style={{
          width: `${tilePx}px`,
          height: `${tilePx}px`,
          fontSize: `${fontPx}px`,
          lineHeight: 1,
          whiteSpace: 'pre-line',
          ...(appearance.style ?? {}),
        }}
      >
        {text}
      </div>

      {overrideKind !== 'default' && (
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white/90 border border-black/10 shadow-sm flex items-center justify-center">
          {overrideKind === 'image' ? (
            <ImageIcon size={14} className="text-gray-800" />
          ) : (
            <PaletteIcon size={14} className="text-gray-800" />
          )}
        </div>
      )}
    </button>
  );
});

export function BlockCustomizationModal({ open, onClose }: BlockCustomizationModalProps) {
  const { t } = useTranslation();
  const { gate, settings, setSettings, resetAll } = useBlockCustomization();
  const [tab, setTab] = useState<TabKey>('global');
  const [selectedValue, setSelectedValue] = useState(1);
  const [jumpValue, setJumpValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cropState, setCropState] = useState<{ src: string; targetValue: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const allValues = useMemo(() => {
    const preset = getDefaultTileValuesForCustomization();
    const overrideValues = Object.keys(settings.perValue)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);
    const withSelected = [selectedValue, ...preset, ...overrideValues];
    const uniq = Array.from(new Set(withSelected)).sort((a, b) => a - b);
    return uniq;
  }, [settings.perValue, selectedValue]);

  const selectedOverride = settings.perValue[String(selectedValue)];
  const selectedKind = getOverrideKind(selectedOverride);

  const setGlobalPalette = (patch: Partial<typeof settings.globalPalette>) => {
    setSettings((prev) => ({
      ...prev,
      globalPalette: { ...prev.globalPalette, ...patch },
    }));
  };

  const setOverride = (value: number, override: TileSkinOverride | null) => {
    setSettings((prev) => {
      const key = String(value);
      const next = { ...prev.perValue };
      if (!override || override.kind === 'default') {
        delete next[key];
      } else {
        next[key] = override;
      }
      return { ...prev, perValue: next };
    });
  };

  const requestImagePick = () => {
    if (!gate.allowed) return;
    fileInputRef.current?.click();
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src.startsWith('data:image/')) return;
      setCropState({ src, targetValue: selectedValue });
    };
    reader.readAsDataURL(file);
  };

  const globalPreviewValues = useMemo(() => [1, 2, 4, 8, 16, 32, 64, 128], []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl max-h-[90dvh] rounded-3xl bg-white/90 backdrop-blur-sm border border-white/60 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-5 py-4 border-b border-black/5 gap-3 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{t('modals:blockCustomization.title')}</h3>
              {!gate.allowed && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white">
                  <Lock size={12} />
                  {gate.reasonKey ? t(gate.reasonKey as any) : t('game:actions.locked')}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 hidden sm:block">
              {t('modals:blockCustomization.description')}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              disabled={!gate.allowed}
              className={`
                px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-gray-700 shadow-sm transition-colors
                ${gate.allowed ? 'hover:bg-white' : 'opacity-60 cursor-not-allowed'}
              `}
              onClick={() => {
                if (!gate.allowed) return;
                const ok = window.confirm(t('modals:blockCustomization.resetConfirm'));
                if (!ok) return;
                resetAll();
              }}
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
                <RotateCcw size={16} />
                <span className="hidden sm:inline">{t('common:buttons.resetAll')}</span>
                <span className="sm:hidden">{t('common:buttons.reset')}</span>
              </span>
            </button>

            <button
              type="button"
              className="p-2 rounded-xl bg-white/70 border border-white/60 text-gray-700 hover:bg-white shadow-sm transition-colors"
              onClick={onClose}
              aria-label={t('common:aria.close')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-5 py-3 border-b border-black/5 shrink-0">
          <div className="inline-flex rounded-2xl bg-white/70 border border-white/60 shadow-sm overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold transition ${tab === 'global' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white'}`}
              onClick={() => setTab('global')}
            >
              {t('modals:blockCustomization.tabs.global')}
            </button>
            <button
              type="button"
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold transition ${tab === 'perValue' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white'}`}
              onClick={() => setTab('perValue')}
            >
              {t('modals:blockCustomization.tabs.perValue')}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1">
          {tab === 'global' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-gray-900">{t('modals:blockCustomization.global.title')}</div>
                    <div className="text-xs text-gray-500">{t('modals:blockCustomization.global.note')}</div>
                  </div>
                  <label className={`inline-flex items-center gap-2 text-sm font-semibold ${!gate.allowed ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={settings.globalPalette.enabled}
                      disabled={!gate.allowed}
                      onChange={(e) => setGlobalPalette({ enabled: e.target.checked })}
                    />
                    {t('modals:blockCustomization.global.enable')}
                  </label>
                </div>

                <div className={`space-y-3 ${(!settings.globalPalette.enabled || !gate.allowed) ? 'opacity-60' : ''}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 border border-white/60 p-4">
                      <span className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.global.baseColor')}</span>
                      <input
                        type="color"
                        value={settings.globalPalette.baseColor}
                        disabled={!gate.allowed || !settings.globalPalette.enabled}
                        onChange={(e) => setGlobalPalette({ baseColor: e.target.value })}
                        className="w-12 h-9"
                      />
                    </label>
                    <div className="rounded-2xl bg-white/60 border border-white/60 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.global.saturation')}</span>
                        <span className="text-xs text-gray-500 tabular-nums">{settings.globalPalette.saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.globalPalette.saturation}
                        disabled={!gate.allowed || !settings.globalPalette.enabled}
                        onChange={(e) => setGlobalPalette({ saturation: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/60 border border-white/60 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.global.brightness')}</span>
                        <span className="text-xs text-gray-500 tabular-nums">{settings.globalPalette.brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={settings.globalPalette.brightness}
                        disabled={!gate.allowed || !settings.globalPalette.enabled}
                        onChange={(e) => setGlobalPalette({ brightness: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <div className="rounded-2xl bg-white/60 border border-white/60 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.global.depth')}</span>
                        <span className="text-xs text-gray-500 tabular-nums">{settings.globalPalette.depth}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        step={1}
                        value={settings.globalPalette.depth}
                        disabled={!gate.allowed || !settings.globalPalette.enabled}
                        onChange={(e) => setGlobalPalette({ depth: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-gray-900">{t('modals:blockCustomization.global.preview')}</div>
                  <div className="text-xs text-gray-500">{t('modals:blockCustomization.global.previewNote')}</div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {globalPreviewValues.map((v) => (
                    <TileSwatch
                      key={v}
                      value={v}
                      tilePx={64}
                      selected={false}
                      overrideKind={getOverrideKind(settings.perValue[String(v)])}
                      onSelect={() => {
                        setSelectedValue(v);
                        setTab('perValue');
                      }}
                    />
                  ))}
                </div>

                <div className="rounded-2xl bg-white/60 border border-white/60 p-4 text-sm text-gray-600 leading-relaxed">
                  {t('modals:blockCustomization.global.description')}
                </div>
              </section>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6">
              {/* Left: value list */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-gray-900">{t('modals:blockCustomization.perValue.title')}</div>
                    <div className="text-xs text-gray-500">{t('modals:blockCustomization.perValue.note')}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t('modals:blockCustomization.perValue.jumpPlaceholder')}
                      value={jumpValue}
                      onChange={(e) => setJumpValue(e.target.value)}
                      className="w-36 px-3 py-2 rounded-2xl bg-white/70 border border-white/60 text-sm text-gray-800 shadow-sm"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 rounded-2xl bg-white/70 border border-white/60 text-sm font-semibold text-gray-700 hover:bg-white shadow-sm transition"
                      onClick={() => {
                        const n = Number(jumpValue);
                        if (!Number.isFinite(n) || !isPowerOfTwo(n)) return;
                        setSelectedValue(n);
                      }}
                    >
                      {t('modals:blockCustomization.perValue.jumpButton')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {allValues.map((v) => (
                    <TileSwatch
                      key={v}
                      value={v}
                      tilePx={56}
                      selected={v === selectedValue}
                      overrideKind={getOverrideKind(settings.perValue[String(v)])}
                      onSelect={() => setSelectedValue(v)}
                    />
                  ))}
                </div>
              </section>

              {/* Right: editor */}
              <section className="space-y-4">
                <div className="rounded-3xl bg-white/60 border border-white/60 shadow-sm p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{t('modals:blockCustomization.perValue.selectedBlock')}</div>
                      <div className="text-2xl font-bold text-gray-900 tabular-nums">{selectedValue}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {selectedKind === 'default'
                          ? (settings.globalPalette.enabled
                            ? t('modals:blockCustomization.perValue.status.defaultWithGlobal')
                            : t('modals:blockCustomization.perValue.status.default'))
                          : selectedKind === 'color'
                            ? t('modals:blockCustomization.perValue.status.color')
                            : t('modals:blockCustomization.perValue.status.image')}
                      </div>
                    </div>
                    <TileSwatch
                      value={selectedValue}
                      tilePx={88}
                      selected={false}
                      overrideKind={selectedKind}
                      onSelect={() => undefined}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-900">{t('modals:blockCustomization.perValue.mode')}</div>
                    <div className={`grid grid-cols-3 gap-2 ${!gate.allowed ? 'opacity-60' : ''}`}>
                      <button
                        type="button"
                        disabled={!gate.allowed}
                        onClick={() => setOverride(selectedValue, null)}
                        className={`px-3 py-2 rounded-2xl border shadow-sm text-sm font-semibold transition
                          ${selectedKind === 'default'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white/70 text-gray-700 border-white/60 hover:bg-white'}`}
                      >
                        {t('modals:blockCustomization.perValue.modes.default')}
                      </button>
                      <button
                        type="button"
                        disabled={!gate.allowed}
                        onClick={() => {
                          const color = selectedOverride?.kind === 'color' ? selectedOverride.color : '#64748b';
                          setOverride(selectedValue, { kind: 'color', color });
                        }}
                        className={`px-3 py-2 rounded-2xl border shadow-sm text-sm font-semibold transition
                          ${selectedKind === 'color'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white/70 text-gray-700 border-white/60 hover:bg-white'}`}
                      >
                        {t('modals:blockCustomization.perValue.modes.color')}
                      </button>
                      <button
                        type="button"
                        disabled={!gate.allowed}
                        onClick={() => {
                          if (selectedOverride?.kind === 'image') return;
                          requestImagePick();
                        }}
                        className={`px-3 py-2 rounded-2xl border shadow-sm text-sm font-semibold transition
                          ${selectedKind === 'image'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white/70 text-gray-700 border-white/60 hover:bg-white'}`}
                      >
                        {t('modals:blockCustomization.perValue.modes.image')}
                      </button>
                    </div>
                  </div>

                  {/* Color editor */}
                  {selectedKind === 'color' && (
                    <div className={`rounded-2xl bg-white/70 border border-white/60 p-4 space-y-3 ${!gate.allowed ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.perValue.colorPicker')}</div>
                        <input
                          type="color"
                          disabled={!gate.allowed}
                          value={selectedOverride?.kind === 'color' ? selectedOverride.color : '#64748b'}
                          onChange={(e) => setOverride(selectedValue, { kind: 'color', color: e.target.value })}
                          className="w-12 h-9"
                        />
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('modals:blockCustomization.perValue.colorNote')}
                      </div>
                      <button
                        type="button"
                        disabled={!gate.allowed}
                        onClick={() => setOverride(selectedValue, null)}
                        className="w-full px-3 py-2 rounded-2xl bg-white/70 border border-white/60 text-sm font-semibold text-gray-700 hover:bg-white shadow-sm transition"
                      >
                        {t('modals:blockCustomization.perValue.resetToDefault')}
                      </button>
                    </div>
                  )}

                  {/* Image editor */}
                  {selectedKind === 'image' && (
                    <div className={`rounded-2xl bg-white/70 border border-white/60 p-4 space-y-3 ${!gate.allowed ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.perValue.imageLabel')}</div>
                        <button
                          type="button"
                          disabled={!gate.allowed}
                          onClick={requestImagePick}
                          className="px-3 py-2 rounded-2xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 active:scale-95 transition"
                        >
                          {t('modals:blockCustomization.perValue.imageReplace')}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('modals:blockCustomization.perValue.imageNote')}
                      </div>
                      <button
                        type="button"
                        disabled={!gate.allowed}
                        onClick={() => setOverride(selectedValue, null)}
                        className="w-full px-3 py-2 rounded-2xl bg-white/70 border border-white/60 text-sm font-semibold text-gray-700 hover:bg-white shadow-sm transition"
                      >
                        {t('modals:blockCustomization.perValue.resetToDefault')}
                      </button>
                    </div>
                  )}

                  {selectedKind === 'default' && (
                    <div className="rounded-2xl bg-white/70 border border-white/60 p-4 text-sm text-gray-600 leading-relaxed">
                      {t('modals:blockCustomization.perValue.defaultNote')}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <div className="text-xs text-gray-500">{t('modals:blockCustomization.perValue.autoSave')}</div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            void onPickFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Cropper (nested modal) */}
      {cropState && (
        <SquareImageCropperModal
          open={!!cropState}
          src={cropState.src}
          onCancel={() => setCropState(null)}
          onConfirm={(dataUrl) => {
            setOverride(cropState.targetValue, { kind: 'image', imageDataUrl: dataUrl });
            setCropState(null);
          }}
        />
      )}
    </div>
  );
}
