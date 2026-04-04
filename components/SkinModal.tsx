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
import { trackAnalyticsEvent } from '../services/analyticsService';
import { getSkinFallbackDisplayName } from '../services/skinDisplayName';
import { SkinAcquisitionOverlay } from './SkinAcquisitionOverlay';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

type SkinModalProps = {
  open: boolean;
  onClose: () => void;
};

type SkinSectionKey = 'premium' | 'neon' | 'liquid' | 'mesh' | 'normal';

// 스킨 미리보기 타일 렌더링
const SkinPreviewTile = React.memo<{ value: number; skin: { id?: string; hex: string; style?: any }; tilePx: number }>(
  ({ value, skin, tilePx }) => {
    const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
    const premiumUiTileFaceClassName = premiumUiObjects.extended.text.tileFaceClassName;
    const premiumUiTileNumberClassName = premiumUiObjects.extended.text.tileNumberClassName;
    const { className, style } = resolveSkinAppearance(value, skin);
    const isNeonBlock = className === 'skin-neon-block';
    const { text, fontPx } = getTileNumberLayout(value, tilePx);

    return (
      <div
        className={`${isNeonBlock ? '' : 'rounded-2xl'} ${isPremiumUiThemeActive ? premiumUiTileFaceClassName : ''} flex items-center justify-center font-semibold ${isNeonBlock ? '' : 'overflow-hidden'} text-center select-none shrink-0 ${className}`}
        data-skin-preview-tile="true"
        data-premium-ui-allow-gradient="true"
        data-premium-ui-allow-shadow="true"
        style={{
          width: `${tilePx}px`,
          height: `${tilePx}px`,
          fontSize: `${fontPx}px`,
          lineHeight: 1,
          whiteSpace: 'pre-line',
          ...style,
        }}
      >
        <span className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}>{text}</span>
      </div>
    );
  }
);

export function SkinModal({ open, onClose }: SkinModalProps) {
  const { t, i18n } = useTranslation();
  useBodyScrollLock(open);
  const {
    skinSettings,
    activeSkin,
    addSkin,
    setActiveSkin,
    isPremiumUiThemeActive,
    premiumUiObjects,
    premiumUiOverrides,
    addFragments,
    purchaseSkin,
  } = useBlockCustomization();
  const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
  const premiumUiWindowClassName = premiumUiObjects.windowClassName;
  const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
  const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
  const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
  const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
  const premiumUiStatusBarContainerClassName = premiumUiObjects.extended.statusBar.containerClassName;
  const premiumUiStatusBarFieldClassName = premiumUiObjects.extended.statusBar.fieldClassName;
  const premiumUiFieldRowStackedClassName = premiumUiObjects.extended.forms.fieldRowStackedClassName;
  const premiumUiSunkenClassName = premiumUiObjects.panels.sunkenClassName;
  const premiumUiListItemHighlightClassName = premiumUiObjects.panels.listItemHighlightClassName;
  const premiumUiSkinTabStripClassName = premiumUiObjects.tabs.skin.containerClassName;
  const premiumUiSkinTabButtonClassName = premiumUiObjects.tabs.skin.buttonClassName;
  const premiumUiCompartmentButtonClassName = premiumUiObjects.buttons.compartmentClassName;
  const premiumUiModalWindowClassName = premiumUiObjects.extended.windows.modalWindowClassName;
  const [selectedSkinHex, setSelectedSkinHex] = useState<string | null>(null);
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null);
  const [acquisitionSkin, setAcquisitionSkin] = useState<{ id?: string; hex: string; style?: any } | null>(null);
  const [acquisitionIsDuplicate, setAcquisitionIsDuplicate] = useState(false);
  const [remainingAds, setRemainingAds] = useState(skinRewardAdService.getRemainingDailyViews());
  const [adError, setAdError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Readonly<Record<SkinSectionKey, boolean>>>({
    premium: true,
    neon: true,
    liquid: true,
    mesh: true,
    normal: true,
  });

  const ownedIds = useMemo(
    () => new Set(skinSettings.ownedSkins.map(s => s.id)),
    [skinSettings.ownedSkins]
  );
  const ownedCatalogCount = useMemo(
    () => SKIN_CATALOG.reduce((count, entry) => count + (ownedIds.has(entry.id) ? 1 : 0), 0),
    [ownedIds]
  );

  const collectionComplete = useMemo(
    () => isCollectionComplete(skinSettings),
    [skinSettings]
  );

  // 스킨 이름 표시 헬퍼
  const getSkinDisplayName = useCallback((skin: { id?: string; hex: string; nameKey?: string }) => {
    const fallbackName = getSkinFallbackDisplayName(skin, i18n.language);
    if ('nameKey' in skin && skin.nameKey) {
      return t(`skins:${skin.nameKey}`, fallbackName);
    }
    return fallbackName;
  }, [i18n.language, t]);

  // 섹션별 그룹화 (일반 / 프리미엄 / 메쉬 그라디언트)
  const COLS = 6;
  const isMeshSwatchSkin = (id: string) => id.startsWith('skin_mesh_swatch');
  const isLiquidGlassSkin = (id: string) => id.startsWith('skin_digital_liquid_glass');
  const isNeonParallelSkin = (id: string) => id.startsWith('skin_digital_neon_block_parallel_');
  const isNeonSkin = (id: string) => id === 'skin_digital_neon_block' || isNeonParallelSkin(id);
  type SkinSection = {
    key: SkinSectionKey;
    titleKey: string;
    skins: typeof SKIN_CATALOG[number][];
    rows: typeof SKIN_CATALOG[number][][];
    rowOffset: number; // 전체 행 기준 offset (selectedRowIndex 계산용)
  };
  const skinSections = useMemo((): SkinSection[] => {
    const premium = SKIN_CATALOG.filter(e => e.premium);
    const neon = SKIN_CATALOG.filter(e => !e.premium && isNeonSkin(e.id));
    const liquidGlass = SKIN_CATALOG.filter(e => isLiquidGlassSkin(e.id));
    const mesh = SKIN_CATALOG.filter(e => isMeshSwatchSkin(e.id));
    const normal = SKIN_CATALOG.filter(
      (e) => !e.premium && !isNeonSkin(e.id) && !isMeshSwatchSkin(e.id) && !isLiquidGlassSkin(e.id)
    );

    const toRows = (arr: typeof SKIN_CATALOG[number][]) => {
      const r: typeof SKIN_CATALOG[number][][] = [];
      for (let i = 0; i < arr.length; i += COLS) r.push(arr.slice(i, i + COLS));
      return r;
    };

    const neonRows = toRows(neon);
    const liquidGlassRows = toRows(liquidGlass);
    const meshRows = toRows(mesh);
    const normalRows = toRows(normal);
    const premiumRows = toRows(premium);

    return [
      { key: 'premium', titleKey: 'modals:skin.sectionPremium', skins: premium, rows: premiumRows, rowOffset: 0 },
      {
        key: 'neon',
        titleKey: 'modals:skin.sectionNeon',
        skins: neon,
        rows: neonRows,
        rowOffset: premiumRows.length,
      },
      {
        key: 'liquid',
        titleKey: 'modals:skin.sectionLiquidGlass',
        skins: liquidGlass,
        rows: liquidGlassRows,
        rowOffset: premiumRows.length + neonRows.length,
      },
      {
        key: 'mesh',
        titleKey: 'modals:skin.sectionMesh',
        skins: mesh,
        rows: meshRows,
        rowOffset: premiumRows.length + neonRows.length + liquidGlassRows.length,
      },
      {
        key: 'normal',
        titleKey: 'modals:skin.sectionNormal',
        skins: normal,
        rows: normalRows,
        rowOffset: premiumRows.length + neonRows.length + liquidGlassRows.length + meshRows.length,
      },
    ];
  }, []);

  const toggleSection = useCallback((sectionKey: SkinSectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }, []);

  // 선택된 스킨이 속한 [섹션인덱스, 행인덱스] 계산
  const selectedLocation = useMemo(() => {
    if (!selectedSkinId) return null;
    for (let si = 0; si < skinSections.length; si++) {
      const sec = skinSections[si];
      const idx = sec.skins.findIndex(e => e.id === selectedSkinId);
      if (idx >= 0) return { sectionIdx: si, rowIdx: Math.floor(idx / COLS) };
    }
    return null;
  }, [selectedSkinId, skinSections]);

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
    trackAnalyticsEvent({ name: 'ad_skin_draw_request' });

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
        trackAnalyticsEvent({ name: 'ad_skin_draw_rewarded' });
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
  const [isPurchasing, setIsPurchasing] = useState(false);
  const handlePurchase = useCallback((skinId: string) => {
    if (isPurchasing) return; // 더블클릭 방지
    const entry = SKIN_CATALOG.find(e => e.id === skinId);
    if (!entry) return;
    // 방어 코드: UI가 이미 막고 있지만, 이중 확인
    if (ownedIds.has(skinId)) return;
    const cost = getFragmentCost(skinId);
    if (skinSettings.fragments < cost) return;
    setIsPurchasing(true);
    purchaseSkin(skinId);
    setAcquisitionSkin({ id: entry.id, hex: entry.hex, style: entry.style });
    setAcquisitionIsDuplicate(false);
    // 다음 렌더 사이클에서 isPurchasing 해제 (React state 업데이트 후)
    requestAnimationFrame(() => setIsPurchasing(false));
  }, [isPurchasing, purchaseSkin, ownedIds, skinSettings.fragments]);

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

  if (isPremiumUiThemeActive) {
    return (
      <>
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 modal-safe-overlay"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* Windows 98 Dotted Overlay or Solid Background */}
          <div className={`absolute inset-0 ${premiumUiModalOverlayClassName}`} onClick={onClose} />

          <div className={`${premiumUiWindowClassName} relative z-10 w-full max-w-lg shadow-none flex flex-col max-h-[calc(100dvh-2rem)] modal-safe-panel`} style={{ width: '100%' }}>
            <div className={premiumUiTitleBarClassName}>
              <div className={premiumUiTitleBarTextClassName}>
                {t('modals:skin.title')}
              </div>
              <div className={premiumUiTitleBarControlsClassName}>
                <button aria-label="Close" onClick={onClose} />
              </div>
            </div>

            <div className={`${premiumUiWindowBodyClassName} flex-1 min-h-0 overflow-y-auto modal-scroll-panel`}>
              <p className={premiumUiStatusBarFieldClassName} style={{ marginBottom: '12px' }}>
                {String(t('modals:skin.ownedCount', { owned: ownedCatalogCount, total: SKIN_CATALOG.length } as any))}
                {' | 🧩 '}{skinSettings.fragments}
              </p>

              <div className={premiumUiSunkenClassName} style={{ minHeight: '180px', padding: '8px' }}>
                <div className="space-y-4">
                  {skinSections.map((section, sectionIdx) => (
                    <div key={sectionIdx}>
                      <div className={premiumUiSkinTabStripClassName} style={{ padding: 0, borderBottom: 'none', marginBottom: '6px' }}>
                        <button
                          type="button"
                          aria-expanded={openSections[section.key]}
                          onClick={() => toggleSection(section.key)}
                          className={premiumUiSkinTabButtonClassName}
                          data-active="true"
                          style={{ marginBottom: 0, padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span className="font-bold" aria-hidden="true">{openSections[section.key] ? '▾' : '▸'}</span>
                          {sectionIdx === 0 ? <span className="font-bold">&#9670;</span> : sectionIdx === 1 ? <span className="font-bold">&#9670;</span> : <span className="font-bold">&#9632;</span>}
                          {t(section.titleKey as any)}
                          <span style={{ marginLeft: '2px', fontWeight: 'normal' }}>({section.skins.length})</span>
                        </button>
                      </div>
                      {openSections[section.key] && section.rows.map((rowSkins, rowIndex) => (
                        <React.Fragment key={rowIndex}>
                          <div className="grid grid-cols-6 gap-2">
                            {rowSkins.map((entry) => {
                              const isOwned = ownedIds.has(entry.id);
                              const isActive = skinSettings.activeSkinId === entry.id;
                              const isSelected = selectedSkinId === entry.id;
                              const swatchPreviewValue = isLiquidGlassSkin(entry.id) ? 64 : 16;
                              const { className, style } = resolveSkinAppearance(swatchPreviewValue, entry);

                              return (
                                <div
                                  key={entry.id}
                                  onClick={() => handleSkinTap(entry.id, entry.hex)}
                                  className={`relative aspect-square flex items-center justify-center cursor-pointer ${premiumUiCompartmentButtonClassName} ${isSelected ? premiumUiListItemHighlightClassName : ''}`}
                                  style={{ boxSizing: 'border-box' }}
                                >
                                  <div className={`w-full h-full relative ${className}`} style={{ ...style, borderRadius: 0 }} data-premium-ui-allow-gradient="true" data-premium-ui-allow-shadow="true" data-skin-swatch="true">
                                    {!isOwned && <div className="absolute inset-0 z-[5] bg-black/30" />}
                                    {entry.premium && (
                                      <div className="absolute top-0 right-0 z-20" style={{ fontSize: '8px', lineHeight: 1 }}>💎</div>
                                    )}
                                    {isActive && (
                                      <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="font-bold">v</span>
                                      </div>
                                    )}
                                    {!isOwned && !isActive && (
                                      <div className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="text-lg">🔒</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Preview for Win98 */}
                          {selectedLocation?.sectionIdx === sectionIdx && selectedLocation?.rowIdx === rowIndex && selectedSkinId && (
                            <div className={`${premiumUiFieldRowStackedClassName} border border-dotted border-gray-400 my-1 p-2`}>
                              <label>{getSkinDisplayName(previewSkin as any)}</label>
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
                                          className={premiumUiCompartmentButtonClassName}
                                          disabled={!canAfford}
                                          onClick={() => handlePurchase(selectedSkinId)}
                                          style={{ width: '100%', marginTop: '4px', fontWeight: canAfford ? 'bold' : 'normal' }}
                                        >
                                          {canAfford
                                            ? String(t('modals:skin.purchaseButton', { cost } as any))
                                            : String(t('modals:skin.insufficientFragments', { current: skinSettings.fragments, cost } as any))}
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
                  ))}
                </div>
              </div>

              {isSkinRewardAdSupported() && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  {collectionComplete && (
                    <div className={`${premiumUiFieldRowStackedClassName} bg-info text-center justify-center`} style={{ marginBottom: '4px' }}>
                      <p>{t('modals:skin.collectionComplete')}</p>
                    </div>
                  )}
                  {remainingAds > 0 ? (
                    <button className={premiumUiCompartmentButtonClassName} onClick={handleDraw} style={{ width: '100%', height: '32px', fontWeight: 'bold' }}>
                      {t('modals:skin.drawButton')} ({remainingAds}/{MAX_DAILY_SKIN_AD_VIEWS})
                    </button>
                  ) : (
                    <button className={premiumUiCompartmentButtonClassName} disabled style={{ width: '100%' }}>
                      {t('modals:skin.dailyLimit')}
                    </button>
                  )}
                  {adError && <p style={{ color: 'red', marginTop: '4px' }}>{adError}</p>}
                </div>
              )}
            </div>

            {/* Status Bar */}
            <div className={premiumUiStatusBarContainerClassName} style={{ marginTop: '4px' }}>
              <p className={premiumUiStatusBarFieldClassName}>{premiumUiOverrides?.statusBarText ?? 'Block Slide'}</p>
              <p className={`${premiumUiStatusBarFieldClassName} justify-right`}>{premiumUiOverrides?.statusBarVersion ?? 'v1.0'}</p>
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
        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 modal-safe-overlay"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

        <div className={`relative z-10 w-full max-w-lg max-h-[90dvh] modal-safe-panel rounded-3xl bg-white/90 backdrop-blur-sm border border-white/60 shadow-2xl overflow-hidden flex flex-col ${isPremiumUiThemeActive ? premiumUiModalWindowClassName : ''}`}>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('modals:skin.title')}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{String(t('modals:skin.ownedCount', { owned: ownedCatalogCount, total: SKIN_CATALOG.length } as any))}</span>
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
          <div className="p-5 overflow-y-auto min-h-0 flex-1 space-y-5 modal-scroll-panel">
            {/* 섹션별 컬렉션 그리드 */}
            <div className="space-y-5">
              {skinSections.map((section, sectionIdx) => (
                <div key={sectionIdx}>
                  {/* 섹션 헤더 */}
                  <button
                    type="button"
                    aria-expanded={openSections[section.key]}
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center gap-2 mb-2.5 text-left"
                  >
                    <span className="text-xs text-gray-400" aria-hidden="true">{openSections[section.key] ? '▾' : '▸'}</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {t(section.titleKey as any)}{sectionIdx === 0 ? ' 💎' : sectionIdx === 1 ? ' ✦' : ''}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">{section.skins.length}</span>
                  </button>
                  {openSections[section.key] && (
                    <div className="space-y-2.5">
                    {section.rows.map((rowSkins, rowIndex) => (
                      <React.Fragment key={rowIndex}>
                        {/* 스킨 행 */}
                        <div className="grid grid-cols-6 gap-2.5">
                          {rowSkins.map((entry) => {
                            const isOwned = ownedIds.has(entry.id);
                            const isActive = skinSettings.activeSkinId === entry.id;
                            const isSelected = selectedSkinId === entry.id;
                            const swatchPreviewValue = isLiquidGlassSkin(entry.id) ? 64 : 16;
                            const { className, style } = resolveSkinAppearance(swatchPreviewValue, entry);
                            const isNeonSwatch = isNeonSkin(entry.id);

                            return (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => handleSkinTap(entry.id, entry.hex)}
                                className={`
                                  relative aspect-square rounded-2xl transition-all duration-150 ${isNeonSwatch ? '' : 'overflow-hidden'}
                                  ${isSelected ? 'ring-2 ring-gray-900 ring-offset-2' : 'ring-1 ring-black/5'}
                                  ${className}
                                `}
                                style={style}
                              >
                                {!isOwned && (
                                  <div className="absolute inset-0 bg-black/40 z-[5]" />
                                )}
                                {entry.premium && (
                                  <div className="absolute top-0.5 right-0.5 z-20 text-[8px] leading-none drop-shadow">💎</div>
                                )}
                                {isActive && (
                                  <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                                      <Check size={14} className="text-gray-900" />
                                    </div>
                                  </div>
                                )}
                                {!isOwned && !isActive && (
                                  <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-md border border-white/20">
                                      <Lock size={14} className="text-white drop-shadow-md" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* 선택된 스킨의 행이면 바로 아래에 미리보기 드롭다운 */}
                        <AnimatePresence>
                          {selectedLocation?.sectionIdx === sectionIdx && selectedLocation?.rowIdx === rowIndex && selectedSkinId && (
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
                                    {getSkinDisplayName(previewSkin as any)}
                                  </span>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
                                  {SKIN_PREVIEW_VALUES.map((v) => (
                                    <SkinPreviewTile key={v} value={v} skin={previewSkin} tilePx={52} />
                                  ))}
                                </div>
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
                                            className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-all ${canAfford
                                              ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]'
                                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                              }`}
                                          >
                                            {canAfford
                                              ? String(t('modals:skin.purchaseButton', { cost } as any))
                                              : String(t('modals:skin.insufficientFragments', { current: skinSettings.fragments, cost } as any))}
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
                  )}
                </div>
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
