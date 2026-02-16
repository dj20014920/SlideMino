import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, X } from 'lucide-react';
import { SKIN_CATALOG, SKIN_PREVIEW_VALUES, MAX_DAILY_SKIN_AD_VIEWS, FRAGMENTS_PER_DUPLICATE } from '../constants';
import { getTileNumberLayout } from '../constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import type { SkinItem, SkinDrawResult } from '../types';
import { getSkinColorForValue, resolveSkinAppearance } from '../services/blockCustomization';
import { buildGradient, getWhiteTextStyleForBackground, hexToRgb } from '../services/blockCustomization';
import { drawSkin, isCollectionComplete, getFragmentCost } from '../services/skinService';
import { skinRewardAdService } from '../services/skinRewardAdService';
import { isSkinRewardAdSupported } from '../services/adConfig';
import { SkinAcquisitionOverlay } from './SkinAcquisitionOverlay';

type SkinModalProps = {
  open: boolean;
  onClose: () => void;
};

// 스킨 미리보기 타일 렌더링
const SkinPreviewTile = React.memo<{ value: number; skin: { id?: string; hex: string; style?: any }; tilePx: number }>(
  ({ value, skin, tilePx }) => {
    const { className, style } = resolveSkinAppearance(value, skin);
    const { text, fontPx } = getTileNumberLayout(value, tilePx);

    return (
      <div
        className={`rounded-2xl win98-tile-face flex items-center justify-center font-semibold overflow-hidden text-center select-none shrink-0 ${className}`}
        data-skin-preview-tile="true"
        data-win98-allow-gradient="true"
        data-win98-allow-shadow="true"
        style={{
          width: `${tilePx}px`,
          height: `${tilePx}px`,
          fontSize: `${fontPx}px`,
          lineHeight: 1,
          whiteSpace: 'pre-line',
          ...style,
        }}
      >
        <span className="win98-tile-number">{text}</span>
      </div>
    );
  }
);

export function SkinModal({ open, onClose }: SkinModalProps) {
  const { t } = useTranslation();
  const { skinSettings, activeSkin, addSkin, setActiveSkin, isWin98ThemeActive, addFragments, purchaseSkin } = useBlockCustomization();
  const [selectedSkinHex, setSelectedSkinHex] = useState<string | null>(null);
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null);
  const [acquisitionSkin, setAcquisitionSkin] = useState<{ id?: string; hex: string; style?: any } | null>(null);
  const [acquisitionIsDuplicate, setAcquisitionIsDuplicate] = useState(false);
  const [remainingAds, setRemainingAds] = useState(skinRewardAdService.getRemainingDailyViews());
  const [adError, setAdError] = useState<string | null>(null);

  const ownedIds = useMemo(
    () => new Set(skinSettings.ownedSkins.map(s => s.id)),
    [skinSettings.ownedSkins]
  );

  const collectionComplete = useMemo(
    () => isCollectionComplete(skinSettings),
    [skinSettings]
  );

  // 그리드를 행(row) 단위로 나누기 (6열)
  const COLS = 6;
  const skinRows = useMemo(() => {
    const rows: typeof SKIN_CATALOG[] = [];
    for (let i = 0; i < SKIN_CATALOG.length; i += COLS) {
      rows.push(SKIN_CATALOG.slice(i, i + COLS) as any);
    }
    return rows;
  }, []);

  // 선택된 스킨이 속한 행 인덱스 계산
  const selectedRowIndex = useMemo(() => {
    if (!selectedSkinId) return -1;
    const idx = SKIN_CATALOG.findIndex(e => e.id === selectedSkinId);
    return idx >= 0 ? Math.floor(idx / COLS) : -1;
  }, [selectedSkinId]);

  // 모달 열릴 때 광고 미리 로드
  useEffect(() => {
    if (open && isSkinRewardAdSupported()) {
      skinRewardAdService.preloadAd();
      setRemainingAds(skinRewardAdService.getRemainingDailyViews());
    }
  }, [open]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // 스킨 카탈로그 항목 탭 처리
  const handleSkinTap = useCallback((id: string, hex: string) => {
    const isOwned = ownedIds.has(id);
    setSelectedSkinHex(hex);
    setSelectedSkinId(id);

    // 보유 스킨: 즉시 적용 (이미 활성이면 해제)
    if (isOwned) {
      setActiveSkin(skinSettings.activeSkinId === id ? null : id);
    }
    // 미보유: 미리보기만 (적용 안 함)
  }, [ownedIds, skinSettings.activeSkinId, setActiveSkin]);

  // 광고 시청 후 스킨 뽑기
  const handleDraw = useCallback(() => {
    setAdError(null);

    let drawResult: SkinDrawResult | null = null;
    let adClosed = false;

    const startAcquisitionAfterClose = () => {
      if (!adClosed || !drawResult) return;

      if (drawResult.type === 'new') {
        setAcquisitionSkin(drawResult.skin);
        setAcquisitionIsDuplicate(false);
        addSkin(drawResult.skin);
      } else {
        // 중복 → 조각 지급
        setAcquisitionSkin({ id: drawResult.skin.id, hex: drawResult.skin.hex, style: drawResult.skin.style });
        setAcquisitionIsDuplicate(true);
        addFragments(drawResult.fragmentsEarned);
      }

      setRemainingAds(skinRewardAdService.getRemainingDailyViews());
      drawResult = null;
    };

    skinRewardAdService.showRewardAd({
      onRewardEarned: () => {
        const result = drawSkin(skinSettings);
        if (!result) return;

        drawResult = result;
        startAcquisitionAfterClose();
      },
      onAdClosed: () => {
        adClosed = true;
        startAcquisitionAfterClose();
        setRemainingAds(skinRewardAdService.getRemainingDailyViews());
      },
      onError: (error) => {
        setAdError(error.message);
      },
      onDailyLimitReached: () => {
        setRemainingAds(0);
      },
    });
  }, [skinSettings, addSkin, addFragments]);

  // 조각으로 스킨 교환
  const handlePurchase = useCallback((skinId: string) => {
    const entry = SKIN_CATALOG.find(e => e.id === skinId);
    if (!entry) return;
    // 방어 코드: UI가 이미 막고 있지만, 이중 확인
    if (ownedIds.has(skinId)) return;
    const cost = getFragmentCost(skinId);
    if (skinSettings.fragments < cost) return;
    purchaseSkin(skinId);
    setAcquisitionSkin({ id: entry.id, hex: entry.hex, style: entry.style });
    setAcquisitionIsDuplicate(false);
  }, [purchaseSkin, ownedIds, skinSettings.fragments]);

  // 미리보기 표시할 스킨: 선택된 스킨 > 활성 스킨 > 첫 번째 카탈로그
  const previewSkin = useMemo(() => {
    if (selectedSkinId) {
      const entry = SKIN_CATALOG.find((s) => s.id === selectedSkinId);
      return entry ?? { hex: selectedSkinHex ?? '#64748b' };
    }
    if (activeSkin) return activeSkin;
    return SKIN_CATALOG[0] ?? { hex: '#64748b' };
  }, [selectedSkinId, selectedSkinHex, activeSkin]);

  if (!open) return null;

  if (isWin98ThemeActive) {
    return (
      <>
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* Windows 98 Dotted Overlay or Solid Background */}
          <div className="absolute inset-0 bg-[#000000] opacity-50" onClick={onClose} />

          <div className="window relative z-10 w-full max-w-lg shadow-none flex flex-col max-h-[calc(100dvh-2rem)]" style={{ width: '100%', backgroundColor: '#c0c0c0', color: '#222' }}>
            <div className="title-bar" style={{ background: 'linear-gradient(90deg, #000080, #1084d0)' }}>
              <div className="title-bar-text" style={{ color: '#fff' }}>
                {t('modals:skin.title')}
              </div>
              <div className="title-bar-controls">
                <button aria-label="Close" onClick={onClose} />
              </div>
            </div>

            <div className="window-body flex-1 min-h-0 overflow-hidden">
              <p className="status-bar-field" style={{ marginBottom: '12px' }}>
                {String(t('modals:skin.ownedCount', { owned: skinSettings.ownedSkins.length, total: SKIN_CATALOG.length } as any))}
                {' | 🧩 '}{skinSettings.fragments}
              </p>

              <div className="sunken-panel" style={{ height: '100%', minHeight: '180px', overflowY: 'scroll', padding: '6px', backgroundColor: '#c0c0c0' }}>
                <div className="space-y-4">
                  {skinRows.map((rowSkins, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      <div className="grid grid-cols-6 gap-1">
                        {rowSkins.map((entry) => {
                          const isOwned = ownedIds.has(entry.id);
                          const isActive = skinSettings.activeSkinId === entry.id;
                          const isSelected = selectedSkinId === entry.id;
                          const { className, style } = resolveSkinAppearance(16, entry);

                          return (
                            <div
                              key={entry.id}
                              onClick={() => handleSkinTap(entry.id, entry.hex)}
                              className={`
                                relative aspect-square flex items-center justify-center cursor-pointer border-2
                                ${isSelected ? 'border-black' : isOwned ? 'border-transparent' : 'border-transparent opacity-50'}
                              `}
                              style={{
                                boxSizing: 'border-box',
                                backgroundColor: '#c0c0c0', 
                                boxShadow: isSelected 
                                  ? 'inset 1px 1px #000, inset -1px -1px #fff' // Pressed look
                                  : 'inset -1px -1px #000, inset 1px 1px #fff' // Raised look
                              }}
                            >
                              <div className={`w-full h-full ${className}`} style={style} data-win98-allow-gradient="true" data-win98-allow-shadow="true" data-skin-swatch="true">
                                {entry.premium && (
                                  <div className="absolute top-0 right-0 z-20" style={{ fontSize: '8px', lineHeight: 1 }}>💎</div>
                                )}
                                {isActive && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                     <span style={{ color: '#000', fontWeight: 'bold', textShadow: '1px 1px 0 #fff' }}>v</span>
                                  </div>
                                )}
                                {!isOwned && !isActive && (
                                   <div className="absolute inset-0 flex items-center justify-center">
                                      <span style={{ fontSize: '10px' }}>🔒</span>
                                   </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Preview for Win98 */}
                      {selectedRowIndex === rowIndex && selectedSkinId && (
                        <div className="field-row-stacked" style={{ padding: '8px', border: '1px dotted #808080', margin: '4px 0' }}>
                          <label>{('nameKey' in previewSkin && previewSkin.nameKey) 
                                ? t(`skins:${previewSkin.nameKey}`, previewSkin.hex.toUpperCase()) 
                                : previewSkin.hex.toUpperCase()}</label>
                          <div className="flex gap-1 overflow-x-auto pb-2">
                             {SKIN_PREVIEW_VALUES.map((v) => (
                               <SkinPreviewTile key={v} value={v} skin={previewSkin} tilePx={40} />
                             ))}
                          </div>
                          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '11px' }}>
                            {ownedIds.has(selectedSkinId) ? t('modals:skin.tapToApply') : (
                              <>
                                <div>{t('modals:skin.notOwned')}</div>
                                {(() => {
                                  const cost = getFragmentCost(selectedSkinId);
                                  const canAfford = skinSettings.fragments >= cost;
                                  return (
                                    <button
                                      disabled={!canAfford}
                                      onClick={() => handlePurchase(selectedSkinId)}
                                      style={{ width: '100%', marginTop: '4px', fontWeight: canAfford ? 'bold' : 'normal' }}
                                    >
                                      {canAfford
                                        ? t('modals:skin.purchaseButton', { cost })
                                        : t('modals:skin.insufficientFragments', { current: skinSettings.fragments, cost })}
                                    </button>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {isSkinRewardAdSupported() && (
                 <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    {collectionComplete && (
                      <div className="field-row bg-info text-center justify-center" style={{ marginBottom: '4px' }}>
                         <p>{t('modals:skin.collectionComplete')}</p>
                      </div>
                    )}
                    {remainingAds > 0 ? (
                      <button onClick={handleDraw} style={{ width: '100%', height: '32px', fontWeight: 'bold' }}>
                        {t('modals:skin.drawButton')} ({remainingAds}/{MAX_DAILY_SKIN_AD_VIEWS})
                      </button>
                    ) : (
                      <button disabled style={{ width: '100%' }}>
                        {t('modals:skin.dailyLimit')}
                      </button>
                    )}
                     {adError && <p style={{ color: 'red', marginTop: '4px' }}>{adError}</p>}
                 </div>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="status-bar" style={{ marginTop: '4px' }}>
              <p className="status-bar-field">SlideMino 98</p>
              <p className="status-bar-field justify-right">v1.1</p>
            </div>
          </div>
        </div>
      
      {/* 획득 애니메이션 오버레이 - Win98 스타일은 어떻게 할 것인가? 일단 그대로 유지 */}
      <AnimatePresence>
        {acquisitionSkin && (
          <SkinAcquisitionOverlay
             skin={acquisitionSkin}
             isDuplicate={acquisitionIsDuplicate}
             fragmentsEarned={acquisitionIsDuplicate ? FRAGMENTS_PER_DUPLICATE : undefined}
             totalFragments={skinSettings.fragments}
             onComplete={() => { setAcquisitionSkin(null); setAcquisitionIsDuplicate(false); }}
          />
        )}
      </AnimatePresence>
     </>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

        <div className="relative z-10 w-full max-w-lg max-h-[90dvh] rounded-3xl bg-white/90 backdrop-blur-sm border border-white/60 shadow-2xl overflow-hidden flex flex-col win98-window">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('modals:skin.title')}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{String(t('modals:skin.ownedCount', { owned: skinSettings.ownedSkins.length, total: SKIN_CATALOG.length } as any))}</span>
                  <span className="text-gray-300">|</span>
                  <span>🧩 {skinSettings.fragments}</span>
                </div>
              </div>
            <button
              type="button"
              className="p-2 rounded-xl bg-white/70 border border-white/60 text-gray-700 hover:bg-white shadow-sm transition-colors"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          {/* 본문 */}
          <div className="p-5 overflow-y-auto min-h-0 flex-1 space-y-5">
            {/* 컬렉션 그리드 (행 단위) */}
            <div className="space-y-2.5">
              {skinRows.map((rowSkins, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  {/* 스킨 행 */}
                  <div className="grid grid-cols-6 gap-2.5">
                    {rowSkins.map((entry) => {
                      const isOwned = ownedIds.has(entry.id);
                      const isActive = skinSettings.activeSkinId === entry.id;
                      const isSelected = selectedSkinId === entry.id;
                      
                      // For preview/thumbnail in grid, use resolved appearance of value 16
                      const { className, style } = resolveSkinAppearance(16, entry);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleSkinTap(entry.id, entry.hex)}
                          className={`
                            relative aspect-square rounded-2xl transition-all duration-150 overflow-hidden
                            ${isSelected ? 'ring-2 ring-gray-900 ring-offset-2' : 'ring-1 ring-black/5'}
                            ${!isOwned ? 'opacity-40 grayscale' : ''}
                            ${className}
                          `}
                          style={style}
                        >
                          {/* 프리미엄 배지 */}
                          {entry.premium && (
                            <div className="absolute top-0.5 right-0.5 z-20 text-[8px] leading-none drop-shadow">💎</div>
                          )}
                          {/* 활성 스킨 체크마크 */}
                          {isActive && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                              <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                                <Check size={14} className="text-gray-900" />
                              </div>
                            </div>
                          )}
                          {/* 미보유 잠금 아이콘 */}
                          {!isOwned && !isActive && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                              <Lock size={12} className="text-white/70 drop-shadow-md" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* 선택된 스킨의 행이면 바로 아래에 미리보기 드롭다운 */}
                  <AnimatePresence>
                    {selectedRowIndex === rowIndex && selectedSkinId && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 pb-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900">{t('modals:skin.preview')}</span>
                            <span className="text-xs font-mono text-gray-500">
                              {('nameKey' in previewSkin && previewSkin.nameKey) 
                                ? t(`skins:${previewSkin.nameKey}`, previewSkin.hex.toUpperCase()) 
                                : previewSkin.hex.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
                            {SKIN_PREVIEW_VALUES.map((v) => (
                              <SkinPreviewTile key={v} value={v} skin={previewSkin} tilePx={52} />
                            ))}
                          </div>
                          {/* 선택 상태 안내 + 교환 버튼 */}
                          <div className="text-xs text-center space-y-1.5">
                            {ownedIds.has(selectedSkinId) ? (
                              <span className="text-gray-500">{t('modals:skin.tapToApply')}</span>
                            ) : (
                              <>
                                <div className="text-gray-500">{t('modals:skin.notOwned')}</div>
                                {(() => {
                                  const cost = getFragmentCost(selectedSkinId);
                                  const canAfford = skinSettings.fragments >= cost;
                                  return (
                                    <button
                                      type="button"
                                      disabled={!canAfford}
                                      onClick={(e) => { e.stopPropagation(); handlePurchase(selectedSkinId); }}
                                      className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                        canAfford
                                          ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]'
                                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      }`}
                                    >
                                      {canAfford
                                        ? t('modals:skin.purchaseButton', { cost })
                                        : t('modals:skin.insufficientFragments', { current: skinSettings.fragments, cost })}
                                    </button>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </div>

            {/* 뽑기 버튼 영역 */}
            {isSkinRewardAdSupported() && (
              <div className="space-y-2">
                {collectionComplete && (
                  <div className="text-center py-2 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200/60 text-amber-700 font-semibold text-sm">
                    {t('modals:skin.collectionComplete')}
                  </div>
                )}
                {remainingAds > 0 ? (
                  <button
                    type="button"
                    onClick={handleDraw}
                    className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg"
                  >
                    {t('modals:skin.drawButton')}
                    <span className="ml-2 text-white/60">
                      ({remainingAds}/{MAX_DAILY_SKIN_AD_VIEWS})
                    </span>
                  </button>
                ) : (
                  <div className="text-center py-3 rounded-2xl bg-gray-100 border border-gray-200/60 text-gray-500 font-semibold text-sm">
                    {t('modals:skin.dailyLimit')}
                  </div>
                )}

                {adError && (
                  <div className="text-xs text-red-500 text-center">{adError}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 획득 애니메이션 오버레이 */}
      <AnimatePresence>
        {acquisitionSkin && (
          <SkinAcquisitionOverlay
            skin={acquisitionSkin}
            isDuplicate={acquisitionIsDuplicate}
            fragmentsEarned={acquisitionIsDuplicate ? FRAGMENTS_PER_DUPLICATE : undefined}
            totalFragments={skinSettings.fragments}
            onComplete={() => { setAcquisitionSkin(null); setAcquisitionIsDuplicate(false); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
