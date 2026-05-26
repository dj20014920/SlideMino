import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, X } from 'lucide-react';
import { SKIN_CATALOG, SKIN_PREVIEW_VALUES, MAX_DAILY_SKIN_AD_VIEWS, FRAGMENTS_PER_DUPLICATE, SKIN_NEW_DURATION_MS } from '../constants';
import { getTileNumberLayout } from '../constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import type { SkinItem, SkinDrawResult } from '../types';
import {
  getSkinColorForValue,
  resolveSkinAppearance,
  TILE_NUMBER_INHERIT_STYLE,
  TILE_PREMIUM_UI_PRESERVE_ATTRS,
} from '../services/blockCustomization';
import { buildGradient, getWhiteTextStyleForBackground, hexToRgb } from '../services/blockCustomization';
import { drawSkin, isCollectionComplete, getFragmentCost } from '../services/skinService';
import { skinRewardAdService } from '../services/skinRewardAdService';
import { isSkinRewardAdSupported } from '../services/adConfig';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { getSkinFallbackDisplayName } from '../services/skinDisplayName';
import { measureRectInOverlaySpace, waitForStableRect } from '../services/tutorialTargetGeometry';
import { getPremiumUiThemeById } from '../config/premiumUiThemes';
import { SkinAcquisitionOverlay } from './SkinAcquisitionOverlay';
import { TutorialTooltip } from './TutorialTooltip';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import ExploreGalaxyOverlay from './ExploreGalaxyOverlay';

type SkinModalProps = {
  open: boolean;
  onClose: () => void;
  freeDraw?: boolean;
  onFreeDrawUsed?: (consumed: boolean) => void;
  autoDraw?: boolean;
};

type SkinSectionKey = 'premium' | 'cat' | 'dog' | 'neon' | 'liquid' | 'mesh' | 'normal';
const EXPLORE_GALAXY_SKIN_ID = 'skin_digital_explore_galaxy';
const PIXELBLAST_SKIN_ID = 'skin_digital_pixelblast_void';
const SKIN_SWATCH_GRID_CLASS_NAME = 'grid grid-cols-6 gap-2.5';
const SKIN_TUTORIAL_ANCHOR_INSET_PX = 1;
const getSkinItemTargetId = (skinId: string): string => `skin-item-${skinId}`;
let drawButtonGuideShownInSession = false;

const getThemeMaskVariant = (skinId?: string | null): 'pixelblast' | null => {
  if (!skinId) return null;
  if (skinId === PIXELBLAST_SKIN_ID) return 'pixelblast';
  return null;
};

// 스킨 미리보기 타일 렌더링
const SkinPreviewTile = React.memo<{ value: number; skin: { id?: string; hex: string; style?: any }; tilePx: number }>(
  ({ value, skin, tilePx }) => {
    const previewCatalogEntry = skin.id ? SKIN_CATALOG.find((entry) => entry.id === skin.id) : null;
    const previewThemeId = previewCatalogEntry?.premiumUiThemeId
      ?? (previewCatalogEntry?.premiumUiOverrides ? 'retro_windows_98' : null);
    const previewTheme = getPremiumUiThemeById(previewThemeId);
    const previewTileFaceClassName = previewTheme?.objects.extended.text.tileFaceClassName ?? '';
    const previewTileNumberClassName = previewTheme?.objects.extended.text.tileNumberClassName ?? '';
    const isPreviewPremiumSkin = Boolean(previewTheme);
    const shouldUsePremiumUiTextClasses = isPreviewPremiumSkin;
    const { className, style } = resolveSkinAppearance(
      value,
      skin,
      skin.id === PIXELBLAST_SKIN_ID ? { premiumUiThemeId: 'pixelblast_void' } : undefined,
    );
    const isNeonBlock = className === 'skin-neon-block';
    const isExploreGalaxy = skin.id === EXPLORE_GALAXY_SKIN_ID;
    const shouldUseRoundedCorner = !isNeonBlock && !isPreviewPremiumSkin;
    const themeMaskVariant = getThemeMaskVariant(skin.id);
    const { text, fontPx } = getTileNumberLayout(value, tilePx);

    const tileNode = (
      <div
        className={`${shouldUseRoundedCorner ? 'rounded-2xl' : ''} ${shouldUsePremiumUiTextClasses ? previewTileFaceClassName : ''} ${isExploreGalaxy ? 'explore-galaxy-phase-sync' : ''} relative flex items-center justify-center font-semibold ${isNeonBlock ? '' : 'overflow-hidden'} text-center select-none shrink-0 ${className}`}
        data-skin-preview-tile="true"
        {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
        style={{
          width: `${tilePx}px`,
          height: `${tilePx}px`,
          fontSize: `${fontPx}px`,
          lineHeight: 1,
          whiteSpace: 'pre-line',
          ...style,
        }}
      >
        {themeMaskVariant && (
          <span
            className={`skin-theme-mask skin-theme-mask--preview skin-theme-mask--${themeMaskVariant}`}
            aria-hidden="true"
          />
        )}
        {isExploreGalaxy && (
          <ExploreGalaxyOverlay
            size={4}
            cellPx={tilePx / 4}
            active
            mode="swatch"
            zIndex={1}
          />
        )}
        <span
          className={`relative z-[2] ${shouldUsePremiumUiTextClasses ? previewTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}
          style={TILE_NUMBER_INHERIT_STYLE}
        >
          {text}
        </span>
      </div>
    );

    return tileNode;
  }
);

export function SkinModal({ open, onClose, freeDraw, onFreeDrawUsed, autoDraw }: SkinModalProps) {
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
    commitSkinDrawResultPersisted,
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
  const [activeBigTab, setActiveBigTab] = useState<'premium' | 'normal'>('premium');
  const [openSections, setOpenSections] = useState<Readonly<Record<SkinSectionKey, boolean>>>({
    premium: true,
    cat: true,
    dog: true,
    neon: true,
    liquid: true,
    mesh: true,
    normal: true,
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── 무료 뽑기 상태 ──
  const [freeDrawResultSkinId, setFreeDrawResultSkinId] = useState<string | null>(null);
  const [freeDrawError, setFreeDrawError] = useState<string | null>(null);
  const [isProcessingFreeDraw, setIsProcessingFreeDraw] = useState(false);
  const [showApplyTooltip, setShowApplyTooltip] = useState(false);
  const [showDrawButtonGuide, setShowDrawButtonGuide] = useState(false);
  const freeDrawInFlightRef = useRef(false);
  const freeDrawAutoAttemptedRef = useRef(false);
  const tooltipMeasureRequestRef = useRef(0);

  const ownedIds = useMemo(
    () => new Set(skinSettings.ownedSkins.map(s => s.id)),
    [skinSettings.ownedSkins]
  );
  const ownedCatalogCount = useMemo(
    () => SKIN_CATALOG.reduce((count, entry) => count + (ownedIds.has(entry.id) ? 1 : 0), 0),
    [ownedIds]
  );

  const recentlyAcquiredSkinIds = useMemo(() => {
    const now = Date.now();
    const threshold = now - SKIN_NEW_DURATION_MS;
    return new Set(
      skinSettings.ownedSkins
        .filter((skin) => skin.acquiredAt >= threshold)
        .map((skin) => skin.id)
    );
  }, [skinSettings.ownedSkins]);

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
  const isCuteSkin = (id: string) => id.startsWith('skin_cute_');
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
    const premium = SKIN_CATALOG.filter(e => e.premium && e.category !== 'cat' && e.category !== 'dog');
    const cat = SKIN_CATALOG.filter(e => e.category === 'cat');
    const dog = SKIN_CATALOG.filter(e => e.category === 'dog');
    const neon = SKIN_CATALOG.filter(e => !e.premium && e.category !== 'cat' && e.category !== 'dog' && isNeonSkin(e.id));
    const liquidGlass = SKIN_CATALOG.filter(e => e.category !== 'cat' && e.category !== 'dog' && isLiquidGlassSkin(e.id));
    const mesh = SKIN_CATALOG.filter(e => e.category !== 'cat' && e.category !== 'dog' && isMeshSwatchSkin(e.id));
    const normal = SKIN_CATALOG.filter(
      (e) => !e.premium && e.category !== 'cat' && e.category !== 'dog' && !isNeonSkin(e.id) && !isMeshSwatchSkin(e.id) && !isLiquidGlassSkin(e.id)
    );

    const toRows = (arr: typeof SKIN_CATALOG[number][]) => {
      const r: typeof SKIN_CATALOG[number][][] = [];
      for (let i = 0; i < arr.length; i += COLS) r.push(arr.slice(i, i + COLS));
      return r;
    };

    const catRows = toRows(cat);
    const dogRows = toRows(dog);
    const neonRows = toRows(neon);
    const liquidGlassRows = toRows(liquidGlass);
    const meshRows = toRows(mesh);
    const normalRows = toRows(normal);
    const premiumRows = toRows(premium);

    return [
      { key: 'premium', titleKey: 'modals:skin.sectionPremium', skins: premium, rows: premiumRows, rowOffset: 0 },
      {
        key: 'cat',
        titleKey: 'modals:skin.sectionCat',
        skins: cat,
        rows: catRows,
        rowOffset: premiumRows.length,
      },
      {
        key: 'dog',
        titleKey: 'modals:skin.sectionDog',
        skins: dog,
        rows: dogRows,
        rowOffset: premiumRows.length + catRows.length,
      },
      {
        key: 'neon',
        titleKey: 'modals:skin.sectionNeon',
        skins: neon,
        rows: neonRows,
        rowOffset: premiumRows.length + catRows.length + dogRows.length,
      },
      {
        key: 'liquid',
        titleKey: 'modals:skin.sectionLiquidGlass',
        skins: liquidGlass,
        rows: liquidGlassRows,
        rowOffset: premiumRows.length + catRows.length + dogRows.length + neonRows.length,
      },
      {
        key: 'mesh',
        titleKey: 'modals:skin.sectionMesh',
        skins: mesh,
        rows: meshRows,
        rowOffset: premiumRows.length + catRows.length + dogRows.length + neonRows.length + liquidGlassRows.length,
      },
      {
        key: 'normal',
        titleKey: 'modals:skin.sectionNormal',
        skins: normal,
        rows: normalRows,
        rowOffset: premiumRows.length + catRows.length + dogRows.length + neonRows.length + liquidGlassRows.length + meshRows.length,
      },
    ];
  }, []);

  const swatchAppearanceBySkinId = useMemo(() => {
    const next = new Map<string, ReturnType<typeof resolveSkinAppearance>>();
    for (const entry of SKIN_CATALOG) {
      const swatchPreviewValue = isLiquidGlassSkin(entry.id) ? 64 : 16;
      next.set(
        entry.id,
        resolveSkinAppearance(
          swatchPreviewValue,
          entry,
          entry.id === PIXELBLAST_SKIN_ID ? { premiumUiThemeId: 'pixelblast_void' } : undefined,
        ),
      );
    }
    return next;
  }, []);

  const toggleSection = useCallback((sectionKey: SkinSectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }, []);

  // 선택된 스킨이 속한 [섹션키, 행인덱스] 계산
  const selectedLocation = useMemo(() => {
    if (!selectedSkinId) return null;
    for (let si = 0; si < skinSections.length; si++) {
      const sec = skinSections[si];
      const idx = sec.skins.findIndex(e => e.id === selectedSkinId);
      if (idx >= 0) return { sectionKey: sec.key, rowIdx: Math.floor(idx / COLS) };
    }
    return null;
  }, [selectedSkinId, skinSections]);

  const tooltipTimeoutRef = useRef<number | null>(null);
  const tooltipFrameRef = useRef<number | null>(null);

  const cancelPendingTooltipMeasurement = useCallback(() => {
    tooltipMeasureRequestRef.current += 1;
    if (tooltipTimeoutRef.current !== null) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    if (tooltipFrameRef.current !== null) {
      window.cancelAnimationFrame(tooltipFrameRef.current);
      tooltipFrameRef.current = null;
    }
  }, []);

  const ensureSkinTargetVisibleAndShowTooltip = useCallback((skinId: string) => {
    cancelPendingTooltipMeasurement();
    const requestId = tooltipMeasureRequestRef.current;
    const targetId = getSkinItemTargetId(skinId);
    let attempts = 0;
    const maxAttempts = 6;

    const run = () => {
      if (tooltipMeasureRequestRef.current !== requestId) return;
      const target = document.getElementById(targetId);
      if (!target) {
        attempts += 1;
        if (attempts <= maxAttempts) {
          tooltipTimeoutRef.current = window.setTimeout(() => {
            tooltipFrameRef.current = window.requestAnimationFrame(run);
          }, 80);
          return;
        }
        setShowApplyTooltip(false);
        return;
      }

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });

      void waitForStableRect(
        () => {
          const liveTarget = document.getElementById(targetId);
          if (!liveTarget) return null;
          return measureRectInOverlaySpace(liveTarget, null, 'auto');
        },
        {
          minStableFrames: 2,
          timeoutMs: 900,
        }
      ).then((stableRect) => {
        if (tooltipMeasureRequestRef.current !== requestId) return;
        setShowApplyTooltip(Boolean(stableRect));
      });
    };

    setShowApplyTooltip(false);
    tooltipFrameRef.current = window.requestAnimationFrame(run);
  }, [cancelPendingTooltipMeasurement]);

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

  const attemptFreeDraw = useCallback(async (): Promise<boolean> => {
    if (freeDrawInFlightRef.current) return false;
    freeDrawInFlightRef.current = true;
    setFreeDrawError(null);
    setIsProcessingFreeDraw(true);
    try {
      const result = drawSkin(skinSettings, activeBigTab);
      if (!result) {
        if (isMountedRef.current && open) {
          setFreeDrawError(String(t('modals:skin.freeDrawFailed')));
        }
        onFreeDrawUsed?.(false);
        return false;
      }

      const committed = await commitSkinDrawResultPersisted(result);
      if (!isMountedRef.current || !open) return false;
      if (!committed) {
        setFreeDrawError(String(t('modals:skin.freeDrawFailed')));
        onFreeDrawUsed?.(false);
        return false;
      }

      if (result.type === 'new') {
        setAcquisitionSkin(result.skin);
        setAcquisitionIsDuplicate(false);
        setFreeDrawResultSkinId(result.skin.id);
      } else {
        setAcquisitionSkin({ id: result.skin.id, hex: result.skin.hex, style: result.skin.style });
        setAcquisitionIsDuplicate(true);
        setFreeDrawResultSkinId(result.skin.id);
      }
      onFreeDrawUsed?.(true);
      return true;
    } finally {
      if (isMountedRef.current) {
        freeDrawInFlightRef.current = false;
        setIsProcessingFreeDraw(false);
      }
    }
  }, [skinSettings, t, onFreeDrawUsed, commitSkinDrawResultPersisted, activeBigTab, open]);

  // 무료 뽑기 자동 트리거
  useEffect(() => {
    if (!open || !freeDraw || freeDrawAutoAttemptedRef.current) return;
    freeDrawAutoAttemptedRef.current = true;

    const frameId = window.requestAnimationFrame(() => {
      void attemptFreeDraw();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, freeDraw, attemptFreeDraw]);

  // 모달 닫힐 때 무료 뽑기 상태 리셋
  useEffect(() => {
    if (!open) {
      autoDrawTriggeredRef.current = false;
      freeDrawAutoAttemptedRef.current = false;
      freeDrawInFlightRef.current = false;
      cancelPendingTooltipMeasurement();
      setShowApplyTooltip(false);
      setShowDrawButtonGuide(false);
      setFreeDrawResultSkinId(null);
      setFreeDrawError(null);
      setIsProcessingFreeDraw(false);
    }
  }, [open, cancelPendingTooltipMeasurement]);

  useEffect(() => {
    return () => {
      cancelPendingTooltipMeasurement();
    };
  }, [cancelPendingTooltipMeasurement]);

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
      if (!isMountedRef.current || !open) return;
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
        const result = drawSkin(skinSettings, activeBigTab);
        if (!result) return;

        drawResult = result;
        startAcquisitionAfterClose();
      },
      onAdClosed: () => {
        if (!isMountedRef.current || !open) return;
        adClosed = true;
        startAcquisitionAfterClose();
        setRemainingAds(skinRewardAdService.getRemainingDailyViews());
      },
      onError: (error) => {
        if (!isMountedRef.current || !open) return;
        const nextRemaining = skinRewardAdService.getRemainingDailyViews();
        const message = error.message?.trim() || '광고 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        setRemainingAds(nextRemaining);
        setAdError(message);
        skinRewardAdService.preloadAd();
      },
      onDailyLimitReached: () => {
        if (!isMountedRef.current || !open) return;
        setRemainingAds(skinRewardAdService.getRemainingDailyViews());
        setAdError(null);
      },
    });
  }, [skinSettings, addSkin, addFragments, activeBigTab, open]);

  const autoDrawTriggeredRef = useRef(false);
  useEffect(() => {
    if (!open || !autoDraw || autoDrawTriggeredRef.current) return;
    if (freeDraw) return;
    autoDrawTriggeredRef.current = true;

    const timer = setTimeout(() => {
      handleDraw();
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [open, autoDraw, handleDraw, freeDraw]);

  // 탭 전환 시 선택된 스킨 및 툴팁 상태 초기화 (탭 간 드롭다운 댕글링 방지)
  useEffect(() => {
    setSelectedSkinId(null);
    setSelectedSkinHex(null);
    setShowApplyTooltip(false);
    cancelPendingTooltipMeasurement();
  }, [activeBigTab, cancelPendingTooltipMeasurement]);

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

  // 획득 애니메이션 완료 핸들러
  const handleAcquisitionComplete = useCallback(() => {
    const drawnId = freeDrawResultSkinId;
    setAcquisitionSkin(null);
    setAcquisitionIsDuplicate(false);

    if (drawnId) {
      // 뽑은 스킨의 섹션 열기
      const entry = SKIN_CATALOG.find(e => e.id === drawnId);
      if (entry) {
        const key: SkinSectionKey = entry.premium ? 'premium'
          : isNeonSkin(entry.id) ? 'neon'
          : isLiquidGlassSkin(entry.id) ? 'liquid'
          : isMeshSwatchSkin(entry.id) ? 'mesh'
          : 'normal';
        setOpenSections(prev => ({ ...prev, [key]: true }));
      }
      setSelectedSkinId(drawnId);
      setSelectedSkinHex(entry?.hex ?? null);
      ensureSkinTargetVisibleAndShowTooltip(drawnId);
      setFreeDrawResultSkinId(null);
    }

    // 첫 무료 뽑기 직후, 광고 뽑기 버튼이 있으면 가이드 표시 (세션당 1회)
    if (isSkinRewardAdSupported() && !drawButtonGuideShownInSession) {
      drawButtonGuideShownInSession = true;
      setShowDrawButtonGuide(true);
    }
  }, [freeDrawResultSkinId, ensureSkinTargetVisibleAndShowTooltip]);

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

          <div className={`${premiumUiWindowClassName} ${premiumUiModalWindowClassName || ''} relative z-10 w-full max-w-lg shadow-none flex flex-col max-h-[calc(100dvh-2rem)] modal-safe-panel`} style={{ width: '100%' }}>
            <div className={premiumUiTitleBarClassName}>
              <div className={premiumUiTitleBarTextClassName}>
                {t('modals:skin.title')}
              </div>
              <div className={premiumUiTitleBarControlsClassName}>
                <button type="button" aria-label="Close" onClick={onClose} />
              </div>
            </div>

            {/* Premium UI Body Container with proper body padding */}
            <div className={`${premiumUiWindowBodyClassName || ''} flex flex-col flex-1 overflow-y-auto`} style={{ minHeight: 0 }}>
              {/* Win98 Classic or Pet theme Tabs Bar */}
              <ul 
                className={premiumUiSkinTabStripClassName || "window-tabs"} 
                role="tablist" 
                style={premiumUiSkinTabStripClassName ? { zIndex: 1 } : { display: 'flex', listStyle: 'none', padding: '0 4px', margin: '0 0 -2px 0', borderBottom: 'none', zIndex: 1 }}
              >
                <li role="tab" aria-selected={activeBigTab === 'premium'} style={{ marginRight: '2px' }}>
                  <button 
                    type="button"
                    onClick={() => setActiveBigTab('premium')}
                    data-active={activeBigTab === 'premium'}
                    className={premiumUiSkinTabButtonClassName || ""}
                    style={premiumUiSkinTabButtonClassName ? {} : {
                      padding: '3px 10px',
                      background: '#c0c0c0',
                      border: '1.5px solid',
                      borderColor: activeBigTab === 'premium' ? '#fff #0a0a0a #c0c0c0 #fff' : '#fff #0a0a0a #0a0a0a #fff',
                      borderBottom: activeBigTab === 'premium' ? 'none' : '1.5px solid #0a0a0a',
                      paddingBottom: activeBigTab === 'premium' ? '5px' : '3px',
                      marginTop: activeBigTab === 'premium' ? '0px' : '2px',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    💎 {t('modals:skin.sectionPremium')}
                  </button>
                </li>
                <li role="tab" aria-selected={activeBigTab === 'normal'}>
                  <button 
                    type="button"
                    onClick={() => setActiveBigTab('normal')}
                    data-active={activeBigTab === 'normal'}
                    className={premiumUiSkinTabButtonClassName || ""}
                    style={premiumUiSkinTabButtonClassName ? {} : {
                      padding: '3px 10px',
                      background: '#c0c0c0',
                      border: '1.5px solid',
                      borderColor: activeBigTab === 'normal' ? '#fff #0a0a0a #c0c0c0 #fff' : '#fff #0a0a0a #0a0a0a #fff',
                      borderBottom: activeBigTab === 'normal' ? 'none' : '1.5px solid #0a0a0a',
                      paddingBottom: activeBigTab === 'normal' ? '5px' : '3px',
                      marginTop: activeBigTab === 'normal' ? '0px' : '2px',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    ✦ {t('modals:skin.sectionNormal')}
                  </button>
                </li>
              </ul>

              <div className={premiumUiSunkenClassName} style={{ minHeight: '180px', padding: '8px', zIndex: 0 }}>
              <div className="space-y-4">
                {skinSections
                  .filter(sec => activeBigTab === 'premium' 
                    ? (sec.key === 'premium' || sec.key === 'cat' || sec.key === 'dog')
                    : (sec.key === 'neon' || sec.key === 'liquid' || sec.key === 'mesh' || sec.key === 'normal')
                  )
                  .map((section) => (
                    <div key={section.key}>
                      <div
                        className={premiumUiSkinTabStripClassName}
                        data-win98-skin-section-tabstrip="true"
                        style={{ padding: 0, borderBottom: 'none', marginBottom: '6px' }}
                      >
                        <button
                          type="button"
                          aria-expanded={openSections[section.key]}
                          onClick={() => toggleSection(section.key)}
                          className={premiumUiSkinTabButtonClassName}
                          data-active="true"
                          style={{ marginBottom: 0, padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span className="font-bold" aria-hidden="true">{openSections[section.key] ? '▾' : '▸'}</span>
                          {section.key === 'premium' || section.key === 'cat' || section.key === 'dog' ? <span className="font-bold">&#9670;</span> : <span className="font-bold">&#9632;</span>}
                          {t(section.titleKey as any)}
                          <span style={{ marginLeft: '2px', fontWeight: 'normal' }}>({section.skins.length})</span>
                        </button>
                      </div>
                      {openSections[section.key] && section.rows.map((rowSkins, rowIndex) => (
                        <React.Fragment key={rowIndex}>
                          <div className={SKIN_SWATCH_GRID_CLASS_NAME}>
                            {rowSkins.map((entry) => {
                              const isOwned = ownedIds.has(entry.id);
                              const isActive = skinSettings.activeSkinId === entry.id;
                              const isSelected = selectedSkinId === entry.id;
                              const isRecentlyAcquired = recentlyAcquiredSkinIds.has(entry.id);
                              const swatchAppearance = swatchAppearanceBySkinId.get(entry.id);
                              const className = swatchAppearance?.className ?? '';
                              const style = swatchAppearance?.style;
                              const isNeonSwatch = isNeonSkin(entry.id);
                              const isExploreGalaxySwatch = entry.id === EXPLORE_GALAXY_SKIN_ID;
                              const themeMaskVariant = getThemeMaskVariant(entry.id);

                              return (
                                <div
                                  key={entry.id}
                                  id={getSkinItemTargetId(entry.id)}
                                  data-tutorial-anchor="skin-swatch"
                                  onClick={() => handleSkinTap(entry.id, entry.hex)}
                                  className={`relative aspect-square flex items-center justify-center cursor-pointer ${premiumUiCompartmentButtonClassName} ${isSelected ? premiumUiListItemHighlightClassName : ''} ${isRecentlyAcquired ? 'skin-swatch-new' : ''} ${isNeonSwatch ? 'bg-slate-950/10 shadow-[inset_0_0_0_1px_rgba(2,6,23,0.12)]' : ''}`}
                                  style={{
                                    boxSizing: 'border-box',
                                    ['--tutorial-anchor-inset' as any]: `${SKIN_TUTORIAL_ANCHOR_INSET_PX}px`,
                                  }}
                                >
                                  {isRecentlyAcquired && (
                                    <div className="skin-new-badge">{t('modals:skin.newLabel')}</div>
                                  )}
                                  <div
                                    className="w-full h-full relative"
                                    data-skin-swatch="true"
                                  >
                                    <div
                                      className={`w-full h-full relative ${className} ${isExploreGalaxySwatch ? 'explore-galaxy-phase-sync' : ''}`}
                                      style={{ ...style, borderRadius: 0 }}
                                      data-premium-ui-allow-gradient="true"
                                      data-premium-ui-allow-shadow="true"
                                    >
                                      {themeMaskVariant && (
                                        <span
                                          className={`skin-theme-mask skin-theme-mask--swatch skin-theme-mask--${themeMaskVariant}`}
                                          aria-hidden="true"
                                        />
                                      )}
                                      {isExploreGalaxySwatch && (
                                        <ExploreGalaxyOverlay
                                          size={4}
                                          cellPx={10}
                                          active
                                          mode="swatch"
                                          zIndex={1}
                                        />
                                      )}
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
                                </div>
                              );
                            })}
                          </div>

                          {/* 드롭다운 미리보기 조건: sectionKey 매칭 */}
                          <AnimatePresence>
                            {selectedLocation?.sectionKey === section.key && selectedLocation?.rowIdx === rowIndex && selectedSkinId && (
                              <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('modals:skin.preview')}</span>
                                  <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                                    {getSkinDisplayName(previewSkin as any)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px', overflowX: 'auto' }}>
                                  {SKIN_PREVIEW_VALUES.map((v) => (
                                    <SkinPreviewTile key={v} value={v} skin={previewSkin} tilePx={52} />
                                  ))}
                                </div>
                                <div style={{ fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>
                                  {ownedIds.has(selectedSkinId) ? (
                                    <span style={{ color: '#808080' }}>{t('modals:skin.tapToApply')}</span>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ color: '#808080' }}>{t('modals:skin.notOwned')}</div>
                                      {(() => {
                                        const cost = getFragmentCost(selectedSkinId);
                                        const canAfford = skinSettings.fragments >= cost;
                                        return (
                                          <button
                                            type="button"
                                            disabled={!canAfford}
                                            onClick={(e) => { e.stopPropagation(); handlePurchase(selectedSkinId); }}
                                            className={premiumUiCompartmentButtonClassName}
                                            style={{ width: '100%', height: '24px', fontWeight: 'bold', cursor: canAfford ? 'pointer' : 'not-allowed' }}
                                          >
                                            {canAfford
                                              ? String(t('modals:skin.purchaseButton', { cost } as any))
                                              : String(t('modals:skin.insufficientFragments', { current: skinSettings.fragments, cost } as any))}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      ))}
                    </div>
                  ))}
              </div>

              {/* 탭 내부에 단일 뽑기 버튼 패널 결합 */}
              {isSkinRewardAdSupported() && (
                <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1.5px solid #808080' }}>
                  {showDrawButtonGuide && (
                    <div style={{ background: '#ffffe1', border: '1px solid #000', padding: '6px', marginBottom: '8px', fontSize: '11px', position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setShowDrawButtonGuide(false)}
                        style={{ position: 'absolute', top: '2px', right: '4px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ×
                      </button>
                      <p>{t('modals:skin.drawGuideHint' as any, '광고를 보고 더 많은 스킨을 뽑을 수 있어요!')}</p>
                    </div>
                  )}
                  {freeDrawError && (
                    <div style={{ background: '#ffebeb', border: '1px solid #ff0000', padding: '6px', textAlign: 'center', marginBottom: '8px', fontSize: '11px' }}>
                      <div>{freeDrawError}</div>
                      <button
                        type="button"
                        onClick={() => { void attemptFreeDraw(); }}
                        disabled={isProcessingFreeDraw}
                        style={{ marginTop: '4px', width: '100%', fontWeight: 'bold' }}
                      >
                        {t('common:buttons.retry')}
                      </button>
                    </div>
                  )}
                  {collectionComplete && (
                    <div style={{ background: '#fff0d0', border: '1px solid #ffcc00', padding: '6px', textAlign: 'center', marginBottom: '8px', fontSize: '11px', fontWeight: 'bold' }}>
                      {t('modals:skin.collectionComplete')}
                    </div>
                  )}
                  {remainingAds > 0 ? (
                    <button 
                      type="button"
                      className={premiumUiCompartmentButtonClassName} 
                      onClick={handleDraw} 
                      style={{ width: '100%', height: '32px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      {activeBigTab === 'premium' ? '💎 ' : '✦ '}
                      {t('modals:skin.drawButton')} ({remainingAds}/{MAX_DAILY_SKIN_AD_VIEWS})
                    </button>
                  ) : (
                    <button type="button" className={premiumUiCompartmentButtonClassName} disabled style={{ width: '100%' }}>
                      {t('modals:skin.dailyLimit')}
                    </button>
                  )}
                  {adError && <p style={{ color: 'red', marginTop: '4px', fontSize: '11px' }}>{adError}</p>}
                </div>
              )}
            </div>

            </div> {/* End of premiumUiWindowBodyClassName */}

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
              onComplete={handleAcquisitionComplete}
            />
          )}
        </AnimatePresence>

        {showApplyTooltip && (
          <TutorialTooltip
            isVisible={showApplyTooltip}
            targetId={selectedSkinId ? getSkinItemTargetId(selectedSkinId) : null}
            onDismiss={() => setShowApplyTooltip(false)}
            title={t('modals:skin.applyHintTitle')}
            description={t('modals:skin.applyHintDesc')}
          />
        )}
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

        <div className="relative z-10 w-full max-w-lg max-h-[90dvh] modal-safe-panel rounded-3xl bg-white/90 backdrop-blur-sm border border-white/60 shadow-2xl overflow-hidden flex flex-col">
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
          <div className="p-5 overflow-y-auto min-h-0 flex-1 space-y-5 modal-scroll-panel animate-fade-in">
            {/* Modern Tab Bar */}
            <div className="flex p-1 bg-gray-100/80 backdrop-blur-sm rounded-2xl border border-black/5 shadow-inner" style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setActiveBigTab('premium')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  activeBigTab === 'premium'
                    ? 'bg-white text-gray-900 shadow-sm border border-white/60'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>💎</span>
                <span>{t('modals:skin.sectionPremium')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveBigTab('normal')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  activeBigTab === 'normal'
                    ? 'bg-white text-gray-900 shadow-sm border border-white/60'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>✦</span>
                <span>{t('modals:skin.sectionNormal')}</span>
              </button>
            </div>

            {/* 섹션별 컬렉션 그리드 */}
            <div className="space-y-5">
              {skinSections
                .filter(sec => activeBigTab === 'premium' 
                  ? (sec.key === 'premium' || sec.key === 'cat' || sec.key === 'dog')
                  : (sec.key === 'neon' || sec.key === 'liquid' || sec.key === 'mesh' || sec.key === 'normal')
                )
                .map((section) => (
                  <div key={section.key}>
                    {/* 섹션 헤더 */}
                    <button
                      type="button"
                      aria-expanded={openSections[section.key]}
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center gap-2 mb-2.5 text-left"
                    >
                      <span className="text-xs text-gray-400" aria-hidden="true">{openSections[section.key] ? '▾' : '▸'}</span>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        {t(section.titleKey as any)}{section.key === 'premium' || section.key === 'cat' || section.key === 'dog' ? ' 💎' : ' ✦'}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{section.skins.length}</span>
                    </button>
                    {openSections[section.key] && (
                      <div className="space-y-2.5">
                      {section.rows.map((rowSkins, rowIndex) => (
                        <React.Fragment key={rowIndex}>
                          {/* 스킨 행 */}
                          <div className={SKIN_SWATCH_GRID_CLASS_NAME}>
                            {rowSkins.map((entry) => {
                              const isOwned = ownedIds.has(entry.id);
                              const isActive = skinSettings.activeSkinId === entry.id;
                              const isSelected = selectedSkinId === entry.id;
                              const isRecentlyAcquired = recentlyAcquiredSkinIds.has(entry.id);
                              const swatchAppearance = swatchAppearanceBySkinId.get(entry.id);
                              const className = swatchAppearance?.className ?? '';
                              const style = swatchAppearance?.style;
                              const isNeonSwatch = isNeonSkin(entry.id);
                              const isExploreGalaxySwatch = entry.id === EXPLORE_GALAXY_SKIN_ID;
                              const themeMaskVariant = getThemeMaskVariant(entry.id);

                              return (
                                <button
                                  key={entry.id}
                                  id={getSkinItemTargetId(entry.id)}
                                  data-tutorial-anchor="skin-swatch"
                                  type="button"
                                  onClick={() => handleSkinTap(entry.id, entry.hex)}
                                  className={`
                                    relative aspect-square rounded-2xl transition-all duration-150
                                    ${isSelected ? 'ring-2 ring-gray-900 ring-offset-2' : 'ring-1 ring-black/5'}
                                    ${isRecentlyAcquired ? 'skin-swatch-new overflow-visible' : 'overflow-hidden'}
                                    ${isNeonSwatch ? 'bg-slate-950/10 shadow-[inset_0_0_0_1px_rgba(2,6,23,0.12)]' : ''}
                                  `}
                                  style={{
                                    ['--tutorial-anchor-inset' as any]: `${SKIN_TUTORIAL_ANCHOR_INSET_PX}px`,
                                  }}
                                >
                                  {isRecentlyAcquired && (
                                    <span className="skin-new-badge block">{t('modals:skin.newLabel')}</span>
                                  )}
                                    <span
                                      className={`relative block w-full h-full ${isNeonSwatch ? '' : 'overflow-hidden'}`}
                                      data-skin-swatch="true"
                                    >
                                      <span
                                        className={`relative block w-full h-full ${isNeonSwatch ? '' : 'overflow-hidden'} ${isExploreGalaxySwatch ? 'explore-galaxy-phase-sync' : ''} ${className}`}
                                        style={style}
                                      >
                                        {themeMaskVariant && (
                                          <span
                                            className={`skin-theme-mask skin-theme-mask--swatch skin-theme-mask--${themeMaskVariant}`}
                                            aria-hidden="true"
                                          />
                                        )}
                                        {isExploreGalaxySwatch && (
                                          <ExploreGalaxyOverlay
                                            size={4}
                                            cellPx={10}
                                            active
                                            mode="swatch"
                                            zIndex={1}
                                          />
                                        )}
                                      </span>
                                    </span>
                                    {!isOwned && (
                                      <span className="absolute inset-0 bg-black/40 z-[5] block" />
                                    )}
                                    {entry.premium && (
                                      <span className="absolute top-0.5 right-0.5 z-20 text-[8px] leading-none drop-shadow block">💎</span>
                                    )}
                                    {isActive && (
                                      <span className="absolute inset-0 flex items-center justify-center z-10">
                                        <span className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                                          <Check size={14} className="text-gray-900" />
                                        </span>
                                      </span>
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

                          {/* 드롭다운 미리보기: sectionKey 매칭 */}
                          <AnimatePresence>
                            {selectedLocation?.sectionKey === section.key && selectedLocation?.rowIdx === rowIndex && selectedSkinId && (
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

            {/* 스킨 탭 내부의 단일 뽑기 버튼 (Modern 탭 전용 통합) */}
            {isSkinRewardAdSupported() && (
              <div className="space-y-2 mt-4 pt-4 border-t border-black/5">
                {showDrawButtonGuide && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-2.5 px-3 rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200/60 text-gray-700 text-xs font-medium leading-relaxed relative"
                  >
                    <button
                      type="button"
                      onClick={() => setShowDrawButtonGuide(false)}
                      className="absolute top-1 right-2 text-gray-400 hover:text-gray-600 text-sm leading-none"
                      aria-label="Close"
                    >
                      ×
                    </button>
                    <p>{t('modals:skin.drawGuideHint' as any, '광고를 보고 더 많은 스킨을 뽑을 수 있어요!')}</p>
                  </motion.div>
                )}
                {freeDrawError && (
                  <div className="text-center py-2 rounded-2xl bg-red-50 border border-red-200/60 text-red-600 font-semibold text-sm space-y-2">
                    <div>{freeDrawError}</div>
                    <button
                      type="button"
                      onClick={() => { void attemptFreeDraw(); }}
                      disabled={isProcessingFreeDraw}
                      className={`w-full py-2 rounded-xl text-sm font-semibold transition-all ${isProcessingFreeDraw
                        ? 'bg-red-100 text-red-300 cursor-not-allowed'
                        : 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]'
                        }`}
                    >
                      {t('common:buttons.retry')}
                    </button>
                  </div>
                )}
                {collectionComplete && (
                  <div className="text-center py-2 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200/60 text-amber-700 font-semibold text-sm">
                    {t('modals:skin.collectionComplete')}
                  </div>
                )}
                {remainingAds > 0 ? (
                  <button
                    type="button"
                    onClick={handleDraw}
                    className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>{activeBigTab === 'premium' ? '💎' : '✦'}</span>
                    <span>{t('modals:skin.drawButton')}</span>
                    <span className="text-white/60">
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
            onComplete={handleAcquisitionComplete}
          />
        )}
      </AnimatePresence>

      {showApplyTooltip && (
        <TutorialTooltip
          isVisible={showApplyTooltip}
          targetId={selectedSkinId ? getSkinItemTargetId(selectedSkinId) : null}
          onDismiss={() => setShowApplyTooltip(false)}
          title={t('modals:skin.applyHintTitle')}
          description={t('modals:skin.applyHintDesc')}
        />
      )}
    </>
  );
}
