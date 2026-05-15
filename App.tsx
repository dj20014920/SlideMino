import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingScreen } from './components/LoadingScreen';
import { useTranslation } from 'react-i18next';
import { SplashScreen } from '@capacitor/splash-screen';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import {
  GameState,
  Grid,
  Piece,
  Phase,
  BoardSize,
  ShapeType,
  MergingTile,
  PortalReleaseAnimation,
  GameMode,
  ObstacleFeature,
  ObstacleState,
  Direction,
  type GameOverDiagnosis,
} from './types';
import {
  createEmptyGrid,
  generateRandomPiece,
  generateRefreshedSlotPieces,
  getRotatedCells,
  placePieceOnGrid,
  diagnoseGameOver,
  type MergedTile,
} from './services/gameLogic';
import {
  buildPlacementGridWithObstacles,
  canPlacePieceWithObstacles,
  cloneObstacleState,
  createEmptyObstacleState,
  getMaxTileValue,
  getObstacleSpawnChanceBreakdown,
  getObstacleStage,
  getTurnActionAvailabilityWithObstacles,
  getUnlockedObstacleFeatures,
  hasPossibleMovesWithObstacles,
  OBSTACLE_RULES_VERSION,
  rollObstacleSpawn,
  slideGridWithObstacles,
} from './services/obstacleEngine';
import { Board, type BoardHandle, type ReviveDestroyEffect } from './components/Board';
import { Slot } from './components/Slot';
import { BlockCustomizationModal } from './components/BlockCustomizationModal';
import { SkinModal } from './components/SkinModal';
import { Undo2, Home, RotateCw, Move, Palette, Lock, Trophy, HelpCircle, RotateCcw, X } from 'lucide-react';

import { GameOverModal } from './components/GameOverModal';
import { GameModeTutorial } from './components/GameModeTutorial';
import { SequentialOnboardingOverlay } from './components/SequentialOnboardingOverlay';
import { LeaderboardModal } from './components/LeaderboardModal';
import { NameInputModal } from './components/NameInputModal';
import { ActiveGameExitModal, type ActiveGameExitContext } from './components/ActiveGameExitModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { GameFeaturesTutorial } from './components/GameFeaturesTutorial';
import { SkinFeatureTutorial } from './components/SkinFeatureTutorial';
import AdBanner from './components/AdBanner';
import AppDownloadBanner from './components/AppDownloadBanner';
import { CookieConsent } from './components/CookieConsent';
import ComboIndicator from './components/ComboIndicator';
import { HelpModal } from './components/HelpModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { BottomNavBar, getEstimatedBottomNavHeight } from './components/BottomNavBar';
import { NativeUpdateModal } from './components/NativeUpdateModal';
import {
  BOARD_CELL_GAP_PX,
  BOARD_GRID_VIEWPORT_SELECTOR,
  SLIDE_UNLOCK_BUFFER_MS,
  getSlideAnimationDurationMs,
  FRAGMENTS_PER_DUPLICATE,
  INITIAL_BLOCK_REFRESH_AMOUNT,
  INITIAL_UNDO_AMOUNT,
  REWARD_BLOCK_REFRESH_AMOUNT,
  REWARD_UNDO_AMOUNT,
  SKIN_CATALOG,
  FRAGMENT_COST_NORMAL,
  FRAGMENT_COST_PREMIUM,
} from './constants';
import { useBlockCustomization } from './context/BlockCustomizationContext';
import {
  drawSkin,
  loadSkinSettings,
  isFirstScoreSkinRewardClaimed,
  isFirstScoreSkinRewardPending,
  isFirstScoreSkinRewardShown,
  markFirstScoreSkinRewardShown,
  claimFirstScoreSkinReward,
  setFirstScoreSkinRewardPending,
} from './services/skinService';
import {
  saveGameState,
  loadGameState,
  clearGameState,
  saveDailyChallengeState,
  loadDailyChallengeState,
  clearDailyChallengeState,
  hasActiveDailyChallenge,
  getActiveNormalGameBoardSize,
  type SavedGameState,
} from './services/gameStorage';
import { rankingService, type LiveRankEstimate } from './services/rankingService';
import { getCurrentRoute, navigateTo, onRouteChange, updatePageMeta, type Route } from './utils/routing';
import { isNativeApp, isAppIntoS, isAndroidApp, isLikelyIOSInAppBrowser } from './utils/platform';
import { normalizeLanguage, LANGUAGE_CONFIGS, type SupportedLanguage } from './i18n/constants';
import { saveLanguageOverride } from './utils/deviceLanguage';
import { openNativePrivacyOptionsForm } from './services/admob';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import About from './pages/About';
import Contact from './pages/Contact';
import AdminAnalytics from './pages/AdminAnalytics';
import { rewardAdService } from './services/rewardAdService';
import { rewardInterstitialAdService } from './services/rewardInterstitialAdService';
import { blockRefreshRewardInterstitialAdService } from './services/blockRefreshRewardInterstitialAdService';
import {
  trackAnalyticsEvent,
  trackAppLaunchOnce,
  getAnalyticsInstallId,
  getAnalyticsSessionId,
  trackLegacyInstallDetectedOnce,
  trackSessionEndOnce,
  startHeartbeat,
  stopHeartbeat,
} from './services/analyticsService';
import { claimPendingSkinGifts } from './services/skinGiftService';
import {
  isBlockRefreshRewardInterstitialAdSupported,
  isRewardAdSupported,
  isRewardInterstitialAdSupported,
} from './services/adConfig';
import { normalizePlayerName, validatePlayerName } from './utils/playerName';
import {
  checkNativeUpdateRequirement,
  openNativeMarketForUpdate,
  type NativeUpdateRequirement,
} from './services/nativeUpdate';
import { SeasonRewardModal } from './components/SeasonRewardModal';
import { clamp } from './utils/math';
import { getSafeAreaInsetPx } from './utils/safeArea';
import { MissionModal } from './components/MissionModal';
import {
  initMissionTracking,
  getDailyCompletedCount,
  type MissionCompleteInfo,
  type MissionProgressInfo,
} from './services/missionService';
import { gameEventBus } from './services/gameEventBus';
import { StreakInfoModal } from './components/StreakInfoModal';
import {
  checkAndUpdateStreak,
  recordAttendance,
  isTodayAttended,
  loadStreakData,
  getPointsToAttendance,
} from './services/streakService';
import {
  checkSeasonRewards,
  claimAllSeasonRewards,
  type SeasonReward,
} from './services/seasonService';
import {
  fetchDailyChallengeSeed,
  generateChallengeSlots,
} from './services/dailyChallengeService';
import { WeeklyEventModal } from './components/WeeklyEventModal';
import DailyLaunchModal, { isFirstLaunchToday, hasEverPlayed, markEverPlayed } from './components/DailyLaunchModal';

// ── 시즌 보상 "이미 확인함" 로컬 플래그 (앱 재시작 시 중복 표시 방지) ──
const SEEN_SEASON_REWARDS_KEY = 'slidemino_seen_season_rewards';

function markSeasonRewardsSeen(rewards: { season_id: string; difficulty: string }[]): void {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_SEASON_REWARDS_KEY) || '[]') as string[]);
    rewards.forEach(r => seen.add(`${r.season_id}:${r.difficulty}`));
    localStorage.setItem(SEEN_SEASON_REWARDS_KEY, JSON.stringify([...seen]));
  } catch { /* ignore */ }
}

function hasUnseenSeasonRewards(rewards: { season_id: string; difficulty: string }[]): boolean {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_SEASON_REWARDS_KEY) || '[]') as string[]);
    return rewards.some(r => !seen.has(`${r.season_id}:${r.difficulty}`));
  } catch {
    return true; // 안전하게 표시
  }
}
import {
  getCurrentEvent,
  generateEventPiece,
  getEventTimerRemainingMs,
  formatTimerMmSs,
  getLocalAttemptCount,
  canStartWeeklyEventAttempt,
  isEventAttemptAdBonusUnlocked,
  clearEventGameState,
  saveEventGameState,
  loadEventGameState,
  hasActiveEventGame,
  initEventScoreSync,
  submitEventScore,
  hasParticipatedInCurrentEvent,
  hasParticipatedInPreviousEvent,
  hasClaimedEventReward,
  isCurrentEventBannerDismissed,
  dismissCurrentEventBanner,
  isRewardBannerDismissed,
  dismissRewardBanner,
  type WeeklyEventRule,
  EVENT_RULES,
} from './services/weeklyEventService';
import {
  initXpTracking,
  getXpProgress,
  grantXpStreak,
  loadXpData,
  getHighestLevelBadgeForLevel,
} from './services/xpLevelService';
import { getCalendarItems } from './services/calendarService';
import { markScoreOnboardingStepSeen } from './services/onboardingService';
import {
  startSequentialOnboarding,
  getCurrentSequentialStep,
  advanceSequentialStep,
  isSequentialOnboardingCompleted,
  resetSequentialOnboarding,
  SEQUENTIAL_STEPS,
  type SequentialStep,
} from './services/sequentialOnboardingService';
import { XpLevelModal } from './components/XpLevelModal';
import { CalendarModal } from './components/CalendarModal';
import { rescheduleNotifications } from './services/notificationService';
import {
  clearOnboardingProgress,
  decideMenuOnboardingStep,
  isEarlyOnboardingCompleted,
  isGameplayTutorialBlocked as getIsGameplayTutorialBlocked,
  isMenuTutorialSuppressed,
  ONBOARDING_STORAGE_KEYS,
  SKIN_TARGET_POLICY,
  type MenuOnboardingStep,
} from './services/onboardingOrchestrator';

const EMPTY_TILE_VALUE_OVERRIDES: Record<string, number> = {};
const EMPTY_MERGING_TILES: MergingTile[] = [];
const EMPTY_PORTAL_RELEASE_ANIMATIONS: PortalReleaseAnimation[] = [];
const EMPTY_TILE_ID_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_TILE_BURST_MAP: Readonly<Record<string, number>> = Object.freeze({});
const DRAG_OVERLAY_SCALE = 0.65;
// 손가락 위로 올릴 높이 = 보드 셀 pitch 기준 배수
// → 기기 크기(폰/태블릿)에 관계없이 항상 적절한 비율 유지
const DRAG_LIFT_CELLS = 1.5;
const LIVE_RANK_POLL_INTERVAL_MS = 5000;
const LIVE_RANK_SCORE_SYNC_DEBOUNCE_MS = 350;
const LIVE_RANK_MIN_REQUEST_INTERVAL_MS = 1000;
const AUTO_RANK_SUBMIT_MIN_INTERVAL_MS = 12_000;
const AUTO_RANK_SUBMIT_FORCE_INTERVAL_MS = 45_000;
const AUTO_RANK_SUBMIT_SCORE_DELTA_THRESHOLD = 150;
const AUTO_RANK_SUBMIT_DEBOUNCE_MS = 900;
const HOME_NAV_FLUSH_TIMEOUT_MS = 320;
const SKIN_GIFT_CLAIM_RETRY_DELAYS_MS = [0, 2000, 10000, 30000] as const;
const SKIN_GIFT_CLAIM_POLL_INTERVAL_MS = 3 * 60 * 1000;
const SWIPE_TRIGGER_DISTANCE_PX = 24;
const DAILY_CHALLENGE_ENABLED = false;

type ComboMessageItem = {
  id: number;
  message: string;
  durationMs: number;
};

// Undo 시스템: 직전 상태를 저장하기 위한 스냅샷 인터페이스
interface GameSnapshot {
  grid: Grid;
  slots: (Piece | null)[];
  score: number;
  phase: Phase;
  canSkipSlide: boolean;
  obstacleState: ObstacleState;
  unlockedObstacleFeatures: ObstacleFeature[];
}

const REVIVE_DESTROY_COUNT_BY_BOARD_SIZE: Record<BoardSize, number> = {
  4: 6,
  5: 4,
  7: 6,
  8: 5,
  10: 8,
};

interface ActiveGameRankingSnapshot {
  sessionId: string;
  score: number;
  difficulty: string;
  boardSize: BoardSize;
  duration: number;
  moves: number;
  playerName: string;
  sessionLockedPlayerName: string | null;
}

type OverlayModalKey =
  | 'customization'
  | 'skin'
  | 'leaderboard'
  | 'streak'
  | 'season_reward'
  | 'mission'
  | 'xp'
  | 'calendar'
  | 'weekly_event'
  | 'name_input'
  | 'active_game_exit'
  | 'help';

type PendingSessionMode = 'normal' | 'weekly_event';

const cloneGameSnapshot = (snapshot: GameSnapshot): GameSnapshot => ({
  grid: snapshot.grid.map((row) => row.map((tile) => (tile ? { ...tile } : null))),
  slots: snapshot.slots.map((piece) => (piece ? { ...piece, cells: [...piece.cells] } : null)),
  score: snapshot.score,
  phase: snapshot.phase,
  canSkipSlide: snapshot.canSkipSlide,
  obstacleState: cloneObstacleState(snapshot.obstacleState),
  unlockedObstacleFeatures: [...snapshot.unlockedObstacleFeatures],
});

const OBSTACLE_UNLOCK_COPY: Record<ObstacleFeature, {
  title: string;
  summary: string;
  role: string;
  clear: string;
  chanceNote: string;
}> = {
  concrete: {
    title: '콘크리트 블럭이 열렸어요',
    summary: '부딪히면 길을 막고, 세 번 맞으면 사라져요.',
    role: '빈칸에 고정 벽처럼 생겨서 숫자 이동을 막아요.',
    clear: '충돌이 생긴 스와이프마다 내구도가 1 줄고, 0이 되면 깨져요.',
    chanceNote: '스와이프 뒤 빈칸에 생겨요.',
  },
  percent: {
    title: '% 블럭이 열렸어요',
    summary: '처음 닿은 숫자를 절반으로 줄이고 사라져요.',
    role: '부딪힌 숫자만 낮추고, 이미 얻은 점수는 줄이지 않아요.',
    clear: '한 번 발동하면 바로 사라져요.',
    chanceNote: '스와이프 뒤 빈칸에 생겨요.',
  },
  ice: {
    title: '얼음 블럭이 열렸어요',
    summary: '방금 합쳐진 숫자가 3번의 스와이프 동안 멈춰요.',
    role: '병합된 숫자 위에 바로 얼음이 생겨서 벽처럼 막아요.',
    clear: '성공한 스와이프를 3번 하면 다시 움직여요.',
    chanceNote: '병합이 있는 스와이프에서 생겨요.',
  },
  portal: {
    title: '외곽 포탈이 열렸어요',
    summary: 'IN으로 빠진 숫자가 OUT에서 차례대로 나와요.',
    role: '보드 밖 가장자리에 IN과 OUT이 한 쌍으로 생겨요.',
    clear: '포탈은 새 쌍이 더 생기지 않고, 큐에 든 숫자는 안전하게 남아요.',
    chanceNote: '스와이프 뒤 외곽에 생겨요.',
  },
  container: {
    title: '컨테이너 블럭이 열렸어요',
    summary: '닿은 숫자를 화살표 방향으로 다시 보내요.',
    role: '충돌한 숫자들을 순서대로 정해진 방향에 착지시켜요.',
    clear: '모든 숫자를 안전하게 보낼 수 있을 때만 발동하고 사라져요.',
    chanceNote: '스와이프 뒤 빈칸에 생겨요.',
  },
};

const formatObstacleChance = (chance: number): string => {
  if (chance <= 0) return '0%';
  if (chance < 1) return '1% 미만';
  if (chance < 10) return `${Math.round(chance * 10) / 10}%`;
  return `${Math.round(chance)}%`;
};

const ObstacleExampleBlock = ({ feature }: { feature: ObstacleFeature }) => {
  if (feature === 'portal') {
    return (
      <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border border-violet-200 bg-violet-50 text-[11px] font-black text-violet-700 shadow-inner">
        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-white">IN</span>
        <span className="rounded-full border border-violet-300 bg-white px-2 py-0.5">OUT</span>
      </div>
    );
  }

  const classNameByFeature: Record<Exclude<ObstacleFeature, 'portal'>, string> = {
    concrete: 'border-slate-500 bg-slate-700 text-white',
    percent: 'border-rose-300 bg-rose-100 text-rose-700',
    ice: 'border-cyan-300 bg-cyan-100 text-cyan-800',
    container: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  };
  const labelByFeature: Record<Exclude<ObstacleFeature, 'portal'>, string> = {
    concrete: '3',
    percent: '%',
    ice: '8',
    container: '→',
  };

  return (
    <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-black shadow-inner ${classNameByFeature[feature]}`}>
      <span className="relative z-10">{labelByFeature[feature]}</span>
      {feature === 'ice' && (
        <span className="absolute inset-1 rounded-xl border border-white/70 bg-white/35" />
      )}
    </div>
  );
};

const countOccupiedTiles = (targetGrid: Grid): number =>
  targetGrid.reduce((sum, row) => {
    const filled = row.reduce((rowCount, tile) => rowCount + (tile ? 1 : 0), 0);
    return sum + filled;
  }, 0);

const getReusablePlayerName = (candidate: string | null | undefined): string | null => {
  const normalized = normalizePlayerName(candidate ?? '');
  const errorKey = validatePlayerName(normalized);
  return errorKey ? null : normalized;
};

const loadInitialPlayerName = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return getReusablePlayerName(rankingService.getSavedName()) ?? '';
  } catch {
    return '';
  }
};

const isDocumentVisible = (): boolean => {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
};

const toDurationSeconds = (durationMs: number): number => Math.max(1, Math.floor(Math.max(0, durationMs) / 1000));

const getSavedGameActiveDurationMs = (saved: SavedGameState): number => {
  if (typeof saved.activeDurationMs === 'number' && Number.isFinite(saved.activeDurationMs)) {
    return Math.max(0, Math.floor(saved.activeDurationMs));
  }
  const startedAt = typeof saved.startedAt === 'number' ? saved.startedAt : saved.savedAt;
  return Math.max(0, saved.savedAt - startedAt);
};


/**
 * Pointer hit-test snapshot for the active drag.
 *
 * Important: these metrics are read from Board's grid viewport, not the visible
 * board shell. The shell is allowed to change for skins; this structure must stay
 * aligned with the same coordinate contract used by `components/Board.tsx`.
 */
interface BoardMetrics {
  rectLeft: number;
  rectTop: number;
  innerWidth: number;
  innerHeight: number;
  offsetX: number;
  offsetY: number;
  cell: number;
  pitch: number;
  size: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface GameLayoutProfile {
  columnMaxWidthPx: number;
  columnWidthPx: number;
  boardScaleMultiplier: number;
  boardScaleCeiling: number;
  mainGapPx: number;
  mainTopPaddingPx: number;
  mainBottomPaddingPx: number;
}

interface LayoutChromeHeights {
  header: number;
  footer: number;
}

interface OrientationLockMessage {
  title: string;
  body: string;
}

// 배너 광고 높이를 boardScale 계산에 고정값으로 사용 (flex flow가 실제 레이아웃을 처리)
// 광고 SDK의 비동기 로딩으로 인한 배너 높이 변동이 boardScale을 흔드는 것을 방지
const STABLE_BANNER_RESERVE_PX = 60;

const DEFAULT_LAYOUT_CHROME_HEIGHTS: LayoutChromeHeights = {
  header: 104,
  footer: STABLE_BANNER_RESERVE_PX,
};

const ORIENTATION_LOCK_MESSAGES: Record<string, OrientationLockMessage> = {
  ko: {
    title: '세로 모드로 전환해 주세요',
    body: '블록 슬라이드 (Block Slide)는 가로 모드를 지원하지 않습니다.',
  },
  en: {
    title: 'Please rotate to portrait mode',
    body: '블록 슬라이드 (Block Slide) does not support landscape mode.',
  },
  ja: {
    title: '縦向きにしてください',
    body: '블록 슬라이드 (Block Slide) は横向きモードに対応していません。',
  },
  zh: {
    title: '请切换为竖屏',
    body: '블록 슬라이드 (Block Slide) 不支持横屏模式。',
  },
};

const LEGACY_PORTRAIT_ASPECT = 16 / 9;
const MODERN_PHONE_PORTRAIT_ASPECT = 19.5 / 9;
const APP_RESUME_EVENT = 'slidemino:app-resume';
const VIEWPORT_RECOVERY_DELAYS_MS = [120, 320, 600] as const;
const IOS_IN_APP_BROWSER_TOP_CHROME_FALLBACK_PX = 44;
const IOS_IN_APP_BROWSER_TOP_CHROME_MAX_PX = 88;
const DEFAULT_BOARD_SCALE_CEILING_MIN = 0.42;
const WIN98_BOARD_SCALE_CEILING_MIN = 0.5;
const VIEWPORT_HEIGHT_DROP_GUARD_PX = 120;
const VIEWPORT_HEIGHT_DROP_GUARD_RATIO = 0.18;
const VIEWPORT_HEIGHT_DROP_GUARD_MAX_WIDTH_SHIFT_PX = 24;
const VIEWPORT_HEIGHT_DROP_GUARD_REAPPLY_DELAY_MS = 80;
const CHROME_SPIKE_GUARD_STEP_PX = 36;
const LIGHT_SYSTEM_BAR_CONTENT_FAMILIES = new Set(['explore_galaxy', 'pixelblast_void']);

const getStableGameFooterReservePx = (nativeSafeBottomPx: number): number => (
  STABLE_BANNER_RESERVE_PX + Math.max(0, Math.round(nativeSafeBottomPx))
);

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const isEditableElementFocused = (): boolean => {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  const tagName = active.tagName;
  if (tagName === 'TEXTAREA') return true;
  if (tagName !== 'INPUT') return false;
  const inputType = (active as HTMLInputElement).type.toLowerCase();
  return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(inputType);
};

const getViewportSize = (): ViewportSize => {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }
  const layoutWidth = window.innerWidth;
  const layoutHeight = window.innerHeight;
  const visualWidth = window.visualViewport?.width ?? layoutWidth;
  const visualHeight = window.visualViewport?.height ?? layoutHeight;
  const hasFocusedEditable = isEditableElementFocused();
  const shouldStabilizeForLockedGame =
    typeof document !== 'undefined' &&
    document.body.classList.contains('scroll-locked') &&
    !hasFocusedEditable;
  const shouldStabilizeForNative = isNativeApp() && !hasFocusedEditable;
  const shouldStabilizeViewport = shouldStabilizeForNative || shouldStabilizeForLockedGame;

  return {
    width: shouldStabilizeViewport ? Math.max(layoutWidth, visualWidth) : visualWidth,
    height: shouldStabilizeViewport ? Math.max(layoutHeight, visualHeight) : visualHeight,
  };
};

const getGameLayoutProfile = (
  { width, height }: ViewportSize,
  chromeHeights: LayoutChromeHeights = DEFAULT_LAYOUT_CHROME_HEIGHTS,
  boardScaleCeilingMin: number = DEFAULT_BOARD_SCALE_CEILING_MIN
): GameLayoutProfile => {
  const safeWidth = Math.max(240, Math.round(width));
  const safeHeight = Math.max(320, Math.round(height));
  const portraitAspect = safeHeight / safeWidth;
  const isLandscape = safeWidth > safeHeight;

  const tallProgress = clamp(
    (portraitAspect - LEGACY_PORTRAIT_ASPECT) / (MODERN_PHONE_PORTRAIT_ASPECT - LEGACY_PORTRAIT_ASPECT),
    0,
    1
  );
  const ultraTallBoost = clamp((portraitAspect - MODERN_PHONE_PORTRAIT_ASPECT) / 0.24, 0, 1);
  const shortPenalty = clamp((LEGACY_PORTRAIT_ASPECT - portraitAspect) / 0.24, 0, 1);

  const boardScaleMultiplier = clamp(
    lerp(0.95, 1.02, tallProgress) + ultraTallBoost * 0.02 - shortPenalty * 0.05,
    0.88,
    1.04
  );
  const mainGapPx = Math.round(clamp(lerp(12, 22, tallProgress) * (isLandscape ? 0.58 : 1), 8, 24));
  // 상단-보드 간격이 과도하게 벌어지지 않도록 여백 상한을 보수적으로 유지
  const whitespacePx = clamp(safeHeight * lerp(0.07, 0.14, tallProgress) * (isLandscape ? 0.34 : 1), 10, 96);
  const columnMaxWidthPx = safeWidth >= 1440 ? 620 : safeWidth >= 1024 ? 560 : safeWidth >= 768 ? 500 : 448;
  const shouldHeightLimitColumn = isLandscape && safeHeight < 760;
  const heightLimitedColumnMaxPx = shouldHeightLimitColumn
    ? Math.max(220, Math.floor(safeHeight * 0.58))
    : Number.POSITIVE_INFINITY;
  const columnWidthPx = Math.min(columnMaxWidthPx, safeWidth, heightLimitedColumnMaxPx);
  const contentWidthPx = Math.max(180, columnWidthPx - 32);
  const rawSlotHeightPx = Math.max(42, (contentWidthPx - 32) / 3);
  const slotHeightPx = shouldHeightLimitColumn
    ? Math.min(rawSlotHeightPx, safeHeight * 0.17)
    : rawSlotHeightPx;
  // 상단 조작줄과 보드 사이는 모든 스킨에서 같은 밀도로 보이도록 별도 기준값으로 고정한다.
  const mainTopPaddingPx = Math.round(clamp(lerp(9, 13, tallProgress) * (isLandscape ? 0.75 : 1), 8, 13));
  const mainBottomPaddingPx = Math.max(0, whitespacePx - mainTopPaddingPx);
  const measuredHeaderHeightPx = clamp(chromeHeights.header, 56, 180);
  const reservedFooterHeightPx = clamp(chromeHeights.footer, STABLE_BANNER_RESERVE_PX, 260);
  const availableMainHeightPx = Math.max(180, safeHeight - measuredHeaderHeightPx - reservedFooterHeightPx);
  // 새로고침 버튼 행(min-h-10)과 두 번째 gap까지 포함해 정확하게 보드 높이 예산 계산
  const REFRESH_ROW_HEIGHT_PX = 40;
  const boardHeightBudgetPx =
    availableMainHeightPx - slotHeightPx - mainGapPx * 2 - REFRESH_ROW_HEIGHT_PX - mainTopPaddingPx - mainBottomPaddingPx;
  const boardScaleCeiling = clamp(
    Math.min(contentWidthPx, boardHeightBudgetPx) / 420,
    boardScaleCeilingMin,
    1.04
  );

  return {
    columnMaxWidthPx,
    columnWidthPx,
    boardScaleMultiplier,
    boardScaleCeiling,
    mainGapPx,
    mainTopPaddingPx,
    mainBottomPaddingPx,
  };
};

const getOrientationLockMessage = (language: string): OrientationLockMessage => {
  const normalized = normalizeLanguage(language);
  if (normalized.startsWith('ko')) return ORIENTATION_LOCK_MESSAGES.ko;
  if (normalized.startsWith('ja')) return ORIENTATION_LOCK_MESSAGES.ja;
  if (normalized.startsWith('zh')) return ORIENTATION_LOCK_MESSAGES.zh;
  return ORIENTATION_LOCK_MESSAGES.en;
};

const App: React.FC = () => {
  // --- i18n ---
  const { t, i18n } = useTranslation();
  const tagline = String(t('game:tagline'));

  // --- Routing State ---
  const [currentRoute, setCurrentRoute] = useState<Route>(getCurrentRoute());
  const isNative = isNativeApp();
  const isAppIntoSBuild = isAppIntoS();

  useEffect(() => {
    document.documentElement.lang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  }, [i18n.language, i18n.resolvedLanguage]);

  // 앱인토스 빌드 시 body에 클래스 추가 (safe area 활성화)
  useEffect(() => {
    if (isAppIntoSBuild) {
      document.body.classList.add('appintos-build');
    }
    return () => {
      document.body.classList.remove('appintos-build');
    };
  }, [isAppIntoSBuild]);

  // 게임 화면 전용 안전 상단 여백 계산 (노치/카메라/상단바 대응)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const isAndroid = isAndroidApp();
    const minTopPx = isAndroid ? 16 : 8;
    const retryTimerIds: number[] = [];

    const readSafeTopPx = () => {
      return getSafeAreaInsetPx('top');
    };

    const readVisualViewportTopPx = () => {
      const raw = window.visualViewport?.offsetTop ?? 0;
      return Number.isFinite(raw) ? Math.max(0, raw) : 0;
    };

    const readInAppBrowserTopChromePx = () => {
      if (!isLikelyIOSInAppBrowser()) return 0;
      const visualTop = readVisualViewportTopPx();
      return clamp(
        Math.max(IOS_IN_APP_BROWSER_TOP_CHROME_FALLBACK_PX, visualTop),
        IOS_IN_APP_BROWSER_TOP_CHROME_FALLBACK_PX,
        IOS_IN_APP_BROWSER_TOP_CHROME_MAX_PX
      );
    };

    const clearRetryTimers = () => {
      retryTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      retryTimerIds.length = 0;
    };

    const updateGameSafeTop = () => {
      const safeTop = readSafeTopPx();
      const inAppBrowserTop = readInAppBrowserTopChromePx();
      // safe-area와 인앱 브라우저 chrome 높이는 동일 축의 값이므로 합산하면 과보정이 발생한다.
      const nextTop = Math.max(minTopPx, safeTop, inAppBrowserTop);
      root.style.setProperty('--game-safe-top', `${nextTop}px`);
      root.style.setProperty('--ui-safe-top', `${nextTop}px`);
    };

    const scheduleSafeTopSync = () => {
      clearRetryTimers();
      updateGameSafeTop();
      VIEWPORT_RECOVERY_DELAYS_MS.forEach((delayMs) => {
        retryTimerIds.push(window.setTimeout(updateGameSafeTop, delayMs));
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleSafeTopSync();
    };

    scheduleSafeTopSync();
    window.addEventListener('resize', updateGameSafeTop);
    window.addEventListener('orientationchange', scheduleSafeTopSync);
    window.addEventListener('focus', scheduleSafeTopSync);
    window.addEventListener('pageshow', scheduleSafeTopSync);
    window.addEventListener(APP_RESUME_EVENT, scheduleSafeTopSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.visualViewport?.addEventListener('resize', updateGameSafeTop);
    window.visualViewport?.addEventListener('scroll', updateGameSafeTop);
    window.addEventListener('scroll', updateGameSafeTop);
    return () => {
      clearRetryTimers();
      window.removeEventListener('resize', updateGameSafeTop);
      window.removeEventListener('orientationchange', scheduleSafeTopSync);
      window.removeEventListener('focus', scheduleSafeTopSync);
      window.removeEventListener('pageshow', scheduleSafeTopSync);
      window.removeEventListener(APP_RESUME_EVENT, scheduleSafeTopSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.visualViewport?.removeEventListener('resize', updateGameSafeTop);
      window.visualViewport?.removeEventListener('scroll', updateGameSafeTop);
      window.removeEventListener('scroll', updateGameSafeTop);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const retryTimerIds: number[] = [];
    let guardedHeightDropTarget: number | null = null;
    let guardedHeightDropCommitTimerId: number | null = null;

    const clearGuardedHeightDropCommitTimer = () => {
      if (guardedHeightDropCommitTimerId !== null) {
        window.clearTimeout(guardedHeightDropCommitTimerId);
        guardedHeightDropCommitTimerId = null;
      }
    };

    const updateViewportSize = (forceGuardedHeightDropCommit = false) => {
      setViewportSize((prev) => {
        const next = getViewportSize();
        const heightDropPx = prev.height - next.height;
        const widthShiftPx = Math.abs(prev.width - next.width);
        const isLargeHeightDrop =
          heightDropPx > 0 &&
          (heightDropPx >= VIEWPORT_HEIGHT_DROP_GUARD_PX ||
            heightDropPx / Math.max(1, prev.height) >= VIEWPORT_HEIGHT_DROP_GUARD_RATIO);
        const shouldGuardHeightDrop =
          isLargeHeightDrop &&
          widthShiftPx <= VIEWPORT_HEIGHT_DROP_GUARD_MAX_WIDTH_SHIFT_PX &&
          !isEditableElementFocused() &&
          typeof document !== 'undefined' &&
          document.body.classList.contains('scroll-locked');
        const isRepeatedGuardedHeight =
          guardedHeightDropTarget !== null &&
          Math.abs(guardedHeightDropTarget - next.height) <= 1;
        if (shouldGuardHeightDrop && !isRepeatedGuardedHeight && !forceGuardedHeightDropCommit) {
          guardedHeightDropTarget = next.height;
          clearGuardedHeightDropCommitTimer();
          guardedHeightDropCommitTimerId = window.setTimeout(() => {
            guardedHeightDropCommitTimerId = null;
            updateViewportSize(true);
          }, VIEWPORT_HEIGHT_DROP_GUARD_REAPPLY_DELAY_MS);
          return prev;
        }
        clearGuardedHeightDropCommitTimer();
        guardedHeightDropTarget = null;
        const widthChanged = Math.abs(prev.width - next.width) > 0.5;
        const heightChanged = Math.abs(prev.height - next.height) > 0.5;
        if (!widthChanged && !heightChanged) return prev;
        return next;
      });
    };

    const clearRetryTimers = () => {
      retryTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      retryTimerIds.length = 0;
      clearGuardedHeightDropCommitTimer();
      guardedHeightDropTarget = null;
    };

    const resetScrollPosition = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    const scheduleViewportSync = () => {
      clearRetryTimers();
      resetScrollPosition();
      updateViewportSize();
      VIEWPORT_RECOVERY_DELAYS_MS.forEach((delayMs) => {
        retryTimerIds.push(window.setTimeout(() => {
          resetScrollPosition();
          updateViewportSize();
        }, delayMs));
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleViewportSync();
    };
    const handleViewportChange = () => {
      updateViewportSize();
    };

    scheduleViewportSync();

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', scheduleViewportSync);
    window.addEventListener('focus', scheduleViewportSync);
    window.addEventListener('pageshow', scheduleViewportSync);
    window.addEventListener(APP_RESUME_EVENT, scheduleViewportSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      clearRetryTimers();
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', scheduleViewportSync);
      window.removeEventListener('focus', scheduleViewportSync);
      window.removeEventListener('pageshow', scheduleViewportSync);
      window.removeEventListener(APP_RESUME_EVENT, scheduleViewportSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [nativeUpdateRequirement, setNativeUpdateRequirement] = useState<NativeUpdateRequirement | null>(null);
  const [isOpeningUpdateStore, setIsOpeningUpdateStore] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const {
    gate: customizationGate,
    resolveTileAppearance,
    skinSettings,
    addSkin,
    addFragments,
    addScoreMilestoneFragments,
    isPremiumUiThemeActive,
    premiumUiTheme,
    premiumUiObjects,
    premiumUiOverrides,
    premiumSkinRuntime,
  } = useBlockCustomization();
  const premiumWindowClassName = premiumUiObjects.windowClassName;
  const premiumWindowBodyClassName = premiumUiObjects.windowBodyClassName;
  const premiumTitleBarClassName = premiumUiObjects.titleBarClassName;
  const premiumTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
  const premiumTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
  const premiumAppShellClassName = premiumUiObjects.appShellClassName;
  const premiumMenuButtonClassName = premiumUiObjects.buttons.menuClassName;
  const premiumGameButtonClassName = premiumUiObjects.buttons.gameClassName;
  const premiumIconButtonClassName = premiumUiObjects.buttons.iconClassName;
  const premiumPillButtonClassName = premiumUiObjects.buttons.pillClassName;
  const premiumHeaderMainButtonClassName = premiumUiObjects.buttons.headerMainClassName;
  const premiumHeaderIconButtonClassName = premiumUiObjects.buttons.headerIconClassName;
  const premiumHeaderActionButtonClassName = premiumUiObjects.buttons.headerActionClassName;
  const premiumGameHeaderClassName = premiumUiObjects.board.gameHeaderClassName;
  const premiumGameBoardWindowClassName = premiumUiObjects.board.gameWindowClassName;
  const premiumGameBoardBodyClassName = premiumUiObjects.board.gameBodyClassName;
  const premiumFieldsetClassName = premiumUiObjects.panels.fieldsetClassName;
  const premiumMutedTextClassName = premiumUiObjects.extended.text.mutedClassName;
  const premiumMenuWindowClassName = premiumUiObjects.extended.windows.menuWindowClassName;
  const premiumModalWindowClassName = premiumUiObjects.extended.windows.modalWindowClassName;
  const premiumRadioGroupClassName = premiumUiObjects.extended.windows.radioGroupClassName;
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [gameOverReason, setGameOverReason] = useState<GameOverDiagnosis | null>(null);
  const [seasonCheckSeq, setSeasonCheckSeq] = useState(0);
  const [isSeasonRewardOpen, setIsSeasonRewardOpen] = useState(false);
  const [seasonRewards, setSeasonRewards] = useState<SeasonReward[]>([]);
  const premiumNavHeightPx = premiumUiObjects.extended.navigation.navHeightPx;
  const [menuBottomNavHeight, setMenuBottomNavHeight] = useState<number>(() =>
    isNative ? getEstimatedBottomNavHeight(isPremiumUiThemeActive, premiumNavHeightPx) : 0
  );
  const [menuSafeBottomInsetPx, setMenuSafeBottomInsetPx] = useState<number>(() =>
    isNative ? Math.max(0, Math.round(getSafeAreaInsetPx('bottom'))) : 0
  );
  const menuNativeBannerBottomMarginPx = useMemo(() => {
    if (!isNative) return 0;
    const navHeight = Math.max(0, Math.round(menuBottomNavHeight));
    const safeBottom = Math.max(0, Math.round(menuSafeBottomInsetPx));
    // AdMob/App-into-S SDK는 하단 safe-area를 자체 반영하므로 nav 높이에서 safe-bottom을 제외해 중복 오프셋을 방지한다.
    return Math.max(0, navHeight - safeBottom);
  }, [isNative, menuBottomNavHeight, menuSafeBottomInsetPx]);

  // Hide Capacitor Splash Screen immediately
  useEffect(() => {
    SplashScreen.hide().catch(() => {
      // 웹 환경에서는 에러가 발생할 수 있으므로 무시
    });
  }, []);

  useEffect(() => {
    if (isNative) {
      setMenuBottomNavHeight(getEstimatedBottomNavHeight(isPremiumUiThemeActive, premiumNavHeightPx));
    }
  }, [isPremiumUiThemeActive, isNative, premiumNavHeightPx]);

  const nativeSystemBarsStyle = useMemo(() => (
    LIGHT_SYSTEM_BAR_CONTENT_FAMILIES.has(premiumSkinRuntime.family)
      ? SystemBarsStyle.Dark
      : SystemBarsStyle.Light
  ), [premiumSkinRuntime.family]);

  useEffect(() => {
    if (!isNative) return;

    let isDisposed = false;
    const applySystemBarsStyle = () => {
      SystemBars.show({})
        .then(() => SystemBars.setStyle({ style: nativeSystemBarsStyle }))
        .catch(() => {
          // SystemBars can be unavailable in web previews or old shells.
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      applySystemBarsStyle();
    };

    applySystemBarsStyle();
    const timerIds = VIEWPORT_RECOVERY_DELAYS_MS.map((delayMs) => window.setTimeout(() => {
      if (!isDisposed) applySystemBarsStyle();
    }, delayMs));

    window.addEventListener(APP_RESUME_EVENT, applySystemBarsStyle);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isDisposed = true;
      timerIds.forEach((id) => window.clearTimeout(id));
      window.removeEventListener(APP_RESUME_EVENT, applySystemBarsStyle);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isNative, nativeSystemBarsStyle]);

  useEffect(() => {
    if (!isNative || typeof window === 'undefined') return;

    const syncSafeBottomInset = () => {
      setMenuSafeBottomInsetPx(Math.max(0, Math.round(getSafeAreaInsetPx('bottom'))));
    };

    syncSafeBottomInset();
    const timerIds = VIEWPORT_RECOVERY_DELAYS_MS.map((delayMs) => window.setTimeout(syncSafeBottomInset, delayMs));

    window.addEventListener('resize', syncSafeBottomInset);
    window.addEventListener(APP_RESUME_EVENT, syncSafeBottomInset);
    window.visualViewport?.addEventListener('resize', syncSafeBottomInset);
    return () => {
      timerIds.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', syncSafeBottomInset);
      window.removeEventListener(APP_RESUME_EVENT, syncSafeBottomInset);
      window.visualViewport?.removeEventListener('resize', syncSafeBottomInset);
    };
  }, [isNative]);

  // 랭킹 오프라인 큐 자동 동기화
  useEffect(() => {
    rankingService.initSync();
    initEventScoreSync();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 스트릭 상태 확인 + 시즌 보상 체크 (앱 시작 시 1회)
  useEffect(() => {
    // 1) 스트릭: 빠진 날 프리즈 소모 또는 리셋 처리
    const result = checkAndUpdateStreak();
    setStreakCount(result.currentStreak);
    setTodayAttended(isTodayAttended());

    if (result.freezeUsed > 0) {
      showComboMessage(String(t('common:streak.freezeUsed', { count: result.freezeUsed } as any)), 3000);
    } else if (result.streakBroken) {
      // 프리즈 자동 사용 OFF인데 프리즈가 있었으면 구분 안내
      const data = loadStreakData();
      if (data.freezeCount > 0 && !data.autoFreezeEnabled) {
        showComboMessage(t('common:streak.freezeAutoOff'), 3000);
      } else {
        showComboMessage(t('common:streak.streakReset'), 2500);
      }
    }

    // 2) 시즌 보상 체크 (네이티브 앱에서만 의미 있지만, 웹에서도 안내 표시)
    checkSeasonRewards().then(async result => {
      if (result.rewards.length > 0) {
        // 아직 확인하지 않은 보상이 있을 때만 진행
        if (hasUnseenSeasonRewards(result.rewards)) {
          // 자동 수령 (서버에 claimed_at 기록 + 로컬 fragment 추가)
          await claimAllSeasonRewards(result.rewards);
          setSeasonRewards(result.rewards);
          openSeasonRewardModal();
        } else {
          setSeasonRewards(result.rewards);
        }
      }
      setSeasonCheckSeq(1);
    }).catch(() => {
      setSeasonCheckSeq(1);
      // 오프라인 등 실패 시 무시
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 미션 시스템 초기화 =====
  useEffect(() => {
    initMissionTracking();
    const syncDailyMissionCompleted = () => {
      setDailyMissionCompleted(getDailyCompletedCount());
    };
    const scheduleMissionNotificationResync = () => {
      if (missionRescheduleDebounceRef.current != null) {
        window.clearTimeout(missionRescheduleDebounceRef.current);
      }
      missionRescheduleDebounceRef.current = window.setTimeout(() => {
        missionRescheduleDebounceRef.current = null;
        void rescheduleNotifications({ allowPermissionPrompt: isEarlyOnboardingCompleted() });
      }, 500);
    };

    const unsubComplete = gameEventBus.on('MISSION_COMPLETED', (info: MissionCompleteInfo) => {
      syncDailyMissionCompleted();
      scheduleMissionNotificationResync();
      showComboMessage(`🎯 ${t(info.nameKey as any)} ${t('game:missions.completed' as any)}`, 3000);
    });

    const unsubProgress = gameEventBus.on('MISSION_PROGRESS', (info: MissionProgressInfo) => {
      const now = Date.now();
      if (now - missionProgressThrottleRef.current < 3000) return;
      missionProgressThrottleRef.current = now;
      showComboMessage(`📋 ${t(info.nameKey as any)} ${info.milestonePercent}% (${info.current}/${info.target})`, 2000);
    });

    const unsubMissionStateChanged = gameEventBus.on('MISSION_STATE_CHANGED', () => {
      syncDailyMissionCompleted();
      scheduleMissionNotificationResync();
    });

    return () => {
      unsubComplete();
      unsubProgress();
      unsubMissionStateChanged();
      if (missionRescheduleDebounceRef.current != null) {
        window.clearTimeout(missionRescheduleDebounceRef.current);
        missionRescheduleDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const syncDailyMissionCompleted = () => {
      setDailyMissionCompleted(getDailyCompletedCount());
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      syncDailyMissionCompleted();
    };

    const intervalId = window.setInterval(syncDailyMissionCompleted, 60_000);
    window.addEventListener(APP_RESUME_EVENT, syncDailyMissionCompleted);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(APP_RESUME_EVENT, syncDailyMissionCompleted);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ===== 로컬 푸시 알림 스케줄링 (앱 시작 시) =====
  useEffect(() => {
    void rescheduleNotifications({ allowPermissionPrompt: isEarlyOnboardingCompleted() });
  }, []);

  // ===== XP/레벨 시스템 초기화 =====
  useEffect(() => {
    initXpTracking();

    const refreshXpUI = () => {
      const p = getXpProgress();
      setXpLevel(p.level);
      setXpPercent(p.xpRequired > 0 ? Math.floor((p.xp / p.xpRequired) * 100) : 0);
    };

    const unsubXp = gameEventBus.on('XP_GAINED', () => {
      refreshXpUI();
    });

    const unsubLevelUp = gameEventBus.on('LEVEL_UP', (info) => {
      refreshXpUI();
      showComboMessage(`⬆️ Lv.${info.level}! ${info.fragments > 0 ? `+${info.fragments} ✦` : ''}`, 3000);

    });

    return () => { unsubXp(); unsubLevelUp(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fake loading delay for the premium feel
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // 데일리 첫 실행 모달: 시즌 보상 확인 후 → 시즌 모달 닫힌 후 → 로딩 완료 + MENU + 오늘 첫 실행 + 1회 플레이 이후
  useEffect(() => {
    if (isLoading) return;
    if (gameState !== GameState.MENU) return;
    if (seasonCheckSeq === 0) return;
    if (isSeasonRewardOpen) return;
    if (isFirstLaunchToday() && hasEverPlayed()) {
      setIsDailyLaunchModalOpen(true);
    }
  }, [isLoading, gameState, seasonCheckSeq, isSeasonRewardOpen]);

  useEffect(() => {
    if (!isNative || isAppIntoSBuild) {
      setNativeUpdateRequirement(null);
      setIsOpeningUpdateStore(false);
      return;
    }

    let isDisposed = false;
    let checkInFlight = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const runVersionCheck = async () => {
      if (checkInFlight) return;
      checkInFlight = true;
      try {
        const requirement = await checkNativeUpdateRequirement();
        if (!isDisposed) {
          setNativeUpdateRequirement(requirement);
          if (!requirement) {
            setIsOpeningUpdateStore(false);
          }
        }
      } finally {
        checkInFlight = false;
      }
    };

    void runVersionCheck();

    void import('@capacitor/app').then(({ App: CapacitorApp }) => {
      if (isDisposed) return;
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        window.dispatchEvent(new Event(APP_RESUME_EVENT));
        void runVersionCheck();
        void rescheduleNotifications({ allowPermissionPrompt: isEarlyOnboardingCompleted() });
      }).then((handle) => {
        if (isDisposed) {
          void handle.remove();
          return;
        }
        listenerHandle = handle;
      }).catch(() => {
        // ignore
      });
    }).catch(() => {
      // ignore — web environment
    });

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [isNative, isAppIntoSBuild]);

  useEffect(() => {
    if (!isOpeningUpdateStore) return;
    const timer = globalThis.setTimeout(() => {
      setIsOpeningUpdateStore(false);
    }, 2500);
    return () => globalThis.clearTimeout(timer);
  }, [isOpeningUpdateStore]);

  const [grid, setGrid] = useState<Grid>(createEmptyGrid(8));
  const [obstacleState, setObstacleState] = useState<ObstacleState>(() => createEmptyObstacleState());
  const [unlockedObstacleFeatures, setUnlockedObstacleFeatures] = useState<ObstacleFeature[]>([]);
  const [obstacleUnlockQueue, setObstacleUnlockQueue] = useState<ObstacleFeature[]>([]);
  const [showObstacleUnlockDetails, setShowObstacleUnlockDetails] = useState(false);
  const [slots, setSlots] = useState<(Piece | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [maxScoreThisRun, setMaxScoreThisRun] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<Phase>(Phase.PLACE);
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(getViewportSize);
  const [layoutChromeHeights, setLayoutChromeHeights] = useState<LayoutChromeHeights>(DEFAULT_LAYOUT_CHROME_HEIGHTS);
  const [comboMessageQueue, setComboMessageQueue] = useState<ComboMessageItem[]>([]);

  // ── Combo system ──
  const [comboCount, setComboCount] = useState(0);
  const [comboTimerMs, setComboTimerMs] = useState(0);
  const [isComboActive, setIsComboActive] = useState(false);
  const comboMultiplierRef = useRef(1.0);
  const maxComboMultiplierRef = useRef(1.0);
  const maxComboCountRef = useRef(0);
  const comboTimerRef = useRef<number | null>(null);

  const COMBO_MULTIPLIERS = [1.0, 1.0, 1.2, 1.5, 2.0, 3.0];
  const COMBO_TIMER_MS = 2500;
  const COMBO_TICK_MS = 50;

  const getComboMultiplier = useCallback((count: number): number => {
    if (count >= 5) return 3.0;
    return COMBO_MULTIPLIERS[count] || 1.0;
  }, []);

  const startComboTimer = useCallback(() => {
    if (comboTimerRef.current) clearInterval(comboTimerRef.current);

    setComboTimerMs(COMBO_TIMER_MS);

    comboTimerRef.current = window.setInterval(() => {
      setComboTimerMs(prev => {
        const next = prev - COMBO_TICK_MS;
        if (next <= 0) {
          if (comboTimerRef.current) clearInterval(comboTimerRef.current);
          comboTimerRef.current = null;
          requestAnimationFrame(() => {
            setComboCount(0);
            setIsComboActive(false);
            comboMultiplierRef.current = 1.0;
          });
          return 0;
        }
        return next;
      });
    }, COMBO_TICK_MS);
  }, []);

  const triggerComboIncrement = useCallback((mergeCount: number) => {
    if (mergeCount < 1) return;

    const bonusSteps = mergeCount >= 3 ? Math.floor(mergeCount / 3) : 0;
    const increment = 1 + bonusSteps;

    setComboCount(prev => {
      const next = prev + increment;
      if (next >= 1) {
        setIsComboActive(true);
        comboMultiplierRef.current = getComboMultiplier(next);
        if (comboMultiplierRef.current > maxComboMultiplierRef.current) {
          maxComboMultiplierRef.current = comboMultiplierRef.current;
        }
        if (next > maxComboCountRef.current) {
          maxComboCountRef.current = next;
        }
        startComboTimer();
      }
      return next;
    });
  }, [getComboMultiplier, startComboTimer]);

  const resetComboState = useCallback(() => {
    if (comboTimerRef.current) {
      clearInterval(comboTimerRef.current);
      comboTimerRef.current = null;
    }
    setComboCount(0);
    setComboTimerMs(0);
    setIsComboActive(false);
    comboMultiplierRef.current = 1.0;
    maxComboMultiplierRef.current = 1.0;
  }, []);

  const isWin98ThemeActive = isPremiumUiThemeActive && premiumUiTheme?.family === 'win98';
  const isLandscapeViewport = useMemo(() => {
    if (typeof window === 'undefined') return false;
    // screen.orientation.type is the most reliable way to detect device orientation
    if (screen?.orientation?.type) {
      return screen.orientation.type.startsWith('landscape');
    }
    // Fallback: use matchMedia which respects actual device orientation
    if (window.matchMedia) {
      return window.matchMedia('(orientation: landscape)').matches;
    }
    return viewportSize.width > viewportSize.height;
  }, [viewportSize.width, viewportSize.height]);
  const isTouchLikeWeb = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  }, [viewportSize.width, viewportSize.height]);
  const shouldBlockLandscapeOnWeb = !isNative && isTouchLikeWeb && currentRoute === '/';
  const shouldShowPortraitLockOverlay = shouldBlockLandscapeOnWeb && isLandscapeViewport;
  const orientationLockMessage = useMemo(
    () => getOrientationLockMessage(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
    [i18n.language, i18n.resolvedLanguage]
  );

  useEffect(() => {
    if (!shouldBlockLandscapeOnWeb) return;
    if (typeof screen === 'undefined') return;
    const orientationApi = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'portrait') => Promise<void>;
    };
    if (!orientationApi.lock) return;

    orientationApi.lock('portrait').catch(() => {
      // 브라우저 정책(사용자 제스처/전체화면 요구)으로 실패할 수 있음.
      // 실패 시에는 가로모드 차단 오버레이로 UX를 보장한다.
    });
  }, [shouldBlockLandscapeOnWeb, viewportSize.width, viewportSize.height]);

  const gameLayoutProfile = useMemo(
    () => getGameLayoutProfile(
      viewportSize,
      layoutChromeHeights,
      isWin98ThemeActive ? WIN98_BOARD_SCALE_CEILING_MIN : DEFAULT_BOARD_SCALE_CEILING_MIN
    ),
    [viewportSize, layoutChromeHeights, isWin98ThemeActive]
  );

  const baseBoardScale = useMemo(() => {
    switch (boardSize) {
      case 4:
        return 0.82;
      case 5:
        return 0.88;
      case 7:
        return 0.94;
      default:
        return 1;
    }
  }, [boardSize]);

  const boardScale = useMemo(() => {
    const scaled = baseBoardScale * gameLayoutProfile.boardScaleMultiplier;
    return Math.min(scaled, gameLayoutProfile.boardScaleCeiling);
  }, [baseBoardScale, gameLayoutProfile.boardScaleMultiplier, gameLayoutProfile.boardScaleCeiling]);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isSkinOpen, setIsSkinOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // ── 최초 50점 스킨 보상 ──
  const [showFirstSkinRewardModal, setShowFirstSkinRewardModal] = useState(false);
  const [skinModalFreeDraw, setSkinModalFreeDraw] = useState(false);

  // 순차 온보딩 상태
  const [seqOnboardingStep, setSeqOnboardingStep] = useState<SequentialStep | null>(null);
  const [seqOnboardingIndex, setSeqOnboardingIndex] = useState(0);
  const [isSeqOnboardingVisible, setIsSeqOnboardingVisible] = useState(false);
  const [pendingSeqStep, setPendingSeqStep] = useState<SequentialStep | null>(null);
  const firstSkinRewardTriggeredRef = useRef(false);
  const isFirstSkinRewardInputBlocked = showFirstSkinRewardModal;
  const activeObstacleUnlock = obstacleUnlockQueue[0] ?? null;
  const isObstacleUnlockModalOpen = activeObstacleUnlock !== null;
  const isGameplayInputBlocked = isFirstSkinRewardInputBlocked || isObstacleUnlockModalOpen;
  const activeObstacleUnlockChance = useMemo(() => {
    if (!activeObstacleUnlock) return null;
    return getObstacleSpawnChanceBreakdown({
      boardSize,
      score,
      maxTile: getMaxTileValue(grid),
      obstacleState,
      feature: activeObstacleUnlock,
    });
  }, [activeObstacleUnlock, boardSize, grid, obstacleState, score]);

  useEffect(() => {
    setShowObstacleUnlockDetails(false);
  }, [activeObstacleUnlock]);

  // 스트릭 + 시즌 보상 상태
  const [isStreakInfoOpen, setIsStreakInfoOpen] = useState(false);

  const [streakCount, setStreakCount] = useState(() => loadStreakData().currentStreak);
  const [todayAttended, setTodayAttended] = useState(() => isTodayAttended());
  const attendanceToastShownRef = useRef(false);
  const attendanceHintShownRef = useRef(false);

  // ===== 미션 시스템 상태 =====
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isDailyLaunchModalOpen, setIsDailyLaunchModalOpen] = useState(false);
  const [skinModalAutoDraw, setSkinModalAutoDraw] = useState(false);
  const [dailyMissionCompleted, setDailyMissionCompleted] = useState(() => getDailyCompletedCount());
  const missionProgressThrottleRef = useRef(0);
  const missionRescheduleDebounceRef = useRef<number | null>(null);

  // ===== XP/레벨 + 캘린더 상태 =====
  const [isXpModalOpen, setIsXpModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [xpLevel, setXpLevel] = useState(() => loadXpData().level);
  const [xpPercent, setXpPercent] = useState(() => {
    const p = getXpProgress();
    return p.xpRequired > 0 ? Math.floor((p.xp / p.xpRequired) * 100) : 0;
  });

  // ===== 데일리 챌린지 상태 =====
  const [gameMode, setGameMode] = useState<GameMode>('normal');
  const challengeDateRef = useRef<string | null>(null);
  const challengeSeedRef = useRef<number | null>(null);
  const challengePieceIndexRef = useRef<number>(0);
  const [isDailyChallengeLoading, setIsDailyChallengeLoading] = useState(false);

  // ===== 주간 이벤트 상태 =====
  const [isWeeklyEventModalOpen, setIsWeeklyEventModalOpen] = useState(false);
  const eventRuleRef = useRef<WeeklyEventRule | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const eventAttemptNumberRef = useRef<number>(1);
  /** 이벤트 누적 플레이 시간(ms) — 일시정지/백그라운드에서는 멈춤 */
  const eventPlayedMsRef = useRef<number>(0);
  /** 이벤트 타이머 시작 시점 (null이면 일시정지 중) */
  const eventTimerStartedAtRef = useRef<number | null>(null);
  const eventTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [eventTimerDisplay, setEventTimerDisplay] = useState<string | null>(null);

  // Name Input State
  const [isNameInputOpen, setIsNameInputOpen] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<number | null>(null);
  const [pendingSessionMode, setPendingSessionMode] = useState<PendingSessionMode | null>(null);
  const [playerName, setPlayerName] = useState<string>(loadInitialPlayerName);
  const [sessionLockedPlayerName, setSessionLockedPlayerName] = useState<string | null>(null);
  const [showActiveGameWarning, setShowActiveGameWarning] = useState(false);
  const [isActiveGameExitModalOpen, setIsActiveGameExitModalOpen] = useState(false);
  const [activeGameExitContext, setActiveGameExitContext] = useState<ActiveGameExitContext>('HOME');
  const [activeGameRankingSnapshot, setActiveGameRankingSnapshot] = useState<ActiveGameRankingSnapshot | null>(null);

  // 슬라이드 단계에서의 배치 허용 플래그(현재 룰에서는 항상 false를 유지)
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // Undo 시스템: 직전 스냅샷과 남은 사용 횟수
  const [lastSnapshot, setLastSnapshot] = useState<GameSnapshot | null>(null);
  const [undoRemaining, setUndoRemaining] = useState(INITIAL_UNDO_AMOUNT);
  const [blockRefreshRemaining, setBlockRefreshRemaining] = useState(INITIAL_BLOCK_REFRESH_AMOUNT);

  // 복기(Review) 모드: 게임오버 후 지난 플레이를 돌아볼 수 있는 스냅샷 히스토리
  const MAX_SNAPSHOTS = 20;
  const [snapshotHistory, setSnapshotHistory] = useState<GameSnapshot[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);

  // 1024 타일 Undo 파밍 방지: 세션 내 실제 1024 보상 지급 횟수를 추적
  // (Undo로 되돌려도 이미 지급된 카운트는 유지)
  const rewarded1024CountRef = useRef(0);
  const [showBlockRefreshAdButton, setShowBlockRefreshAdButton] = useState(false);
  const [isBlockRefreshAdInProgress, setIsBlockRefreshAdInProgress] = useState(false);
  const [blockRefreshNotice, setBlockRefreshNotice] = useState<string | null>(null);

  // Merging tiles for animation (tiles being absorbed)
  const [mergingTiles, setMergingTiles] = useState<MergingTile[]>(EMPTY_MERGING_TILES);
  const [portalReleaseAnimations, setPortalReleaseAnimations] = useState<PortalReleaseAnimation[]>(EMPTY_PORTAL_RELEASE_ANIMATIONS);

  // Tutorial State: 0=Off, 1=Drag, 2=Swipe
  const [tutorialStep, setTutorialStep] = useState<number>(0);
  const [tutorialResetKey, setTutorialResetKey] = useState(0);
  const [activeOnboardingStep, setActiveOnboardingStep] = useState<MenuOnboardingStep>('none');
  const skinFeatureAutoSkipRetryTimerRef = useRef<number | null>(null);

  
  // Help Modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  const closeOverlayModalsExcept = useCallback((keep: OverlayModalKey | null = null) => {
    setIsCustomizationOpen(keep === 'customization');
    setIsSkinOpen(keep === 'skin');
    setIsLeaderboardOpen(keep === 'leaderboard');
    setIsStreakInfoOpen(keep === 'streak');
    setIsSeasonRewardOpen(keep === 'season_reward');
    setIsMissionModalOpen(keep === 'mission');
    setIsXpModalOpen(keep === 'xp');
    setIsCalendarOpen(keep === 'calendar');
    setIsWeeklyEventModalOpen(keep === 'weekly_event');
    setIsNameInputOpen(keep === 'name_input');
    setIsActiveGameExitModalOpen(keep === 'active_game_exit');
    setShowHelpModal(keep === 'help');
    if (keep !== 'active_game_exit') {
      setActiveGameRankingSnapshot(null);
    }
  }, []);

  const openExclusiveModal = useCallback((modal: OverlayModalKey) => {
    closeOverlayModalsExcept(modal);
  }, [closeOverlayModalsExcept]);

  const openCustomizationModal = useCallback(() => {
    openExclusiveModal('customization');
  }, [openExclusiveModal]);

  const openSkinModal = useCallback(() => {
    // pending 여부와 관계없이, 아직 첫 스킨 보상을 수령하지 않은 모든 유저에게 무료 뽑기 기회 제공
    const shouldConsumePendingFreeDraw = !isFirstScoreSkinRewardClaimed();
    setSkinModalFreeDraw(shouldConsumePendingFreeDraw);
    openExclusiveModal('skin');
  }, [openExclusiveModal]);

  const openLeaderboardModal = useCallback(() => {
    openExclusiveModal('leaderboard');
  }, [openExclusiveModal]);

  const openStreakInfoModal = useCallback(() => {
    openExclusiveModal('streak');
  }, [openExclusiveModal]);

  const openSeasonRewardModal = useCallback(() => {
    openExclusiveModal('season_reward');
  }, [openExclusiveModal]);

  const openMissionModal = useCallback(() => {
    setDailyMissionCompleted(getDailyCompletedCount());
    openExclusiveModal('mission');
  }, [openExclusiveModal]);

  const openXpModal = useCallback(() => {
    openExclusiveModal('xp');
  }, [openExclusiveModal]);

  const openCalendarModal = useCallback(() => {
    openExclusiveModal('calendar');
  }, [openExclusiveModal]);

  const openWeeklyEventModal = useCallback(() => {
    openExclusiveModal('weekly_event');
  }, [openExclusiveModal]);

  const openNameInputModal = useCallback(() => {
    openExclusiveModal('name_input');
  }, [openExclusiveModal]);

  const resetPendingSessionStart = useCallback(() => {
    setPendingDifficulty(null);
    setPendingSessionMode(null);
    setShowActiveGameWarning(false);
  }, []);

  const closeNameInputModal = useCallback(() => {
    setIsNameInputOpen(false);
    resetPendingSessionStart();
  }, [resetPendingSessionStart]);

  const requestSessionNameForNormalStart = useCallback((size: BoardSize) => {
    setPendingDifficulty(size);
    setPendingSessionMode('normal');
    setShowActiveGameWarning(false);
    openNameInputModal();
  }, [openNameInputModal]);

  const requestSessionNameForWeeklyEventStart = useCallback(() => {
    setPendingDifficulty(getCurrentEvent().rule.boardSize);
    setPendingSessionMode('weekly_event');
    setShowActiveGameWarning(false);
    openNameInputModal();
  }, [openNameInputModal]);

  const openActiveGameExitDialog = useCallback(() => {
    openExclusiveModal('active_game_exit');
  }, [openExclusiveModal]);

  const openHelpModal = useCallback(() => {
    openExclusiveModal('help');
  }, [openExclusiveModal]);

  const refreshMenuOnboardingStep = useCallback(() => {
    const nextMenuStep = decideMenuOnboardingStep({
      isMenuState: gameState === GameState.MENU,
      isNameInputOpen,
      isCustomizationOpen,
      isSkinOpen,
      isLeaderboardOpen,
      isStreakInfoOpen,
      isSeasonRewardOpen,
      isMissionModalOpen,
      isXpModalOpen,
      isCalendarOpen,
      isWeeklyEventModalOpen,
      isActiveGameExitModalOpen,
      showFirstSkinRewardModal,
      hasSeenFirstSkinRewardFlow:
        isFirstScoreSkinRewardShown()
        || isFirstScoreSkinRewardClaimed()
        || isFirstScoreSkinRewardPending(),
    });

    setActiveOnboardingStep(nextMenuStep);
  }, [
    gameState,
    isActiveGameExitModalOpen,
    isCalendarOpen,
    isCustomizationOpen,
    isLeaderboardOpen,
    isMissionModalOpen,
    isNameInputOpen,
    isSeasonRewardOpen,
    isSkinOpen,
    isStreakInfoOpen,
    isWeeklyEventModalOpen,
    isXpModalOpen,
    showFirstSkinRewardModal,
  ]);

  const showCurrentSequentialOnboardingStep = useCallback(() => {
    const currentStep = getCurrentSequentialStep();
    if (!currentStep) {
      setSeqOnboardingStep(null);
      setIsSeqOnboardingVisible(false);
      return false;
    }

    setSeqOnboardingStep(currentStep);
    setSeqOnboardingIndex(SEQUENTIAL_STEPS.indexOf(currentStep));
    setIsSeqOnboardingVisible(true);
    return true;
  }, []);

  const hasSeenSkinFeatureTutorial = useCallback(() => {
    try {
      return Boolean(localStorage.getItem(ONBOARDING_STORAGE_KEYS.skinFeatureTutorialSeen));
    } catch {
      return false;
    }
  }, []);

  const startSequentialOnboardingAfterSkinTutorial = useCallback(() => {
    if (gameState !== GameState.MENU) return;
    if (!hasSeenSkinFeatureTutorial()) return;
    if (isSequentialOnboardingCompleted()) return;

    startSequentialOnboarding();
    showCurrentSequentialOnboardingStep();
  }, [gameState, hasSeenSkinFeatureTutorial, showCurrentSequentialOnboardingStep]);

  const handleSkinFeatureTutorialComplete = useCallback(() => {
    refreshMenuOnboardingStep();
    startSequentialOnboardingAfterSkinTutorial();
  }, [refreshMenuOnboardingStep, startSequentialOnboardingAfterSkinTutorial]);

  useEffect(() => {
    startSequentialOnboardingAfterSkinTutorial();
  }, [startSequentialOnboardingAfterSkinTutorial]);

  const handleSkinFeatureTutorialSkip = useCallback(() => {
    setActiveOnboardingStep('none');

    if (skinFeatureAutoSkipRetryTimerRef.current !== null) {
      window.clearTimeout(skinFeatureAutoSkipRetryTimerRef.current);
      skinFeatureAutoSkipRetryTimerRef.current = null;
    }

    // Auto-skip does not persist seen=true by design; defer one re-evaluation to avoid same-step immediate reselection.
    skinFeatureAutoSkipRetryTimerRef.current = window.setTimeout(() => {
      skinFeatureAutoSkipRetryTimerRef.current = null;
      refreshMenuOnboardingStep();
    }, SKIN_TARGET_POLICY.deferredRetryIntervalMs);
  }, [refreshMenuOnboardingStep]);

  
  // 🆕 Reward Ad State
  const [isAdReady, setIsAdReady] = useState(false);
  const [isReviveAdReady, setIsReviveAdReady] = useState(false);
  const [isReviveAdInProgress, setIsReviveAdInProgress] = useState(false);
  const [hasUsedReviveThisRun, setHasUsedReviveThisRun] = useState(false);
  const [isReviveSelectionMode, setIsReviveSelectionMode] = useState(false);
  const [reviveBreakRemaining, setReviveBreakRemaining] = useState(0);
  const [revivePendingTileId, setRevivePendingTileId] = useState<string | null>(null);
  const [reviveDestroyEffects, setReviveDestroyEffects] = useState<ReviveDestroyEffect[]>([]);

  // Check tutorial status on load
  useEffect(() => {
    setTutorialStep(isEarlyOnboardingCompleted() ? 0 : 1);
  }, []);

  useEffect(() => {
    refreshMenuOnboardingStep();
  }, [refreshMenuOnboardingStep, tutorialResetKey]);

  useEffect(() => {
    return () => {
      if (skinFeatureAutoSkipRetryTimerRef.current !== null) {
        window.clearTimeout(skinFeatureAutoSkipRetryTimerRef.current);
        skinFeatureAutoSkipRetryTimerRef.current = null;
      }
    };
  }, []);

  // Animation Lock
  const [isAnimating, setIsAnimating] = useState(false);
  const [tileValueOverrides, setTileValueOverrides] = useState<Record<string, number>>(EMPTY_TILE_VALUE_OVERRIDES);
  const [mergedNumberBurstTileIds, setMergedNumberBurstTileIds] = useState<ReadonlySet<string>>(EMPTY_TILE_ID_SET);
  const [mergedNumberBurstByTileId, setMergedNumberBurstByTileId] = useState<Readonly<Record<string, number>>>(EMPTY_TILE_BURST_MAP);

  // --- Dragging State ---
  const [draggingPiece, setDraggingPiece] = useState<Piece | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState<number>(-1);
  const [pressedSlotIndex, setPressedSlotIndex] = useState<number>(-1);

  // --- Refs ---
  const headerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const boardHandleRef = useRef<BoardHandle | null>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null); // 드래그 오버레이 직접 제어용 Ref
  const gameStartTimeRef = useRef<number>(Date.now()); // Legacy start marker (migration compatibility)
  const activePlayDurationMsRef = useRef<number>(0); // 실제 플레이 누적 시간 (백그라운드 제외)
  const activePlayStartedAtRef = useRef<number | null>(null); // 플레이 타이머가 재개된 시각
  const moveCountRef = useRef<number>(0); // Anti-cheat move counter
  const sessionIdRef = useRef<string>(crypto.randomUUID()); // 게임 세션 ID
  const [liveRankEstimate, setLiveRankEstimate] = useState<LiveRankEstimate | null>(null); // 게임 중 예상 순위

  const boardMetricsRef = useRef<BoardMetrics | null>(null);
  const liveRankFailureCountRef = useRef(0);
  const liveRankRetryAfterRef = useRef(0);
  const liveRankLastRequestAtRef = useRef(0);
  const liveRankRequestInFlightRef = useRef(false);
  const liveRankRequestQueuedRef = useRef(false);
  const liveRankRequestSequenceRef = useRef(0);
  const autoRankSessionIdRef = useRef<string>('');
  const autoRankLastSubmittedScoreRef = useRef(0);
  const autoRankLastSubmittedAtRef = useRef(0);
  const autoRankSubmitInFlightRef = useRef(false);
  const autoRankSubmitQueuedRef = useRef(false);
  const autoRankSubmitQueuedForceRef = useRef(false);
  const submitAutoRankProgressRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const hoverGridPosRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number, y: number } | null>(null); // 스와이프 시작 좌표
  const swipePointerIdRef = useRef<number | null>(null);
  const swipeCommittedRef = useRef(false);
  const slideLockRef = useRef(false); // state 반영 전에도 즉시 입력 차단
  const executeSlideRef = useRef<((dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void) | null>(null);
  const isReviveSelectionModeRef = useRef(false); // 부활 선택 모드 동기 가드 (state보다 먼저 반영)
  const mergeClearTimeoutRef = useRef<number | null>(null);
  const portalReleaseClearTimeoutRef = useRef<number | null>(null);
  const mergeFinalizeTimeoutRef = useRef<number | null>(null);
  const mergedNumberBurstClearTimeoutRef = useRef<number | null>(null);
  const unlockTimeoutRef = useRef<number | null>(null);
  const comboMessageTimeoutRef = useRef<number | null>(null);
  const comboMessageIdRef = useRef(0);
  const blockRefreshNoticeTimeoutRef = useRef<number | null>(null);
  const reviveDestroyEffectTimeoutsRef = useRef<number[]>([]);
  const dragPointerIdRef = useRef<number | null>(null);
  const currentPointerPosRef = useRef<{ x: number, y: number } | null>(null);
  const lastDragMoveEmitPosRef = useRef<{ x: number, y: number } | null>(null);
  const scoreRef = useRef<number>(score);
  const maxScoreThisRunRef = useRef<number>(maxScoreThisRun);
  const boardSizeRef = useRef<BoardSize>(boardSize);
  const gameModeRef = useRef<GameMode>(gameMode);
  const unlockedObstacleFeaturesRef = useRef<ObstacleFeature[]>(unlockedObstacleFeatures);
  const pendingObstacleMergedTileIdsRef = useRef<string[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const previousGameStateRef = useRef<GameState>(gameState);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    maxScoreThisRunRef.current = maxScoreThisRun;
  }, [maxScoreThisRun]);

  useEffect(() => {
    boardSizeRef.current = boardSize;
  }, [boardSize]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    unlockedObstacleFeaturesRef.current = unlockedObstacleFeatures;
  }, [unlockedObstacleFeatures]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const previous = previousGameStateRef.current;
    if (previous !== GameState.GAME_OVER && gameState === GameState.GAME_OVER) {
      const startedAt = activePlayStartedAtRef.current;
      const activeDurationMs = startedAt === null
        ? activePlayDurationMsRef.current
        : activePlayDurationMsRef.current + Math.max(0, Date.now() - startedAt);
      trackAnalyticsEvent({
        name: 'game_end',
        value: toDurationSeconds(activeDurationMs),
        meta: {
          score: scoreRef.current,
          boardSize: boardSizeRef.current,
          moves: moveCountRef.current,
        },
      });
    }
    previousGameStateRef.current = gameState;
  }, [gameState]);

  const buildMergedBurstValueMap = useCallback((mergedTiles: readonly MergedTile[]): Readonly<Record<string, number>> => {
    if (mergedTiles.length === 0) return EMPTY_TILE_BURST_MAP;
    const map: Record<string, number> = {};
    for (const tile of mergedTiles) {
      map[tile.id] = tile.toValue;
    }
    return map;
  }, []);

  const pauseActivePlayTimer = useCallback(() => {
    const startedAt = activePlayStartedAtRef.current;
    if (startedAt === null) return;
    activePlayDurationMsRef.current += Math.max(0, Date.now() - startedAt);
    activePlayStartedAtRef.current = null;
  }, []);

  const resumeActivePlayTimer = useCallback(() => {
    if (activePlayStartedAtRef.current !== null) return;
    activePlayStartedAtRef.current = Date.now();
  }, []);

  const syncActivePlayTimer = useCallback(() => {
    const shouldRun =
      gameStateRef.current === GameState.PLAYING &&
      isDocumentVisible() &&
      !showFirstSkinRewardModal;
    if (shouldRun) {
      resumeActivePlayTimer();
      return;
    }
    pauseActivePlayTimer();
  }, [pauseActivePlayTimer, resumeActivePlayTimer, showFirstSkinRewardModal]);

  const getCurrentActiveDurationMs = useCallback((): number => {
    const startedAt = activePlayStartedAtRef.current;
    if (startedAt === null) return activePlayDurationMsRef.current;
    return activePlayDurationMsRef.current + Math.max(0, Date.now() - startedAt);
  }, []);

  const getCurrentActiveDurationSeconds = useCallback((): number => {
    return toDurationSeconds(getCurrentActiveDurationMs());
  }, [getCurrentActiveDurationMs]);

  const shouldTrackGameChrome = gameState === GameState.PLAYING || gameState === GameState.GAME_OVER;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldTrackGameChrome) return;

    const updateChromeHeights = () => {
      const measuredHeader = headerRef.current?.getBoundingClientRect().height;
      const root = document.documentElement;

      setLayoutChromeHeights((prev) => {
        const rawHeader = measuredHeader ? Math.max(56, measuredHeader) : prev.header;
        const nextHeaderWithSpikeGuard = rawHeader > prev.header + CHROME_SPIKE_GUARD_STEP_PX
          ? prev.header + CHROME_SPIKE_GUARD_STEP_PX
          : rawHeader;
        const nextHeader = isWin98ThemeActive && nextHeaderWithSpikeGuard < prev.header - CHROME_SPIKE_GUARD_STEP_PX
          ? prev.header - CHROME_SPIKE_GUARD_STEP_PX
          : nextHeaderWithSpikeGuard;
        const nativeSafeBottomPx = isNative ? Math.max(0, Math.round(getSafeAreaInsetPx('bottom'))) : 0;
        // In-game footer is a reserved chrome lane, not a measured ad-content lane.
        // Ad SDKs can resize asynchronously; feeding that measured height into boardScale
        // was the class of bug where the board suddenly rendered too small. Keep only
        // stable banner reserve + native safe-bottom here.
        const nextFooter = getStableGameFooterReservePx(nativeSafeBottomPx);
        root.style.setProperty('--bottom-ad-height', `${Math.max(0, Math.round(nextFooter))}px`);
        root.style.setProperty('--bottom-chrome-height', `${Math.max(0, Math.round(nextFooter))}px`);
        const isHeaderStable = Math.abs(prev.header - nextHeader) <= 0.5;
        const isFooterStable = Math.abs(prev.footer - nextFooter) <= 0.5;
        if (isHeaderStable && isFooterStable) return prev;
        return { header: nextHeader, footer: nextFooter };
      });
    };

    // 즉시 1회 측정 + 지연 재측정으로 DOM 렌더링 완료 후 정확한 값 보장
    // (메뉴→게임 전환 시 조건부 배너가 아직 마운트 전일 수 있음)
    updateChromeHeights();
    const stabilizationTimerIds: number[] = [];
    VIEWPORT_RECOVERY_DELAYS_MS.forEach((delayMs) => {
      stabilizationTimerIds.push(window.setTimeout(updateChromeHeights, delayMs));
    });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateChromeHeights);
      if (headerRef.current) observer.observe(headerRef.current);
    }

    const scheduleChromeSync = () => {
      updateChromeHeights();
      VIEWPORT_RECOVERY_DELAYS_MS.forEach((delayMs) => {
        window.setTimeout(updateChromeHeights, delayMs);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleChromeSync();
    };

    window.addEventListener('resize', updateChromeHeights);
    window.addEventListener(APP_RESUME_EVENT, scheduleChromeSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.visualViewport?.addEventListener('resize', updateChromeHeights);
    window.visualViewport?.addEventListener('scroll', updateChromeHeights);

    return () => {
      stabilizationTimerIds.forEach((id) => window.clearTimeout(id));
      observer?.disconnect();
      window.removeEventListener('resize', updateChromeHeights);
      window.removeEventListener(APP_RESUME_EVENT, scheduleChromeSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.visualViewport?.removeEventListener('resize', updateChromeHeights);
      window.visualViewport?.removeEventListener('scroll', updateChromeHeights);
      const root = document.documentElement;
      root.style.removeProperty('--bottom-ad-height');
      root.style.removeProperty('--bottom-chrome-height');
    };
  }, [shouldTrackGameChrome, isNative, isWin98ThemeActive]);

  // --- Initialization ---

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getCurrentRoute() === '/admin-analytics') return;
    trackLegacyInstallDetectedOnce();
    trackAppLaunchOnce();
    startHeartbeat();

    const handleSessionEnd = () => {
      trackSessionEndOnce();
    };

    window.addEventListener('pagehide', handleSessionEnd);
    window.addEventListener('beforeunload', handleSessionEnd);

    return () => {
      stopHeartbeat();
      window.removeEventListener('pagehide', handleSessionEnd);
      window.removeEventListener('beforeunload', handleSessionEnd);
    };
  }, []);

  // 라우팅 설정
  useEffect(() => {
    // 초기 라우트 메타데이터 설정
    updatePageMeta(currentRoute);

    // 라우트 변경 리스너 등록
    const unsubscribe = onRouteChange((route) => {
      setCurrentRoute(route);
      updatePageMeta(route);
      // 정적 페이지로 이동 시 스크롤 최상단으로
      if (route !== '/') {
        window.scrollTo(0, 0);
      }
    });

    return unsubscribe;
  }, []);

  // ===== 주간 이벤트 타이머 관리 =====

  /** 이벤트 타이머 시작 (게임 플레이 중에만 진행) */
  const startEventTimer = useCallback(() => {
    if (eventTimerStartedAtRef.current !== null) return; // 이미 실행 중
    eventTimerStartedAtRef.current = Date.now();
    // 1초마다 표시 갱신
    if (eventTimerIntervalRef.current) clearInterval(eventTimerIntervalRef.current);
    eventTimerIntervalRef.current = setInterval(() => {
      const rule = eventRuleRef.current;
      if (!rule || eventTimerStartedAtRef.current === null) return;
      const elapsed = Date.now() - eventTimerStartedAtRef.current;
      const totalPlayed = eventPlayedMsRef.current + elapsed;
      const remaining = getEventTimerRemainingMs(rule.timeLimitSeconds, totalPlayed);
      setEventTimerDisplay(formatTimerMmSs(remaining));
      // 타이머 만료 → 게임오버
      if (remaining <= 0) {
        eventPlayedMsRef.current = totalPlayed;
        eventTimerStartedAtRef.current = null;
        if (eventTimerIntervalRef.current) {
          clearInterval(eventTimerIntervalRef.current);
          eventTimerIntervalRef.current = null;
        }
        // 강제 게임오버
        setGameState(GameState.GAME_OVER);
        gameEventBus.emit('GAME_OVER', {
          score: scoreRef.current,
          mode: 'weekly_event',
          boardSize: boardSizeRef.current,
          moves: moveCountRef.current,
          duration: Math.floor(totalPlayed / 1000),
        });
      }
    }, 1000);
  }, []);

  /** 이벤트 타이머 일시정지 */
  const pauseEventTimer = useCallback(() => {
    if (eventTimerStartedAtRef.current !== null) {
      const elapsed = Date.now() - eventTimerStartedAtRef.current;
      eventPlayedMsRef.current += elapsed;
      eventTimerStartedAtRef.current = null;
    }
    if (eventTimerIntervalRef.current) {
      clearInterval(eventTimerIntervalRef.current);
      eventTimerIntervalRef.current = null;
    }
  }, []);

  /** 이벤트 타이머 리셋 */
  const resetEventTimer = useCallback(() => {
    pauseEventTimer();
    eventPlayedMsRef.current = 0;
    setEventTimerDisplay(null);
    eventRuleRef.current = null;
    eventIdRef.current = null;
    eventAttemptNumberRef.current = 1;
  }, [pauseEventTimer]);

  /** 현재 이벤트 누적 플레이 시간(ms) 정확 계산 */
  const getCurrentEventPlayedMs = useCallback((): number => {
    const base = eventPlayedMsRef.current;
    if (eventTimerStartedAtRef.current !== null) {
      return base + (Date.now() - eventTimerStartedAtRef.current);
    }
    return base;
  }, []);

  /**
   * 이벤트 타이머를 현재 gameState/visibility에 맞게 재개 또는 일시정지.
   * eventRuleRef가 null이면 weekly_event 모드가 아니므로 항상 일시정지.
   */
  const syncEventTimer = useCallback(() => {
    const shouldRun =
      gameStateRef.current === GameState.PLAYING &&
      eventRuleRef.current !== null &&
      isDocumentVisible();
    if (shouldRun) {
      startEventTimer();
    } else {
      pauseEventTimer();
    }
  }, [startEventTimer, pauseEventTimer]);

  useEffect(() => {
    syncActivePlayTimer();
    syncEventTimer();
  }, [gameState, showFirstSkinRewardModal, syncActivePlayTimer, syncEventTimer]);

  const restoreSavedGame = useCallback((saved: SavedGameState) => {
    // maxScoreThisRun: 저장값과 현재 score 중 큰 값으로 복원
    const restoredMaxScore = typeof saved.maxScoreThisRun === 'number' && Number.isFinite(saved.maxScoreThisRun)
      ? Math.max(0, Math.floor(saved.maxScoreThisRun), saved.score)
      : Math.max(0, saved.score);
    const restoredMaxComboMultiplier = typeof saved.maxComboMultiplier === 'number' && Number.isFinite(saved.maxComboMultiplier)
      ? Math.max(1.0, Math.min(3.0, saved.maxComboMultiplier))
      : 1.0;
    const restoredMaxComboCount = typeof saved.maxComboCount === 'number' && Number.isFinite(saved.maxComboCount)
      ? Math.max(0, Math.floor(saved.maxComboCount))
      : 0;

    const restoredObstacleState = cloneObstacleState(saved.obstacleState ?? createEmptyObstacleState());
    const restoredObstacleStage = getObstacleStage({
      score: saved.score,
      maxTile: getMaxTileValue(saved.grid),
    });
    const savedUnlockedObstacleFeatures = [...(saved.unlockedObstacleFeatures ?? [])];
    const legacyObstacleUnlocks = (saved.gameMode ?? 'normal') === 'normal' && saved.obstacleRulesVersion !== OBSTACLE_RULES_VERSION
      ? getUnlockedObstacleFeatures(restoredObstacleStage).filter((feature) => !savedUnlockedObstacleFeatures.includes(feature))
      : [];
    if (legacyObstacleUnlocks.length > 0) {
      restoredObstacleState.spawnMissStreak = Math.max(restoredObstacleState.spawnMissStreak, Math.min(restoredObstacleStage, 8));
    }
    const restoredUnlockedObstacleFeatures = [...savedUnlockedObstacleFeatures, ...legacyObstacleUnlocks];
    unlockedObstacleFeaturesRef.current = restoredUnlockedObstacleFeatures;
    pendingObstacleMergedTileIdsRef.current = [];
    if (mergeClearTimeoutRef.current) {
      window.clearTimeout(mergeClearTimeoutRef.current);
      mergeClearTimeoutRef.current = null;
    }
    if (portalReleaseClearTimeoutRef.current) {
      window.clearTimeout(portalReleaseClearTimeoutRef.current);
      portalReleaseClearTimeoutRef.current = null;
    }

    setGameState(saved.gameState);
    setGrid(saved.grid);
    setObstacleState(restoredObstacleState);
    setUnlockedObstacleFeatures(restoredUnlockedObstacleFeatures);
    setObstacleUnlockQueue(legacyObstacleUnlocks);
    setSlots(saved.slots);
    setScore(saved.score);
    maxScoreThisRunRef.current = restoredMaxScore;
    setMaxScoreThisRun(restoredMaxScore);
    setMergingTiles(EMPTY_MERGING_TILES);
    setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    maxComboMultiplierRef.current = restoredMaxComboMultiplier;
    maxComboCountRef.current = restoredMaxComboCount;
    setPhase(saved.phase);
    setBoardSize(saved.boardSize);
    // 구버전 저장 데이터 정규화: 이어하기/자동복원 모두 동일한 규칙 적용.
    setCanSkipSlide(false);
    const restoredSnapshot = saved.lastSnapshot ? cloneGameSnapshot({
      ...saved.lastSnapshot,
      obstacleState: cloneObstacleState(saved.lastSnapshot.obstacleState ?? restoredObstacleState),
      unlockedObstacleFeatures: [
        ...(saved.lastSnapshot.unlockedObstacleFeatures ?? restoredUnlockedObstacleFeatures),
      ],
    }) : null;
    setLastSnapshot(restoredSnapshot);
    setUndoRemaining(saved.undoRemaining);
    setBlockRefreshRemaining(saved.blockRefreshRemaining ?? INITIAL_BLOCK_REFRESH_AMOUNT);
    setShowBlockRefreshAdButton(Boolean(saved.showBlockRefreshAdButton));
    setHasUsedReviveThisRun(Boolean(saved.hasUsedRevive));
    isReviveSelectionModeRef.current = Boolean(saved.isReviveSelectionMode);
    setIsReviveSelectionMode(Boolean(saved.isReviveSelectionMode));
    setReviveBreakRemaining(saved.reviveBreakRemaining ?? 0);
    setRevivePendingTileId(saved.revivePendingTileId ?? null);
    setReviveDestroyEffects([]);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    setIsBlockRefreshAdInProgress(false);
    liveRankFailureCountRef.current = 0;
    liveRankRetryAfterRef.current = 0;
    liveRankLastRequestAtRef.current = 0;
    liveRankRequestInFlightRef.current = false;
    liveRankRequestQueuedRef.current = false;
    setLiveRankEstimate(null);
    setPlayerName(
      getReusablePlayerName(saved.playerName) ??
      getReusablePlayerName(rankingService.getSavedName()) ??
      ''
    );
    setSessionLockedPlayerName(getReusablePlayerName(saved.sessionLockedPlayerName) ?? null);
    sessionIdRef.current = saved.sessionId ?? crypto.randomUUID();
    moveCountRef.current = typeof saved.moveCount === 'number' ? saved.moveCount : 0;
    gameStartTimeRef.current = typeof saved.startedAt === 'number' ? saved.startedAt : saved.savedAt;
    const savedActiveDurationMs = getSavedGameActiveDurationMs(saved);
    // 구버전 데이터 호환: activeDurationMs가 없으면 저장 시점까지 경과 시간으로 보정
    // (PLAYING 브랜치도 이 ref를 기준으로 duration을 계산하므로 anti-cheat 오탐 방지)
    activePlayDurationMsRef.current = savedActiveDurationMs > 0
      ? savedActiveDurationMs
      : Math.max(0, Date.now() - saved.savedAt);
    activePlayStartedAtRef.current =
      saved.gameState === GameState.PLAYING && isDocumentVisible()
        ? Date.now()
        : null;

    // 데일리 챌린지 상태 복원
    setGameMode(saved.gameMode ?? 'normal');
    challengeDateRef.current = saved.challengeDate ?? null;
    challengeSeedRef.current = saved.challengeSeed ?? null;
    challengePieceIndexRef.current = saved.challengePieceIndex ?? 0;

    // 주간 이벤트 상태 복원
    if (saved.gameMode === 'weekly_event' && saved.eventId && saved.eventType) {
      const evRule = EVENT_RULES[saved.eventType as keyof typeof EVENT_RULES];
      if (evRule) {
        eventRuleRef.current = evRule;
        eventIdRef.current = saved.eventId;
        eventAttemptNumberRef.current = saved.eventAttemptNumber ?? 1;
        eventPlayedMsRef.current = saved.eventPlayedMs ?? 0;
        const remaining = getEventTimerRemainingMs(evRule.timeLimitSeconds, eventPlayedMsRef.current);
        setEventTimerDisplay(formatTimerMmSs(remaining));
        if (saved.gameState === GameState.PLAYING) {
          startEventTimer();
        }
      }
    } else {
      resetEventTimer();
    }
  }, [startEventTimer, resetEventTimer]);

  // 앱 시작 시 저장된 게임 확인만 (자동 복원하지 않음)
  // "게임 이어하기" 버튼을 통해 수동 복원 (DailyLaunchModal 또는 메뉴 continue 버튼)
  useEffect(() => {
    // 저장된 게임 데이터는 localStorage에 유지됨
    // restoreSavedGame은 사용자 액션 시에만 호출
  }, []);

  const persistRecoverableGameState = useCallback(() => {
    if (gameState !== GameState.PLAYING && gameState !== GameState.GAME_OVER) return;
    if (gameState !== GameState.PLAYING) {
      pauseActivePlayTimer();
    }

    const activeDurationMs = getCurrentActiveDurationMs();

    // 모드별 독립 세이브 슬롯에 저장
    const commonState = {
      gameState, grid, slots, score, phase, boardSize, canSkipSlide,
      obstacleState,
      unlockedObstacleFeatures,
      obstacleRulesVersion: OBSTACLE_RULES_VERSION,
      undoRemaining, blockRefreshRemaining, showBlockRefreshAdButton,
      lastSnapshot,
      hasUsedRevive: hasUsedReviveThisRun,
      isReviveSelectionMode, reviveBreakRemaining, revivePendingTileId,
      sessionId: sessionIdRef.current,
      moveCount: moveCountRef.current,
      startedAt: gameStartTimeRef.current,
      activeDurationMs, maxScoreThisRun,
      maxComboMultiplier: maxComboMultiplierRef.current,
      maxComboCount: maxComboCountRef.current,
      playerName,
      sessionLockedPlayerName: sessionLockedPlayerName ?? undefined,
      gameMode,
      challengeDate: challengeDateRef.current ?? undefined,
      challengeSeed: challengeSeedRef.current ?? undefined,
      challengePieceIndex: challengePieceIndexRef.current,
      eventId: eventIdRef.current ?? undefined,
      eventType: eventRuleRef.current?.type ?? undefined,
      eventAttemptNumber: eventAttemptNumberRef.current,
      eventPlayedMs: getCurrentEventPlayedMs(),
    };

    if (gameMode === 'daily_challenge') {
      saveDailyChallengeState(commonState);
    } else if (gameMode === 'weekly_event' && eventIdRef.current && eventRuleRef.current) {
      if (gameState === GameState.PLAYING) {
        saveEventGameState({
          eventId: eventIdRef.current,
          eventType: eventRuleRef.current.type,
          grid, slots, score, phase, boardSize,
          moveCount: moveCountRef.current,
          maxComboMultiplier: maxComboMultiplierRef.current,
          maxComboCount: maxComboCountRef.current,
          eventPlayedMs: getCurrentEventPlayedMs(),
          attemptNumber: eventAttemptNumberRef.current,
          sessionId: sessionIdRef.current,
          playerName,
          sessionLockedPlayerName: sessionLockedPlayerName ?? undefined,
          startedAt: gameStartTimeRef.current ?? Date.now(),
          savedAt: Date.now(),
        });
      } else {
        // GAME_OVER는 이어하기 대상이 아니므로 이벤트 전용 슬롯을 정리한다.
        clearEventGameState();
      }
    } else {
      saveGameState(commonState);
    }
  }, [
    gameState,
    grid,
    slots,
    score,
    phase,
    boardSize,
    canSkipSlide,
    obstacleState,
    unlockedObstacleFeatures,
    undoRemaining,
    blockRefreshRemaining,
    showBlockRefreshAdButton,
    lastSnapshot,
    hasUsedReviveThisRun,
    isReviveSelectionMode,
    reviveBreakRemaining,
    revivePendingTileId,
    maxScoreThisRun,
    playerName,
    sessionLockedPlayerName,
    gameMode,
    pauseActivePlayTimer,
    getCurrentActiveDurationMs,
    getCurrentEventPlayedMs,
  ]);

  // 게임 상태 자동 저장 (debounce + 종료 직전 플러시)
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      // 500ms debounce로 과도한 localStorage 저장 방지
      const saveTimer = setTimeout(() => {
        persistRecoverableGameState();
      }, 500);

      return () => clearTimeout(saveTimer);
    }

    if (gameState === GameState.GAME_OVER) {
      // 게임오버 즉시 저장: 앱 종료/업데이트 후에도 랭킹 등록을 이어갈 수 있어야 한다.
      persistRecoverableGameState();
    }
  }, [gameState, persistRecoverableGameState]);

  useEffect(() => {
    const flushRecoverableState = () => {
      pauseActivePlayTimer();
      pauseEventTimer();
      persistRecoverableGameState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushRecoverableState();
        return;
      }
      syncActivePlayTimer();
      syncEventTimer();
    };

    window.addEventListener('pagehide', flushRecoverableState);
    window.addEventListener('beforeunload', flushRecoverableState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushRecoverableState);
      window.removeEventListener('beforeunload', flushRecoverableState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistRecoverableGameState, pauseActivePlayTimer, syncActivePlayTimer, syncEventTimer]);

  useEffect(() => {
    const shouldLockScroll = currentRoute === '/' && gameState !== GameState.MENU;
    document.body.classList.toggle('scroll-locked', shouldLockScroll);
    if (shouldLockScroll) {
      window.scrollTo(0, 0);
    }
    return () => {
      document.body.classList.remove('scroll-locked');
    };
  }, [currentRoute, gameState]);

  // 메인 화면으로 돌아가기 (게임 상태 유지)
  const goToMenu = useCallback(() => {
    // 현재 게임 상태는 이미 자동 저장되어 있으므로 메뉴로만 이동
    setGameState(GameState.MENU);
    // 드래그 상태 정리
    setDraggingPiece(null);
    setDragOriginIndex(-1);
    boardMetricsRef.current = null;
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const goToMenuWithHomeFlush = useCallback(() => {
    let moved = false;
    const moveToMenu = () => {
      if (moved) return;
      moved = true;
      goToMenu();
    };

    const timeoutId = window.setTimeout(moveToMenu, HOME_NAV_FLUSH_TIMEOUT_MS);
    void submitAutoRankProgressRef.current(true)
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.warn('[AutoRank] home flush failed', error);
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        moveToMenu();
      });
  }, [goToMenu]);

  const buildActiveGameRankingSnapshot = useCallback((): ActiveGameRankingSnapshot | null => {
    if (gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) {
      // 이벤트 모드는 이벤트 전용 타이머 사용
      const elapsedSeconds = gameModeRef.current === 'weekly_event'
        ? toDurationSeconds(getCurrentEventPlayedMs())
        : getCurrentActiveDurationSeconds();
      return {
        sessionId: sessionIdRef.current,
        score,
        difficulty: `${boardSize}x${boardSize}`,
        boardSize,
        duration: elapsedSeconds,
        moves: moveCountRef.current,
        playerName,
        sessionLockedPlayerName,
      };
    }

    const saved = loadGameState();
    if (!saved) return null;
    const savedDurationMs = getSavedGameActiveDurationMs(saved);
    // 구버전 데이터 호환: activeDurationMs가 없어 0이 반환된 경우,
    // 저장 시점 이후 경과 시간을 보정값으로 추가해 anti-cheat 오탐을 방지한다.
    const correctedMs = savedDurationMs > 0
      ? savedDurationMs
      : Math.max(0, Date.now() - saved.savedAt);
    const elapsedSeconds = toDurationSeconds(correctedMs);

    return {
      sessionId: saved.sessionId ?? sessionIdRef.current,
      score: saved.score,
      difficulty: `${saved.boardSize}x${saved.boardSize}`,
      boardSize: saved.boardSize as BoardSize,
      duration: elapsedSeconds,
      moves: typeof saved.moveCount === 'number' ? saved.moveCount : 0,
      playerName: saved.playerName ?? playerName,
      sessionLockedPlayerName: getReusablePlayerName(saved.sessionLockedPlayerName) ?? sessionLockedPlayerName,
    };
  }, [gameState, score, boardSize, playerName, sessionLockedPlayerName, getCurrentActiveDurationSeconds, getCurrentEventPlayedMs]);

  const startGameWithSessionNamePrompt = useCallback((size: BoardSize) => {
    requestSessionNameForNormalStart(size);
  }, [requestSessionNameForNormalStart]);

  const openActiveGameExitModal = useCallback((context: ActiveGameExitContext, nextDifficulty?: BoardSize) => {
    const snapshot = buildActiveGameRankingSnapshot();
    if (!snapshot) {
      if (context === 'HOME') {
        goToMenuWithHomeFlush();
        return;
      }
      if (typeof nextDifficulty === 'number') {
        startGameWithSessionNamePrompt(nextDifficulty as BoardSize);
      }
      return;
    }

    if (typeof nextDifficulty === 'number') {
      setPendingDifficulty(nextDifficulty);
    }
    setActiveGameExitContext(context);
    setActiveGameRankingSnapshot(snapshot);
    openActiveGameExitDialog();
  }, [buildActiveGameRankingSnapshot, goToMenuWithHomeFlush, openActiveGameExitDialog, startGameWithSessionNamePrompt]);

  const handleGameOverClose = useCallback(() => {
    // 게임오버 결과 확인을 마치고 메뉴로 돌아갈 때 해당 모드의 복구 상태만 정리한다.
    if (gameMode === 'daily_challenge') {
      clearDailyChallengeState();
    } else if (gameMode === 'weekly_event') {
      clearEventGameState();
    } else {
      clearGameState();
    }
    reviveDestroyEffectTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    reviveDestroyEffectTimeoutsRef.current = [];
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setReviveBreakRemaining(0);
    setRevivePendingTileId(null);
    setReviveDestroyEffects([]);
    // 이벤트 / 챌린지 모드 초기화
    resetEventTimer();
    setGameMode('normal');
    challengeDateRef.current = null;
    challengeSeedRef.current = null;
    challengePieceIndexRef.current = 0;
    // 복기 모드 정리
    setIsReviewMode(false);
    setReviewIndex(0);
    setSnapshotHistory([]);
    setGameOverReason(null);
    resetComboState();
    maxComboMultiplierRef.current = 1.0;
    maxComboCountRef.current = 0;
    setGameState(GameState.MENU);
  }, [gameMode, resetEventTimer, resetComboState]);

  // 게임오버 후 이벤트 랭킹 바로 보기 (weekly_event 전용)
  const handleGameOverViewRankings = useCallback(() => {
    handleGameOverClose();
    // handleGameOverClose는 setGameState(GameState.MENU)를 호출하므로
    // 상태 업데이트 batching으로 동일 틱에서 모달을 열어도 안전하다.
    openWeeklyEventModal();
  }, [handleGameOverClose, openWeeklyEventModal]);

  // 복기 모드 진입
  const handleEnterReviewMode = useCallback(() => {
    if (snapshotHistory.length === 0) return;
    setIsReviewMode(true);
    setReviewIndex(snapshotHistory.length - 1); // 마지막 스냅샷부터 시작
  }, [snapshotHistory.length]);

  // 복기 모드 종료
  const handleExitReviewMode = useCallback(() => {
    setIsReviewMode(false);
    setReviewIndex(0);
  }, []);

  // 복기 모드에서 홈으로 가기
  const handleReviewGoHome = useCallback(() => {
    setIsReviewMode(false);
    setReviewIndex(0);
    setSnapshotHistory([]);
    handleGameOverClose();
  }, [handleGameOverClose]);

  // 복기 모드에서 랭킹 보기
  const handleReviewOpenRankings = useCallback(() => {
    setIsReviewMode(false);
    setReviewIndex(0);
    handleGameOverClose();
    openLeaderboardModal();
  }, [handleGameOverClose, openLeaderboardModal]);

  const handleHomeButtonClick = useCallback(() => {
    if (gameState === GameState.PLAYING) {
      openActiveGameExitModal('HOME');
      return;
    }
    goToMenuWithHomeFlush();
  }, [gameState, goToMenuWithHomeFlush, openActiveGameExitModal]);

  const handleActiveGameExitCancel = useCallback(() => {
    if (activeGameExitContext === 'NEW_GAME') {
      setPendingDifficulty(null);
      setPendingSessionMode(null);
    }
    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);
  }, [activeGameExitContext]);

  const closeTopOverlay = useCallback((): boolean => {
    if (isActiveGameExitModalOpen) {
      handleActiveGameExitCancel();
      return true;
    }
    if (showFirstSkinRewardModal) {
      setShowFirstSkinRewardModal(false);
      return true;
    }
    if (activeOnboardingStep === 'menu-skin-feature') {
      handleSkinFeatureTutorialSkip();
      return true;
    }
    if (activeOnboardingStep === 'menu-game-mode') {
      setActiveOnboardingStep('none');
      return true;
    }
    if (isSeqOnboardingVisible && activeOnboardingStep === 'none') {
      setIsSeqOnboardingVisible(false);
      return true;
    }
    if (isNameInputOpen) {
      closeNameInputModal();
      return true;
    }
    if (showHelpModal) {
      setShowHelpModal(false);
      return true;
    }
    if (isWeeklyEventModalOpen) {
      setIsWeeklyEventModalOpen(false);
      return true;
    }
    if (isCalendarOpen) {
      setIsCalendarOpen(false);
      return true;
    }
    if (isXpModalOpen) {
      setIsXpModalOpen(false);
      return true;
    }
    if (isMissionModalOpen) {
      setIsMissionModalOpen(false);
      return true;
    }
    if (isSeasonRewardOpen) {
      setIsSeasonRewardOpen(false);
      return true;
    }
    if (isStreakInfoOpen) {
      setIsStreakInfoOpen(false);
      return true;
    }
    if (isLeaderboardOpen) {
      setIsLeaderboardOpen(false);
      return true;
    }
    if (isSkinOpen) {
      setIsSkinOpen(false);
      return true;
    }
    if (isCustomizationOpen) {
      setIsCustomizationOpen(false);
      return true;
    }
    return false;
  }, [
    activeOnboardingStep,
    closeNameInputModal,
    handleActiveGameExitCancel,
    handleSkinFeatureTutorialSkip,
    isActiveGameExitModalOpen,
    isCalendarOpen,
    isCustomizationOpen,
    isLeaderboardOpen,
    isMissionModalOpen,
    isNameInputOpen,
    isSeqOnboardingVisible,
    isSeasonRewardOpen,
    isSkinOpen,
    isStreakInfoOpen,
    isWeeklyEventModalOpen,
    isXpModalOpen,
    showFirstSkinRewardModal,
    showHelpModal,
  ]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      closeTopOverlay();
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [closeTopOverlay]);

  const handleNativeBackButton = useCallback((fallback?: () => void) => {
    if (nativeUpdateRequirement) return;

    if (closeTopOverlay()) return;

    if (currentRoute !== '/') {
      navigateTo('/');
      return;
    }

    if (gameState === GameState.PLAYING) {
      handleHomeButtonClick();
      return;
    }

    if (gameState === GameState.GAME_OVER) {
      if (isReviewMode) {
        handleExitReviewMode();
        return;
      }
      handleGameOverClose();
      return;
    }

    fallback?.();
  }, [
    closeTopOverlay,
    currentRoute,
    gameState,
    handleExitReviewMode,
    handleGameOverClose,
    handleHomeButtonClick,
    isReviewMode,
    nativeUpdateRequirement,
  ]);

  const nativeBackButtonHandlerRef = useRef(handleNativeBackButton);

  useEffect(() => {
    nativeBackButtonHandlerRef.current = handleNativeBackButton;
  }, [handleNativeBackButton]);

  useEffect(() => {
    if (!isAndroidApp()) return;

    let isDisposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    void import('@capacitor/app').then(({ App: CapacitorApp }) => {
      if (isDisposed) return;
      CapacitorApp.addListener('backButton', () => {
        nativeBackButtonHandlerRef.current(() => {
          void CapacitorApp.minimizeApp();
        });
      }).then((handle) => {
        if (isDisposed) {
          void handle.remove();
          return;
        }
        listenerHandle = handle;
      }).catch(() => {
        // ignore
      });
    }).catch(() => {
      // ignore — web environment
    });

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, []);

  const handleActiveGameExitProceedWithoutRegister = useCallback(() => {
    const context = activeGameExitContext;

    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);

    if (context === 'HOME') {
      goToMenuWithHomeFlush();
      return;
    }

    if (typeof pendingDifficulty === 'number') {
      startGameWithSessionNamePrompt(pendingDifficulty as BoardSize);
    }
  }, [activeGameExitContext, goToMenuWithHomeFlush, pendingDifficulty, startGameWithSessionNamePrompt]);

  const handleActiveGameExitNameLocked = useCallback((name: string) => {
    setSessionLockedPlayerName(name);
    setPlayerName(name);
    rankingService.saveName(name);
  }, []);

  const handleActiveGameExitRegisteredAndProceed = useCallback(() => {
    const context = activeGameExitContext;
    const modeToClear: GameMode = context === 'NEW_GAME' ? 'normal' : gameMode;
    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);
    if (modeToClear === 'daily_challenge') {
      clearDailyChallengeState();
    } else if (modeToClear === 'weekly_event') {
      clearEventGameState();
    } else {
      clearGameState();
    }

    if (context === 'HOME') {
      goToMenuWithHomeFlush();
      return;
    }

    if (typeof pendingDifficulty === 'number') {
      startGameWithSessionNamePrompt(pendingDifficulty as BoardSize);
    }
  }, [activeGameExitContext, gameMode, goToMenuWithHomeFlush, pendingDifficulty, startGameWithSessionNamePrompt]);

  // 난이도 선택 시 진행중 게임 경고 -> 이름 입력 모달
  const tryStartGame = useCallback((size: BoardSize) => {
    const activeSize = getActiveNormalGameBoardSize();
    const active = activeSize !== null && (gameState === GameState.MENU || boardSize !== size);
    if (active) {
      openActiveGameExitModal('NEW_GAME', size);
      return;
    }

    startGameWithSessionNamePrompt(size);
  }, [gameState, boardSize, openActiveGameExitModal, startGameWithSessionNamePrompt]);

  const handleNameSubmit = (name: string) => {
    if (pendingSessionMode === 'normal' && typeof pendingDifficulty === 'number') {
      setPlayerName(name);
      setSessionLockedPlayerName(name);
      rankingService.saveName(name);
      startGame(pendingDifficulty as BoardSize, name);
      closeNameInputModal();
      return;
    }

    if (pendingSessionMode === 'weekly_event') {
      setPlayerName(name);
      setSessionLockedPlayerName(name);
      rankingService.saveName(name);
      startWeeklyEvent(name);
      closeNameInputModal();
    }
  };

  function startGame(size: BoardSize, sessionName?: string) {
    markEverPlayed();
    // 새 게임 시작 시 이전 게임 복구 데이터는 폐기한다.
    clearGameState();
    // 일반 모드로 리셋
    setGameMode('normal');
    challengeDateRef.current = null;
    challengeSeedRef.current = null;
    challengePieceIndexRef.current = 0;
    // 이벤트 상태 리셋
    resetEventTimer();

    if (mergeClearTimeoutRef.current) {
      window.clearTimeout(mergeClearTimeoutRef.current);
      mergeClearTimeoutRef.current = null;
    }
    if (portalReleaseClearTimeoutRef.current) {
      window.clearTimeout(portalReleaseClearTimeoutRef.current);
      portalReleaseClearTimeoutRef.current = null;
    }
    if (mergeFinalizeTimeoutRef.current) {
      window.clearTimeout(mergeFinalizeTimeoutRef.current);
      mergeFinalizeTimeoutRef.current = null;
    }
    if (mergedNumberBurstClearTimeoutRef.current) {
      window.clearTimeout(mergedNumberBurstClearTimeoutRef.current);
      mergedNumberBurstClearTimeoutRef.current = null;
    }
    if (unlockTimeoutRef.current) {
      window.clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }
    reviveDestroyEffectTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    reviveDestroyEffectTimeoutsRef.current = [];

    setBoardSize(size);
    setGrid(createEmptyGrid(size));
    setObstacleState(createEmptyObstacleState());
    pendingObstacleMergedTileIdsRef.current = [];
    setUnlockedObstacleFeatures([]);
    setObstacleUnlockQueue([]);
    setSlots([generateRandomPiece(), generateRandomPiece(), generateRandomPiece()]);
    setScore(0);
    maxScoreThisRunRef.current = 0;
    setMaxScoreThisRun(0);
    setMergingTiles(EMPTY_MERGING_TILES);
    setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
    setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
    slideLockRef.current = false;
    setIsAnimating(false);
    setPhase(Phase.PLACE);
    setGameState(GameState.PLAYING);
    clearComboMessageQueue();
    resetComboState();
    maxComboMultiplierRef.current = 1.0;
    maxComboCountRef.current = 0;
    setCanSkipSlide(false);
    // Undo 초기화
    setLastSnapshot(null);
    setUndoRemaining(INITIAL_UNDO_AMOUNT);
    setBlockRefreshRemaining(INITIAL_BLOCK_REFRESH_AMOUNT);
    // 복기 모드 초기화
    setIsReviewMode(false);
    setReviewIndex(0);
    setSnapshotHistory([]);
    setShowBlockRefreshAdButton(false);
    setHasUsedReviveThisRun(false);
    rewarded1024CountRef.current = 0;
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setReviveBreakRemaining(0);
    setRevivePendingTileId(null);
    setReviveDestroyEffects([]);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    setIsBlockRefreshAdInProgress(false);
    const normalizedSessionName = getReusablePlayerName(sessionName) ?? null;
    setSessionLockedPlayerName(normalizedSessionName);
    if (normalizedSessionName) {
      setPlayerName(normalizedSessionName);
    }
    // 출석 토스트 ref 초기화 (게임마다 새로)
    attendanceToastShownRef.current = false;
    attendanceHintShownRef.current = false;

    // Anti-cheat: Start Timer & Session ID
    const now = Date.now();
    gameStartTimeRef.current = now;
    activePlayDurationMsRef.current = 0;
    activePlayStartedAtRef.current = isDocumentVisible() ? now : null;
    moveCountRef.current = 0;
    sessionIdRef.current = crypto.randomUUID(); // 새 게임마다 고유 세션 ID 생성
    liveRankFailureCountRef.current = 0;
    liveRankRetryAfterRef.current = 0;
    liveRankLastRequestAtRef.current = 0;
    liveRankRequestInFlightRef.current = false;
    liveRankRequestQueuedRef.current = false;
    setLiveRankEstimate(null); // 순위 표시 초기화
    trackAnalyticsEvent({
      name: 'game_start',
      meta: {
        boardSize: size,
      },
    });

    // 이벤트 버스: 게임 시작 알림
    gameEventBus.emit('GAME_STARTED', { mode: 'normal', boardSize: size });

    // 온보딩: 튜토리얼 미완료 시 활성화
    setTutorialStep(isEarlyOnboardingCompleted() ? 0 : 1);
  }

  // --- 데일리 챌린지 시작 ---
  async function startDailyChallenge() {
    if (!DAILY_CHALLENGE_ENABLED) {
      showComboMessage(t('game:dailyChallenge.disabled', '오늘의 챌린지는 곧 오픈 예정입니다'), 2500);
      return;
    }
    if (isDailyChallengeLoading) return;
    // 진행 중인 데일리 챌린지가 있으면 덮어쓰기 방지 — 자동으로 이어하기
    if (hasActiveDailyChallenge()) {
      const saved = loadDailyChallengeState();
      if (saved) { restoreSavedGame(saved); return; }
    }
    setIsDailyChallengeLoading(true);
    try {
      const seed = await fetchDailyChallengeSeed();
      if (!seed) {
        // 서버 연결 실패 시 사용자에게 알림
        showComboMessage(t('game:dailyChallenge.fetchFailed', '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.'), 3000);
        setIsDailyChallengeLoading(false);
        return;
      }

      // 데일리 챌린지 세이브만 정리 (일반/이벤트 세이브 보존)
      clearDailyChallengeState();
      resetEventTimer();
      if (mergeClearTimeoutRef.current) { window.clearTimeout(mergeClearTimeoutRef.current); mergeClearTimeoutRef.current = null; }
      if (portalReleaseClearTimeoutRef.current) { window.clearTimeout(portalReleaseClearTimeoutRef.current); portalReleaseClearTimeoutRef.current = null; }
      if (mergeFinalizeTimeoutRef.current) { window.clearTimeout(mergeFinalizeTimeoutRef.current); mergeFinalizeTimeoutRef.current = null; }
      if (mergedNumberBurstClearTimeoutRef.current) { window.clearTimeout(mergedNumberBurstClearTimeoutRef.current); mergedNumberBurstClearTimeoutRef.current = null; }
      if (unlockTimeoutRef.current) { window.clearTimeout(unlockTimeoutRef.current); unlockTimeoutRef.current = null; }
      if (comboMessageTimeoutRef.current) { window.clearTimeout(comboMessageTimeoutRef.current); comboMessageTimeoutRef.current = null; }
      reviveDestroyEffectTimeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
      reviveDestroyEffectTimeoutsRef.current = [];

      const challengeSize: BoardSize = 5;
      const initialSlots = generateChallengeSlots(seed.seed, 0, 3);

      // 챌린지 상태 설정
      setGameMode('daily_challenge');
      challengeDateRef.current = seed.challengeDate;
      challengeSeedRef.current = seed.seed;
      challengePieceIndexRef.current = 3; // 이미 3개 사용

      setBoardSize(challengeSize);
      setGrid(createEmptyGrid(challengeSize));
      setObstacleState(createEmptyObstacleState());
      pendingObstacleMergedTileIdsRef.current = [];
      setUnlockedObstacleFeatures([]);
      setObstacleUnlockQueue([]);
      setSlots(initialSlots);
      setScore(0);
      maxScoreThisRunRef.current = 0;
      setMaxScoreThisRun(0);
      setMergingTiles(EMPTY_MERGING_TILES);
      setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
      setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
      setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
      setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
      slideLockRef.current = false;
      setIsAnimating(false);
      setPhase(Phase.PLACE);
      setGameState(GameState.PLAYING);
      clearComboMessageQueue();
      resetComboState();
      maxComboMultiplierRef.current = 1.0;
      maxComboCountRef.current = 0;
      setCanSkipSlide(false);
      setLastSnapshot(null);
      // 복기 모드 초기화
      setIsReviewMode(false);
      setReviewIndex(0);
      setSnapshotHistory([]);
      // 챌린지 모드: undo/blockRefresh/revive 비활성화
      setUndoRemaining(0);
      setBlockRefreshRemaining(0);
      setShowBlockRefreshAdButton(false);
      setHasUsedReviveThisRun(true); // revive 불가
      isReviveSelectionModeRef.current = false;
      setIsReviveSelectionMode(false);
      setReviveBreakRemaining(0);
      setRevivePendingTileId(null);
      setReviveDestroyEffects([]);
      setIsReviveAdInProgress(false);
      setIsReviveAdReady(false);
      setIsBlockRefreshAdInProgress(false);
      setSessionLockedPlayerName(null);
      attendanceToastShownRef.current = false;
      attendanceHintShownRef.current = false;

      // Anti-cheat
      const now = Date.now();
      gameStartTimeRef.current = now;
      activePlayDurationMsRef.current = 0;
      activePlayStartedAtRef.current = isDocumentVisible() ? now : null;
      moveCountRef.current = 0;
      sessionIdRef.current = crypto.randomUUID();
      liveRankFailureCountRef.current = 0;
      liveRankRetryAfterRef.current = 0;
      liveRankLastRequestAtRef.current = 0;
      liveRankRequestInFlightRef.current = false;
      liveRankRequestQueuedRef.current = false;
      setLiveRankEstimate(null);
      setTutorialStep(0); // 챌린지에서는 튜토리얼 비노출

      trackAnalyticsEvent({
        name: 'game_start',
        meta: { boardSize: challengeSize, gameMode: 'daily_challenge' },
      });

      // 이벤트 버스: 데일리 챌린지 시작
      gameEventBus.emit('GAME_STARTED', { mode: 'daily_challenge', boardSize: challengeSize });
    } catch (e) {
      console.error('[DailyChallenge] start failed:', e);
    } finally {
      setIsDailyChallengeLoading(false);
    }
  }

  // --- 주간 이벤트 시작 ---

  function startWeeklyEvent(sessionName?: string) {
    markEverPlayed();
    const current = getCurrentEvent();
    const rule = current.rule;
    const localAttempts = getLocalAttemptCount();
    const adBonusUnlocked = isEventAttemptAdBonusUnlocked();
    if (!canStartWeeklyEventAttempt(localAttempts, adBonusUnlocked)) return;

    // 이벤트 세이브만 정리 (일반/챌린지 세이브 보존)
    clearEventGameState();
    if (mergeClearTimeoutRef.current) { window.clearTimeout(mergeClearTimeoutRef.current); mergeClearTimeoutRef.current = null; }
    if (portalReleaseClearTimeoutRef.current) { window.clearTimeout(portalReleaseClearTimeoutRef.current); portalReleaseClearTimeoutRef.current = null; }
    if (mergeFinalizeTimeoutRef.current) { window.clearTimeout(mergeFinalizeTimeoutRef.current); mergeFinalizeTimeoutRef.current = null; }
    if (mergedNumberBurstClearTimeoutRef.current) { window.clearTimeout(mergedNumberBurstClearTimeoutRef.current); mergedNumberBurstClearTimeoutRef.current = null; }
    if (unlockTimeoutRef.current) { window.clearTimeout(unlockTimeoutRef.current); unlockTimeoutRef.current = null; }
    if (comboMessageTimeoutRef.current) { window.clearTimeout(comboMessageTimeoutRef.current); comboMessageTimeoutRef.current = null; }
    reviveDestroyEffectTimeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
    reviveDestroyEffectTimeoutsRef.current = [];

    const eventSize = rule.boardSize;
    const initialSlots: Piece[] = [
      generateEventPiece(rule),
      generateEventPiece(rule),
      generateEventPiece(rule),
    ];

    setGameMode('weekly_event');
    eventRuleRef.current = rule;
    eventIdRef.current = current.eventId;
    eventAttemptNumberRef.current = localAttempts + 1;
    eventPlayedMsRef.current = 0;
    challengeDateRef.current = null;
    challengeSeedRef.current = null;
    challengePieceIndexRef.current = 0;

    setBoardSize(eventSize);
    setGrid(createEmptyGrid(eventSize));
    setObstacleState(createEmptyObstacleState());
    pendingObstacleMergedTileIdsRef.current = [];
    setUnlockedObstacleFeatures([]);
    setObstacleUnlockQueue([]);
    setSlots(initialSlots);
    setScore(0);
    maxScoreThisRunRef.current = 0;
    setMaxScoreThisRun(0);
    setMergingTiles(EMPTY_MERGING_TILES);
    setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
    setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
    slideLockRef.current = false;
    setIsAnimating(false);
    setPhase(Phase.PLACE);
    setGameState(GameState.PLAYING);
    clearComboMessageQueue();
    resetComboState();
    maxComboMultiplierRef.current = 1.0;
    maxComboCountRef.current = 0;
    setCanSkipSlide(false);
    setLastSnapshot(null);
    // 복기 모드 초기화
    setIsReviewMode(false);
    setReviewIndex(0);
    setSnapshotHistory([]);
    // 이벤트 모드: undo/blockRefresh/revive 비활성화
    setUndoRemaining(rule.disableUndo ? 0 : INITIAL_UNDO_AMOUNT);
    setBlockRefreshRemaining(rule.disableBlockRefresh ? 0 : INITIAL_BLOCK_REFRESH_AMOUNT);
    setShowBlockRefreshAdButton(false);
    setHasUsedReviveThisRun(rule.disableRevive);
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setReviveBreakRemaining(0);
    setRevivePendingTileId(null);
    setReviveDestroyEffects([]);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    setIsBlockRefreshAdInProgress(false);
    const normalizedSessionName = getReusablePlayerName(sessionName) ?? null;
    setSessionLockedPlayerName(normalizedSessionName);
    if (normalizedSessionName) {
      setPlayerName(normalizedSessionName);
    }
    attendanceToastShownRef.current = false;
    attendanceHintShownRef.current = false;

    const now = Date.now();
    gameStartTimeRef.current = now;
    activePlayDurationMsRef.current = 0;
    activePlayStartedAtRef.current = isDocumentVisible() ? now : null;
    moveCountRef.current = 0;
    sessionIdRef.current = crypto.randomUUID();
    liveRankFailureCountRef.current = 0;
    liveRankRetryAfterRef.current = 0;
    liveRankLastRequestAtRef.current = 0;
    liveRankRequestInFlightRef.current = false;
    liveRankRequestQueuedRef.current = false;
    setLiveRankEstimate(null);
    setTutorialStep(0);
    setIsWeeklyEventModalOpen(false);

    // 타이머 시작
    setEventTimerDisplay(formatTimerMmSs(rule.timeLimitSeconds * 1000));
    startEventTimer();

    trackAnalyticsEvent({
      name: 'game_start',
      meta: { boardSize: eventSize, gameMode: 'weekly_event', eventType: current.eventType },
    });
    gameEventBus.emit('GAME_STARTED', { mode: 'weekly_event', boardSize: eventSize });
  }

  function continueWeeklyEvent() {
    markEverPlayed();
    const saved = loadEventGameState();
    if (!saved) return;

    const current = getCurrentEvent();
    const rule = EVENT_RULES[saved.eventType as keyof typeof EVENT_RULES];
    if (!rule) return;

    // 이벤트 이어하기: 다른 모드 세이브는 건드리지 않음
    if (mergeClearTimeoutRef.current) { window.clearTimeout(mergeClearTimeoutRef.current); mergeClearTimeoutRef.current = null; }
    if (portalReleaseClearTimeoutRef.current) { window.clearTimeout(portalReleaseClearTimeoutRef.current); portalReleaseClearTimeoutRef.current = null; }
    if (mergeFinalizeTimeoutRef.current) { window.clearTimeout(mergeFinalizeTimeoutRef.current); mergeFinalizeTimeoutRef.current = null; }
    if (mergedNumberBurstClearTimeoutRef.current) { window.clearTimeout(mergedNumberBurstClearTimeoutRef.current); mergedNumberBurstClearTimeoutRef.current = null; }
    if (unlockTimeoutRef.current) { window.clearTimeout(unlockTimeoutRef.current); unlockTimeoutRef.current = null; }
    if (comboMessageTimeoutRef.current) { window.clearTimeout(comboMessageTimeoutRef.current); comboMessageTimeoutRef.current = null; }
    reviveDestroyEffectTimeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
    reviveDestroyEffectTimeoutsRef.current = [];

    setGameMode('weekly_event');
    eventRuleRef.current = rule;
    eventIdRef.current = saved.eventId;
    eventAttemptNumberRef.current = saved.attemptNumber;
    eventPlayedMsRef.current = saved.eventPlayedMs;
    challengeDateRef.current = null;
    challengeSeedRef.current = null;
    challengePieceIndexRef.current = 0;

    setBoardSize(saved.boardSize);
    setGrid(saved.grid);
    setObstacleState(createEmptyObstacleState());
    pendingObstacleMergedTileIdsRef.current = [];
    setUnlockedObstacleFeatures([]);
    setObstacleUnlockQueue([]);
    setSlots(saved.slots);
    setScore(saved.score);
    maxScoreThisRunRef.current = saved.score;
    setMaxScoreThisRun(saved.score);
    setMergingTiles(EMPTY_MERGING_TILES);
    setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
    setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
    slideLockRef.current = false;
    setIsAnimating(false);
    setPhase(saved.phase as Phase);
    setGameState(GameState.PLAYING);
    clearComboMessageQueue();
    resetComboState();
    maxComboMultiplierRef.current = typeof saved.maxComboMultiplier === 'number' && Number.isFinite(saved.maxComboMultiplier)
      ? Math.max(1.0, Math.min(3.0, saved.maxComboMultiplier))
      : 1.0;
    maxComboCountRef.current = typeof saved.maxComboCount === 'number' && Number.isFinite(saved.maxComboCount)
      ? Math.max(0, Math.floor(saved.maxComboCount))
      : 0;
    setCanSkipSlide(false);
    setLastSnapshot(null);
    // 복기 모드 초기화
    setIsReviewMode(false);
    setReviewIndex(0);
    setSnapshotHistory([]);
    setUndoRemaining(rule.disableUndo ? 0 : INITIAL_UNDO_AMOUNT);
    setBlockRefreshRemaining(rule.disableBlockRefresh ? 0 : INITIAL_BLOCK_REFRESH_AMOUNT);
    setShowBlockRefreshAdButton(false);
    setHasUsedReviveThisRun(rule.disableRevive);
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setReviveBreakRemaining(0);
    setRevivePendingTileId(null);
    setReviveDestroyEffects([]);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    setIsBlockRefreshAdInProgress(false);
    setPlayerName(
      getReusablePlayerName(saved.playerName) ??
      getReusablePlayerName(rankingService.getSavedName()) ??
      ''
    );
    setSessionLockedPlayerName(getReusablePlayerName(saved.sessionLockedPlayerName) ?? null);
    attendanceToastShownRef.current = false;
    attendanceHintShownRef.current = false;

    const now = Date.now();
    gameStartTimeRef.current = saved.startedAt;
    activePlayDurationMsRef.current = 0;
    activePlayStartedAtRef.current = isDocumentVisible() ? now : null;
    moveCountRef.current = saved.moveCount;
    sessionIdRef.current = saved.sessionId;
    liveRankFailureCountRef.current = 0;
    liveRankRetryAfterRef.current = 0;
    liveRankLastRequestAtRef.current = 0;
    liveRankRequestInFlightRef.current = false;
    liveRankRequestQueuedRef.current = false;
    setLiveRankEstimate(null);
    setTutorialStep(0);
    setIsWeeklyEventModalOpen(false);

    // 타이머 이어서 시작
    const remaining = getEventTimerRemainingMs(rule.timeLimitSeconds, saved.eventPlayedMs);
    setEventTimerDisplay(formatTimerMmSs(remaining));
    startEventTimer();

    gameEventBus.emit('GAME_STARTED', { mode: 'weekly_event', boardSize: saved.boardSize });
  }

  // --- Undo 시스템 ---

  // 현재 상태를 스냅샷으로 저장 (행동 실행 전 호출)
  const saveSnapshot = useCallback(() => {
    const snapshot: GameSnapshot = {
      grid: grid.map(row => row.map(tile => tile ? { ...tile } : null)),
      slots: slots.map(p => p ? { ...p, cells: [...p.cells] } : null),
      score,
      phase,
      canSkipSlide,
      obstacleState: cloneObstacleState(obstacleState),
      unlockedObstacleFeatures: [...unlockedObstacleFeatures],
    };
    // Undo용 단일 스냅샷 유지
    setLastSnapshot(snapshot);
    // 복기용 히스토리 배열에 추가 (최대 20개)
    setSnapshotHistory(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_SNAPSHOTS) {
        return next.slice(next.length - MAX_SNAPSHOTS);
      }
      return next;
    });
  }, [grid, slots, score, phase, canSkipSlide, obstacleState, unlockedObstacleFeatures]);

  const clearComboMessageQueue = useCallback(() => {
    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }
    setComboMessageQueue([]);
  }, []);

  const showComboMessage = useCallback((message: string, durationMs = 1600) => {
    const id = comboMessageIdRef.current + 1;
    comboMessageIdRef.current = id;
    setComboMessageQueue((prev) => [...prev, { id, message, durationMs }]);
  }, []);

  const comboMessage = comboMessageQueue[0]?.message ?? null;

  useEffect(() => {
    const activeMessage = comboMessageQueue[0];
    if (!activeMessage) {
      if (comboMessageTimeoutRef.current) {
        window.clearTimeout(comboMessageTimeoutRef.current);
        comboMessageTimeoutRef.current = null;
      }
      return;
    }

    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }

    comboMessageTimeoutRef.current = window.setTimeout(() => {
      setComboMessageQueue((prev) => prev.slice(1));
      comboMessageTimeoutRef.current = null;
    }, activeMessage.durationMs);

    return () => {
      if (comboMessageTimeoutRef.current) {
        window.clearTimeout(comboMessageTimeoutRef.current);
        comboMessageTimeoutRef.current = null;
      }
    };
  }, [comboMessageQueue[0]?.id, comboMessageQueue[0]?.durationMs]);

  // 게임 중 최고 점수 추적 (저장 및 복원용)
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    const normalizedScore = Math.max(0, Math.floor(score));
    const nextMaxScore = Math.max(maxScoreThisRunRef.current, normalizedScore);
    if (nextMaxScore !== maxScoreThisRunRef.current) {
      maxScoreThisRunRef.current = nextMaxScore;
      setMaxScoreThisRun(nextMaxScore);
    }
  }, [gameState, score]);

  // 게임 중 출석 인정 + 힌트 토스트
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    // 출석 힌트: 50점 이상 & 100점 미만일 때 1회 표시
    const remaining = getPointsToAttendance(score);
    if (!attendanceHintShownRef.current && remaining > 0 && remaining <= 50 && !isTodayAttended()) {
      attendanceHintShownRef.current = true;
      showComboMessage(String(t('common:streak.attendanceHint', { points: remaining } as any)), 2500);
    }

    // 출석 인정: 100점 이상 달성 시 1회
    if (!attendanceToastShownRef.current && score >= 100) {
      const result = recordAttendance(score);
      if (result.newlyAttended) {
        attendanceToastShownRef.current = true;
        setStreakCount(result.currentStreak);
        setTodayAttended(true);
        showComboMessage(String(t('common:streak.todayComplete', { count: result.currentStreak } as any)), 3000);

        // 출석 완료 → 스트릭 알림 취소 (재스케줄)
        void rescheduleNotifications({ allowPermissionPrompt: isEarlyOnboardingCompleted() });

        // 출석 XP 지급
        grantXpStreak(result.currentStreak);
        attendanceToastShownRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, score]);

  // ── 최초 50점 돌파 시 무료 스킨 뽑기권 지급 ──
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    if (score < 50) return;
    // 노출 1회 플래그 먼저 확인 (재노출 방지: localStorage/sessionStorage 기반)
    if (isFirstScoreSkinRewardShown()) return;
    // 인메모리 가드로 동일 렌더 내 재진입 방지
    if (firstSkinRewardTriggeredRef.current) return;

    firstSkinRewardTriggeredRef.current = true;
    setShowFirstSkinRewardModal(true);
  }, [gameMode, gameState, score]);


  useEffect(() => {
    if (!showFirstSkinRewardModal) return;
    markScoreOnboardingStepSeen('skin');
    const pendingPersisted = setFirstScoreSkinRewardPending(true);
    if (!pendingPersisted) {
      console.warn('[App] First-score reward pending-state persistence degraded to session-only latch.');
    }
    const shownPersisted = markFirstScoreSkinRewardShown();
    if (!shownPersisted) {
      console.warn('[App] First-score reward shown-state persistence degraded to session-only latch.');
    }
    trackAnalyticsEvent({
      name: 'first_skin_reward_shown',
      meta: { score: scoreRef.current },
    });
  }, [showFirstSkinRewardModal]);

  const handleFirstSkinRewardLater = useCallback(() => {
    trackAnalyticsEvent({ name: 'first_skin_reward_later' });
    setShowFirstSkinRewardModal(false);
  }, []);

  // ── 데일리 첫 실행 모달 핸들러 ──
  const handleDailyLaunchSkinDraw = useCallback(() => {
    setIsDailyLaunchModalOpen(false);
    setSkinModalAutoDraw(true);
    openSkinModal();
  }, [openSkinModal]);

  const handleDailyLaunchContinueGame = useCallback(() => {
    setIsDailyLaunchModalOpen(false);
    setIsSeasonRewardOpen(false);
    // 주간 이벤트 우선, 없으면 일반 게임
    if (hasActiveEventGame()) {
      continueWeeklyEvent();
    } else {
      const saved = loadGameState();
      if (saved) {
        restoreSavedGame(saved);
      }
    }
  }, [continueWeeklyEvent, restoreSavedGame]);

  const handleDailyLaunchMissions = useCallback(() => {
    setIsDailyLaunchModalOpen(false);
    openMissionModal();
  }, [openMissionModal]);

  // ── 순차 온보딩: MENU 상태에서 pending step 확인 ──
  useEffect(() => {
    if (gameState !== GameState.MENU) {
      setIsSeqOnboardingVisible(false);
      return;
    }
    const currentStep = getCurrentSequentialStep();
    if (!currentStep) {
      setIsSeqOnboardingVisible(false);
      setSeqOnboardingStep(null);
      return;
    }
    setSeqOnboardingStep(currentStep);
    setSeqOnboardingIndex(SEQUENTIAL_STEPS.indexOf(currentStep));
    setIsSeqOnboardingVisible(true);
  }, [gameState]);

  const handleSeqOnboardingAdvance = useCallback(() => {
    const nextStep = advanceSequentialStep();
    if (!nextStep) {
      // 완료
      setSeqOnboardingStep(null);
      setIsSeqOnboardingVisible(false);
      return;
    }
    setSeqOnboardingStep(nextStep);
    setSeqOnboardingIndex(SEQUENTIAL_STEPS.indexOf(nextStep));
  }, []);

  /** CTA "지금 열기" 버튼 탭 → 온보딩 advance + 해당 모달 열기 */
  const handleSeqOpenFeature = useCallback((step: SequentialStep) => {
    setIsSeqOnboardingVisible(false);
    setPendingSeqStep(null);
    const nextStep = advanceSequentialStep();
    if (nextStep) {
      setSeqOnboardingStep(nextStep);
      setSeqOnboardingIndex(SEQUENTIAL_STEPS.indexOf(nextStep));
      setPendingSeqStep(nextStep);
    } else {
      setSeqOnboardingStep(null);
    }
    if (step === 'leaderboard') {
      openLeaderboardModal();
    } else if (step === 'daily_activities') {
      openMissionModal();
    } else if (step === 'weekly_event') {
      openWeeklyEventModal();
    }
    // game_resume: 설명만 제공, 별도 모달 없음
  }, [openLeaderboardModal, openMissionModal, openWeeklyEventModal, advanceSequentialStep]);

  /** CTA로 연 모달이 닫히면 다음 온보딩 단계 재개 */
  useEffect(() => {
    const anyCtaModalOpen = isLeaderboardOpen || isMissionModalOpen;
    if (!anyCtaModalOpen && pendingSeqStep && gameState === GameState.MENU) {
      setIsSeqOnboardingVisible(true);
      setPendingSeqStep(null);
    }
  }, [isLeaderboardOpen, isMissionModalOpen, pendingSeqStep, gameState]);

  // ── 최초 50점 돌파 → 무료 스킨 뽑기권 → 게임 저장 + 랭킹 반영 + 스킨탭 이동 ──
  const handleGoToSkinDraw = useCallback(() => {
    trackAnalyticsEvent({ name: 'first_skin_reward_draw_entry' });
    setShowFirstSkinRewardModal(false);
    // 실제 무료 뽑기 소비 성공 시점까지 보상 보류
    setFirstScoreSkinRewardPending(true);

    // 게임 저장
    const commonState: SavedGameState = {
      version: 1,
      gameState: GameState.PLAYING,
      grid,
      slots,
      score,
      phase,
      boardSize,
      canSkipSlide,
      obstacleState,
      unlockedObstacleFeatures,
      obstacleRulesVersion: OBSTACLE_RULES_VERSION,
      undoRemaining,
      blockRefreshRemaining,
      showBlockRefreshAdButton,
      lastSnapshot,
      hasUsedRevive: hasUsedReviveThisRun,
      isReviveSelectionMode,
      reviveBreakRemaining,
      revivePendingTileId,
      moveCount: moveCountRef.current,
      startedAt: gameStartTimeRef.current ?? Date.now(),
      activeDurationMs: getCurrentActiveDurationMs(),
      maxScoreThisRun,
      maxComboMultiplier: maxComboMultiplierRef.current,
      maxComboCount: maxComboCountRef.current,
      sessionId: sessionIdRef.current,
      playerName: playerName || rankingService.getSavedName() || '',
      sessionLockedPlayerName: sessionLockedPlayerName ?? undefined,
      gameMode: 'normal',
      eventPlayedMs: getCurrentEventPlayedMs(),
      savedAt: Date.now(),
    };
    saveGameState(commonState);

    // 랭킹 제출 (조용히 — 실패해도 스킨 뽑기는 진행)
    // rankingService.submitScore는 내부에 오프라인 큐(slidemino_pending_scores_v1)가 있어
    // 네트워크 실패 시 자동 재시도됩니다.
    const activeDuration = getCurrentActiveDurationSeconds();
    const submitScoreSilently = async () => {
      const name = playerName || rankingService.getSavedName() || '익명';
      try {
        await rankingService.submitScore(
          sessionIdRef.current,
          name,
          score,
          `${boardSize}x${boardSize}`,
          activeDuration,
          moveCountRef.current,
          getAnalyticsInstallId(),
          undefined,
          maxComboMultiplierRef.current,
          maxComboCountRef.current
        );
      } catch (e) {
        // 오프라인 큐 실패 시 콘솔 경고 (재시도는 rankingService 내부 처리)
        console.warn('[FirstSkinReward] Score submission failed, queued for retry:', e);
      }
    };
    void submitScoreSilently();

    // 게임 상태 MENU로 전환
    // 무료 스킨 보상 진입/복귀 시 이어하기 상태 유지를 위해 저장 상태는 유지한다.
    setGameState(GameState.MENU);
    setGameMode('normal');
    resetEventTimer();

    // 스킨 모달 열기 + 무료 뽑기 트리거
    openSkinModal();
  }, [
    grid, slots, score, phase, boardSize,
    canSkipSlide,
    obstacleState, unlockedObstacleFeatures,
    undoRemaining, blockRefreshRemaining, showBlockRefreshAdButton,
    lastSnapshot,
    hasUsedReviveThisRun,
    isReviveSelectionMode, reviveBreakRemaining, revivePendingTileId,
    maxScoreThisRun,
    playerName, sessionLockedPlayerName,
    getCurrentEventPlayedMs, getCurrentActiveDurationMs, getCurrentActiveDurationSeconds,
    resetEventTimer,
    openSkinModal,
  ]);

  const showBlockRefreshNotice = useCallback((message: string, durationMs = 1600) => {
    setBlockRefreshNotice(message);
    if (blockRefreshNoticeTimeoutRef.current) {
      window.clearTimeout(blockRefreshNoticeTimeoutRef.current);
      blockRefreshNoticeTimeoutRef.current = null;
    }
    blockRefreshNoticeTimeoutRef.current = window.setTimeout(() => {
      setBlockRefreshNotice(null);
      blockRefreshNoticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const claimAdminGifts = useCallback(async (): Promise<{ grantedSkins: number; grantedFragments: number }> => {
    const analyticsSessionId = getAnalyticsSessionId();
    const claimed = await claimPendingSkinGifts(analyticsSessionId || sessionIdRef.current);
    if (claimed.length === 0) {
      return { grantedSkins: 0, grantedFragments: 0 };
    }

    let grantedSkins = 0;
    let grantedFragments = 0;
    const ownedSkinIds = new Set(skinSettings.ownedSkins.map((skin) => skin.id));
    const grantedSkinLabels: string[] = [];

    for (const gift of claimed) {
      if (gift.type === 'skin') {
        const skinId = gift.skinId || '';
        const catalogSkin = SKIN_CATALOG.find((entry) => entry.id === skinId);
        if (!catalogSkin) continue;
        if (ownedSkinIds.has(skinId)) {
          grantedFragments += FRAGMENTS_PER_DUPLICATE;
          continue;
        }

        addSkin({
          id: catalogSkin.id,
          hex: catalogSkin.hex,
          acquiredAt: Date.now(),
        });
        ownedSkinIds.add(catalogSkin.id);
        grantedSkins += 1;
        const fallbackLabel = (() => {
          const basicSkinMatch = catalogSkin.id.match(/^skin_(\d+)$/);
          if (basicSkinMatch) {
            return `기본 스킨 ${basicSkinMatch[1]}`;
          }
          return catalogSkin.hex.toUpperCase();
        })();
        const skinLabel = catalogSkin.nameKey
          ? String(t(`skins:${catalogSkin.nameKey}`, fallbackLabel))
          : fallbackLabel;
        grantedSkinLabels.push(skinLabel);
        continue;
      }

      grantedFragments += Math.max(0, gift.fragmentAmount ?? 0);
    }

    if (grantedFragments > 0) {
      addFragments(grantedFragments);
    }

    if (grantedSkins > 0 || grantedFragments > 0) {
      const skinDetail = grantedSkinLabels.length > 0
        ? `\n${grantedSkinLabels.slice(0, 2).join(', ')}${grantedSkinLabels.length > 2 ? ` 외 ${grantedSkinLabels.length - 2}개` : ''}`
        : '';

      showComboMessage(
        `운영자 선물 도착\n스킨 ${grantedSkins}개 · 조각 ${grantedFragments}개${skinDetail}`,
        3200
      );
    }

    return { grantedSkins, grantedFragments };
  }, [addFragments, addSkin, showComboMessage, skinSettings.ownedSkins, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentRoute === '/admin-analytics') return;

    let cancelled = false;
    const timeoutIds: number[] = [];

    const runClaim = async () => {
      if (cancelled) return;
      const { grantedSkins } = await claimAdminGifts();
      if (cancelled) return;

      if (grantedSkins > 0 && gameStateRef.current === GameState.MENU) {
        openSkinModal();
      }
    };

    for (const delay of SKIN_GIFT_CLAIM_RETRY_DELAYS_MS) {
      const timeoutId = window.setTimeout(() => {
        void runClaim();
      }, delay);
      timeoutIds.push(timeoutId);
    }

    const intervalId = window.setInterval(() => {
      void runClaim();
    }, SKIN_GIFT_CLAIM_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void runClaim();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [claimAdminGifts, currentRoute, openSkinModal]);

  // Undo 실행: 직전 스냅샷으로 복원
  const executeUndo = useCallback(() => {
    if (!lastSnapshot || undoRemaining <= 0 || isAnimating) return;

    // 스냅샷에서 상태 복원
    setGrid(lastSnapshot.grid);
    setSlots(lastSnapshot.slots);
    setScore(lastSnapshot.score);
    setPhase(lastSnapshot.phase);
    setCanSkipSlide(lastSnapshot.canSkipSlide);
    setObstacleState(cloneObstacleState(lastSnapshot.obstacleState));
    pendingObstacleMergedTileIdsRef.current = [];
    setUnlockedObstacleFeatures([...lastSnapshot.unlockedObstacleFeatures]);
    setObstacleUnlockQueue([]);

    // 사용 횟수 차감 및 스냅샷 초기화 (연속 Undo 방지)
    setUndoRemaining(prev => prev - 1);
    setLastSnapshot(null);

    // 미션 이벤트: 되돌리기 사용
    gameEventBus.emit('UNDO_USED', {});
    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }
    clearComboMessageQueue();

    // 애니메이션 관련 상태 정리
    setMergingTiles(EMPTY_MERGING_TILES);
    setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
    setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
  }, [lastSnapshot, undoRemaining, isAnimating]);

  // 🆕 리워드 광고 시청 핸들러
  const handleWatchRewardAd = useCallback(() => {
    // 데일리 챌린지/주간 이벤트에서는 광고 Undo 차단 (공정성)
    if (gameMode === 'daily_challenge' || gameMode === 'weekly_event') return;
    trackAnalyticsEvent({ name: 'ad_undo_request' });
    rewardAdService.showRewardAd({
      onRewardEarned: () => {
        // 🎯 보상 지급: 되돌리기 횟수 충전
        const actualAmount = REWARD_UNDO_AMOUNT;
        setUndoRemaining(prev => Math.min(prev + actualAmount, 99)); // 최대 99회 제한
        trackAnalyticsEvent({
          name: 'ad_undo_rewarded',
          meta: { amount: actualAmount },
        });

        // 사용자에게 알림 (다국어)
        showComboMessage(String(t('game:rewardAd.rewardEarned', { amount: actualAmount } as any)), 2000);

        console.log(`[App] 리워드 지급 완료: +${actualAmount}회`);
      },
      onAdClosed: () => {
        console.log('[App] 광고 닫힘');
        // 광고 로드 상태 업데이트
        setIsAdReady(rewardAdService.isAdReady());
      },
      onError: (error) => {
        console.error('[App] 광고 오류:', error);
        const message = error instanceof Error && error.message
          ? String(t('game:rewardAd.errorWithReason', { reason: error.message } as any))
          : String(t('game:rewardAd.error'));
        showComboMessage(message, 2500);
      },
      onDailyLimitReached: () => {
        showComboMessage(String(t('game:rewardAd.dailyLimitReached')), 2200);
      },
    });
  }, [t, showComboMessage, gameMode]);

  const handleRefreshPreviewBlocks = useCallback(() => {
    if (isAnimating || isReviveSelectionMode || draggingPiece) return;
    // 데일리 챌린지/주간 이벤트에서는 블록 새로고침 차단 (공정성)
    if (gameMode === 'daily_challenge' || gameMode === 'weekly_event') return;

    if (blockRefreshRemaining <= 0) {
      showBlockRefreshNotice(String(t('game:blockRefresh.limitExceeded')));
      setShowBlockRefreshAdButton(true);
      return;
    }

    setSlots((prevSlots) => generateRefreshedSlotPieces(prevSlots, prevSlots.length));
    setBlockRefreshRemaining((prev) => Math.max(0, prev - 1));

    // 미션 이벤트: 블록 새로고침 사용
    gameEventBus.emit('BLOCK_REFRESH_USED', {});
  }, [
    blockRefreshRemaining,
    draggingPiece,
    gameMode,
    isAnimating,
    isReviveSelectionMode,
    showBlockRefreshNotice,
    t,
  ]);

  const handleWatchBlockRefreshAd = useCallback(() => {
    trackAnalyticsEvent({ name: 'ad_block_refresh_request' });
    if (!isBlockRefreshRewardInterstitialAdSupported()) {
      showBlockRefreshNotice(String(t('game:blockRefresh.ad.notSupported')));
      return;
    }

    if (isBlockRefreshAdInProgress) return;
    setIsBlockRefreshAdInProgress(true);

    blockRefreshRewardInterstitialAdService.showRewardAd({
      onRewardEarned: () => {
        setBlockRefreshRemaining((prev) => Math.min(prev + REWARD_BLOCK_REFRESH_AMOUNT, 99));
        setShowBlockRefreshAdButton(false);
        setIsBlockRefreshAdInProgress(false);
        trackAnalyticsEvent({
          name: 'ad_block_refresh_rewarded',
          meta: { amount: REWARD_BLOCK_REFRESH_AMOUNT },
        });
        showComboMessage(String(t('game:blockRefresh.ad.rewardEarned', { amount: REWARD_BLOCK_REFRESH_AMOUNT } as any)), 2000);
      },
      onAdClosed: () => {
        setIsBlockRefreshAdInProgress(false);
      },
      onError: (error) => {
        console.error('[App] 블록 새로고침 보상형 전면 광고 오류:', error);
        setIsBlockRefreshAdInProgress(false);
        showBlockRefreshNotice(String(t('game:blockRefresh.ad.error')));
      },
      onDailyLimitReached: () => {
        setIsBlockRefreshAdInProgress(false);
        showBlockRefreshNotice(String(t('game:blockRefresh.ad.dailyLimitReached')));
      },
    });
  }, [isBlockRefreshAdInProgress, showBlockRefreshNotice, showComboMessage, t]);

  const handleWatchReviveAd = useCallback(() => {
    trackAnalyticsEvent({ name: 'ad_revive_request' });
    if (isReviveAdInProgress) return;
    if (countOccupiedTiles(grid) <= 0) {
      showComboMessage(String(t('modals:gameOver.reviveUnavailable')), 1800);
      return;
    }

    setIsReviveAdInProgress(true);

    rewardInterstitialAdService.showReviveAd({
      onRewardEarned: () => {
        const destroyCount = REVIVE_DESTROY_COUNT_BY_BOARD_SIZE[boardSize];
        trackAnalyticsEvent({
          name: 'ad_revive_rewarded',
          meta: { destroyCount },
        });

        // ref를 state보다 먼저 동기적으로 설정하여
        // 네이티브 콜백 내 개별 setState 사이에 게임오버 체크가 끼어드는 것을 방지
        isReviveSelectionModeRef.current = true;

        // 이전 슬라이드 애니메이션 잔여 타임아웃 정리 (부활 도중 예기치 않은 상태 변경 방지)
        if (mergeClearTimeoutRef.current) {
          window.clearTimeout(mergeClearTimeoutRef.current);
          mergeClearTimeoutRef.current = null;
        }
        if (portalReleaseClearTimeoutRef.current) {
          window.clearTimeout(portalReleaseClearTimeoutRef.current);
          portalReleaseClearTimeoutRef.current = null;
        }
        if (mergeFinalizeTimeoutRef.current) {
          window.clearTimeout(mergeFinalizeTimeoutRef.current);
          mergeFinalizeTimeoutRef.current = null;
        }
        if (mergedNumberBurstClearTimeoutRef.current) {
          window.clearTimeout(mergedNumberBurstClearTimeoutRef.current);
          mergedNumberBurstClearTimeoutRef.current = null;
        }
        if (unlockTimeoutRef.current) {
          window.clearTimeout(unlockTimeoutRef.current);
          unlockTimeoutRef.current = null;
        }

        setMergingTiles(EMPTY_MERGING_TILES);
        setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
        setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
        setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
        setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
        slideLockRef.current = false;
        setIsAnimating(false);
        setLastSnapshot(null);
        setPhase(Phase.PLACE);
        setCanSkipSlide(false);
        setReviveDestroyEffects([]);
        setRevivePendingTileId(null);
        setReviveBreakRemaining(destroyCount);
        setIsReviveSelectionMode(true);

        setGameState(GameState.PLAYING);
        setHasUsedReviveThisRun(true);
        setIsReviveAdInProgress(false);
        showComboMessage(String(t('modals:gameOver.reviveSuccess', { count: destroyCount } as any)), 1800);
      },
      onAdClosed: () => {
        setIsReviveAdInProgress(false);
        setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
      },
      onError: (error) => {
        console.error('[App] 보상형 전면 광고 오류:', error);
        setIsReviveAdInProgress(false);
        setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
        showComboMessage(String(t('modals:gameOver.reviveError')), 2200);
      },
      onDailyLimitReached: () => {
        setIsReviveAdInProgress(false);
        showComboMessage(String(t('modals:gameOver.reviveDailyLimitReached')), 2200);
      },
    });
  }, [boardSize, grid, isReviveAdInProgress, showComboMessage, t]);

  const handleReviveTileTap = useCallback((tileId: string) => {
    if (!isReviveSelectionMode || gameState !== GameState.PLAYING) return;
    if (isAnimating || slideLockRef.current) return;
    if (reviveBreakRemaining <= 0) return;

    if (revivePendingTileId !== tileId) {
      setRevivePendingTileId(tileId);
      return;
    }

    let targetX = -1;
    let targetY = -1;
    let targetValue = 0;
    for (let y = 0; y < grid.length; y += 1) {
      const row = grid[y];
      for (let x = 0; x < row.length; x += 1) {
        const tile = row[x];
        if (!tile || tile.id !== tileId) continue;
        targetX = x;
        targetY = y;
        targetValue = tile.value;
        break;
      }
      if (targetX >= 0) break;
    }

    setRevivePendingTileId(null);
    if (targetX < 0 || targetY < 0) return;

    setGrid((prevGrid) =>
      prevGrid.map((row, y) =>
        row.map((tile, x) => (x === targetX && y === targetY ? null : tile))
      )
    );

    const effect: ReviveDestroyEffect = {
      id: `${tileId}-${Date.now()}`,
      x: targetX,
      y: targetY,
      value: targetValue,
    };
    setReviveBreakRemaining((prev) => Math.max(prev - 1, 0));
    setReviveDestroyEffects((prev) => [...prev, effect]);

    const timeoutId = window.setTimeout(() => {
      setReviveDestroyEffects((prev) => prev.filter((item) => item.id !== effect.id));
      reviveDestroyEffectTimeoutsRef.current = reviveDestroyEffectTimeoutsRef.current.filter((id) => id !== timeoutId);
    }, 240);
    reviveDestroyEffectTimeoutsRef.current.push(timeoutId);
  }, [gameState, grid, isAnimating, isReviveSelectionMode, reviveBreakRemaining, revivePendingTileId]);

  useEffect(() => {
    if (!isReviveSelectionMode) return;
    const occupied = countOccupiedTiles(grid);
    if (reviveBreakRemaining > 0 && occupied > 0) return;

    const exhaustedByCount = reviveBreakRemaining <= 0;
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setRevivePendingTileId(null);
    setReviveBreakRemaining(0);
    // 부활 파괴 모드가 끝나면 블록 배치가 아니라 스와이프 단계부터 재개한다.
    setPhase(Phase.SLIDE);
    setCanSkipSlide(false);

    if (exhaustedByCount) {
      showComboMessage(String(t('modals:gameOver.reviveSelectionComplete')), 1600);
      return;
    }
    showComboMessage(String(t('modals:gameOver.reviveNoTargets')), 1600);
  }, [grid, isReviveSelectionMode, reviveBreakRemaining, showComboMessage, t]);

  // 🆕 광고 미리 로드 (게임 진행 중이고 되돌리기가 0일 때)
  useEffect(() => {
    if (!isRewardAdSupported()) return;

    if (gameState === GameState.PLAYING) {
      // 스킨 뽑기 모달에서는 스킨 전용 리워드 광고를 우선 사용한다.
      // (Rewarded 광고 객체는 1회성이라 동시 선로딩 시 상태 충돌 가능)
      if (isSkinOpen) {
        rewardAdService.cleanup();
        setIsAdReady(false);
        return;
      }

      // 되돌리기 횟수가 0 또는 1 이하일 때 광고 미리 로드
      if (undoRemaining <= 1) {
        rewardAdService.preloadAd();

        // 광고 로드 상태 주기적 체크 (로드 완료 감지)
        const checkInterval = setInterval(() => {
          const ready = rewardAdService.isAdReady();
          setIsAdReady(ready);
          if (ready) {
            clearInterval(checkInterval);
          }
        }, 500);

        return () => clearInterval(checkInterval);
      }
    } else if (gameState === GameState.MENU) {
      // 메뉴로 돌아가면 광고 리소스 정리
      rewardAdService.cleanup();
      setIsAdReady(false);
    }
  }, [gameState, undoRemaining, isSkinOpen]);

  useEffect(() => {
    if (blockRefreshRemaining > 0 && showBlockRefreshAdButton) {
      setShowBlockRefreshAdButton(false);
    }
  }, [blockRefreshRemaining, showBlockRefreshAdButton]);

  // 블록 새로고침 보상형 전면 광고 미리 로드
  useEffect(() => {
    if (!isBlockRefreshRewardInterstitialAdSupported()) return;

    if (gameState === GameState.PLAYING && showBlockRefreshAdButton) {
      blockRefreshRewardInterstitialAdService.preloadAd();
      return;
    }

    if (gameState === GameState.MENU) {
      blockRefreshRewardInterstitialAdService.cleanup();
      setIsBlockRefreshAdInProgress(false);
    }
  }, [gameState, showBlockRefreshAdButton]);

  // 게임오버 부활용 보상형 전면 광고 미리 로드
  useEffect(() => {
    if (!isRewardInterstitialAdSupported()) return;

    if ((gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) && !hasUsedReviveThisRun) {
      rewardInterstitialAdService.preloadAd();
      setIsReviveAdReady(rewardInterstitialAdService.isAdReady());

      const checkInterval = setInterval(() => {
        const ready = rewardInterstitialAdService.isAdReady();
        setIsReviveAdReady(ready);
        if (ready) {
          clearInterval(checkInterval);
        }
      }, 500);

      return () => clearInterval(checkInterval);
    }

    if (gameState === GameState.MENU) {
      rewardInterstitialAdService.cleanup();
      setIsReviveAdReady(false);
      setIsReviveAdInProgress(false);
      isReviveSelectionModeRef.current = false;
      setIsReviveSelectionMode(false);
      setReviveBreakRemaining(0);
      setRevivePendingTileId(null);
      setReviveDestroyEffects([]);
    }
  }, [gameState, hasUsedReviveThisRun]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (mergeClearTimeoutRef.current) window.clearTimeout(mergeClearTimeoutRef.current);
      if (portalReleaseClearTimeoutRef.current) window.clearTimeout(portalReleaseClearTimeoutRef.current);
      if (mergeFinalizeTimeoutRef.current) window.clearTimeout(mergeFinalizeTimeoutRef.current);
      if (mergedNumberBurstClearTimeoutRef.current) window.clearTimeout(mergedNumberBurstClearTimeoutRef.current);
      if (unlockTimeoutRef.current) window.clearTimeout(unlockTimeoutRef.current);
      if (comboMessageTimeoutRef.current) window.clearTimeout(comboMessageTimeoutRef.current);
      if (blockRefreshNoticeTimeoutRef.current) window.clearTimeout(blockRefreshNoticeTimeoutRef.current);
      if (comboTimerRef.current) {
        clearInterval(comboTimerRef.current);
        comboTimerRef.current = null;
      }
      reviveDestroyEffectTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      reviveDestroyEffectTimeoutsRef.current = [];
    };
  }, []);

  // --- Helpers ---

  const getPieceBounds = useCallback((cells: Piece['cells']) => {
    const minX = Math.min(...cells.map((c) => c.x));
    const maxX = Math.max(...cells.map((c) => c.x));
    const minY = Math.min(...cells.map((c) => c.y));
    const maxY = Math.max(...cells.map((c) => c.y));
    return { minX, maxX, minY, maxY };
  }, []);

  const readBoardMetrics = useCallback((): BoardMetrics | null => {
    const boardEl = boardRef.current;
    if (!boardEl) return null;

    // Match Board.tsx exactly: drag/drop math uses the grid viewport, while the
    // outer board shell remains free for skin chrome. If this selector is missing
    // we fall back to the shell only to keep older renders alive during transitions.
    const gridViewportEl =
      boardEl.querySelector<HTMLElement>(BOARD_GRID_VIEWPORT_SELECTOR) ?? boardEl;
    const rect = gridViewportEl.getBoundingClientRect();
    // Board 컴포넌트와 동일하게 grid.length 기반으로 계산하여 일관성 보장
    const size = grid.length;
    const innerWidth = rect.width;
    const innerHeight = rect.height;
    const inner = Math.min(innerWidth, innerHeight);
    const totalGap = (size - 1) * BOARD_CELL_GAP_PX;
    if (!Number.isFinite(inner) || inner <= totalGap) return null;
    const offsetX = Math.max(0, (innerWidth - inner) / 2);
    const offsetY = Math.max(0, (innerHeight - inner) / 2);
    const cell = (inner - totalGap) / size;
    const pitch = cell + BOARD_CELL_GAP_PX;

    return {
      rectLeft: rect.left,
      rectTop: rect.top,
      innerWidth,
      innerHeight,
      offsetX,
      offsetY,
      cell,
      pitch,
      size,
    };
  }, [grid]);

  const applyDragOverlayTransform = useCallback((pointerX: number, pointerY: number) => {
    if (!dragOverlayRef.current) return;
    const fingerYOffset = (boardMetricsRef.current?.pitch ?? 60) * DRAG_LIFT_CELLS;
    dragOverlayRef.current.style.transform = `translate3d(${pointerX}px, ${pointerY - fingerYOffset}px, 0)`;
  }, []);

  const rotateActivePiece = useCallback(() => {
    if (!draggingPiece) return;
    // 이벤트 모드: 회전 비활성화
    if (eventRuleRef.current?.disableRotation) return;
    gameEventBus.emit('ROTATION_USED', {});

    setDraggingPiece(prev => {
      if (!prev) return null;
      const nextRot = (prev.rotation + 1) % 4;
      const nextCells = getRotatedCells(prev.type, nextRot);
      return {
        ...prev,
        rotation: nextRot,
        // 회전 버튼을 한 번이라도 누른 조각은 "회전 사용"으로 간주한다.
        initialRotation: -1,
        cells: nextCells,
      };
    });
  }, [draggingPiece]);

  // --- Event Handlers: Drag & Drop ---

  // finishSlideTurn is used by executeSlide when a swipe does not merge.
  const finishSlideTurn = useCallback(() => {
    setPhase(Phase.PLACE);
    clearComboMessageQueue();
    setCanSkipSlide(false);
  }, []);

  // Memoized callback to prevent Slot re-renders
  const rotateSlotPiece = useCallback((index: number) => {
    // 이벤트 모드: 회전 비활성화
    if (eventRuleRef.current?.disableRotation) return;
    gameEventBus.emit('ROTATION_USED', {});
    setSlots(currentSlots => {
      const newSlots = [...currentSlots];
      const piece = newSlots[index];
      if (!piece) return currentSlots;

      const nextRot = (piece.rotation + 1) % 4;
      newSlots[index] = {
        ...piece,
        rotation: nextRot,
        // 회전 후 원각도로 되돌리는 우회를 막기 위해 흔적을 남긴다.
        initialRotation: -1,
        cells: getRotatedCells(piece.type, nextRot)
      };
      return newSlots;
    });
  }, []);

  // Memoized callback to prevent Slot re-renders
  const handlePointerDown = useCallback((e: React.PointerEvent, piece: Piece, index: number) => {
    if (isGameplayInputBlocked) return;
    if (draggingPiece) return;
    if (isReviveSelectionMode) return;
    const isSlidePhaseButSkippable = phase === Phase.SLIDE && canSkipSlide;

    // Animation/Input Lock Check (ref 기반: state 반영 전에도 즉시 차단)
    if (slideLockRef.current) return;

    if (phase !== Phase.PLACE && !isSlidePhaseButSkippable) return;

    if (isSlidePhaseButSkippable) {
      // 콤보(추가 스와이프 가능) 상태에서는 드래그 "시도"만으로 턴을 소비하지 않는다.
      // 실제 배치가 성공했을 때만 콤보를 소모해야 실수 터치로 권한이 사라지지 않는다.
      swipeStartRef.current = null;
    }

    const metrics = readBoardMetrics();
    if (!metrics) return;

    const initCells = getRotatedCells(piece.type, piece.rotation);
    dragPointerIdRef.current = e.pointerId;
    setPressedSlotIndex(index);
    setDraggingPiece({ ...piece, cells: initCells });
    setDragOriginIndex(index);
    boardMetricsRef.current = metrics;
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);
    latestPointerRef.current = null;
    currentPointerPosRef.current = { x: e.clientX, y: e.clientY };
    applyDragOverlayTransform(e.clientX, e.clientY);

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, [phase, canSkipSlide, draggingPiece, isReviveSelectionMode, readBoardMetrics, applyDragOverlayTransform, isGameplayInputBlocked]);

  // RAF 기반으로 포인터 이벤트를 1프레임에 1번으로 합쳐서(코얼레싱) 렌더/연산 폭주를 방지
  const rafIdRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const getGridPosFromPointer = useCallback((clientX: number, clientY: number) => {
    const metrics = boardMetricsRef.current;
    if (!metrics) return null;

    const relativeX = clientX - metrics.rectLeft - metrics.offsetX;
    const relativeY = clientY - metrics.rectTop - metrics.offsetY;
    const playableSpan = metrics.pitch * (metrics.size - 1) + metrics.cell;
    const EDGE_EPSILON_PX = 0.5;
    const isOutside =
      relativeX < -EDGE_EPSILON_PX ||
      relativeY < -EDGE_EPSILON_PX ||
      relativeX > playableSpan + EDGE_EPSILON_PX ||
      relativeY > playableSpan + EDGE_EPSILON_PX;
    if (isOutside) return null;

    const rawX = Math.round((relativeX - metrics.cell / 2) / metrics.pitch);
    const rawY = Math.round((relativeY - metrics.cell / 2) / metrics.pitch);

    return {
      x: clamp(rawX, 0, metrics.size - 1),
      y: clamp(rawY, 0, metrics.size - 1),
    };
  }, []);

  const resetDraggingState = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    latestPointerRef.current = null;
    currentPointerPosRef.current = null;
    lastDragMoveEmitPosRef.current = null;
    setPressedSlotIndex(-1);
    setDraggingPiece(null);
    setDragOriginIndex(-1);
    dragPointerIdRef.current = null;
    boardMetricsRef.current = null;
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);
  }, []);

  const clearSwipeTracking = useCallback(() => {
    swipeStartRef.current = null;
    swipePointerIdRef.current = null;
    swipeCommittedRef.current = false;
  }, []);

  const tryCommitSwipeGesture = useCallback((clientX: number, clientY: number): boolean => {
    if (phase !== Phase.SLIDE) return false;
    if (slideLockRef.current || swipeCommittedRef.current) return false;

    const swipeStart = swipeStartRef.current;
    if (!swipeStart) return false;

    const dx = clientX - swipeStart.x;
    const dy = clientY - swipeStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) <= SWIPE_TRIGGER_DISTANCE_PX) return false;

    swipeCommittedRef.current = true;
    swipeStartRef.current = null;
    executeSlideRef.current?.(
      absX > absY
        ? (dx > 0 ? 'RIGHT' : 'LEFT')
        : (dy > 0 ? 'DOWN' : 'UP')
    );
    return true;
  }, [phase]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPiece && swipePointerIdRef.current !== null) {
      if (e.pointerId !== swipePointerIdRef.current) return;
      if (tryCommitSwipeGesture(e.clientX, e.clientY)) return;
    }

    if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
    if (!draggingPiece || !boardMetricsRef.current) return;
    latestPointerRef.current = { x: e.clientX, y: e.clientY };
    if (rafIdRef.current) return;

    rafIdRef.current = requestAnimationFrame(() => {
      const pointer = latestPointerRef.current;
      const metrics = boardMetricsRef.current;
      rafIdRef.current = null;
      if (!pointer || !metrics) return;
      currentPointerPosRef.current = pointer;
      // Galaxy 인터랙션: RAF-throttled — 드래그 중 별 반발력 위치 전달
      const prevEmitPos = lastDragMoveEmitPosRef.current;
      const hasMeaningfulMove = !prevEmitPos || Math.hypot(pointer.x - prevEmitPos.x, pointer.y - prevEmitPos.y) >= 1;
      if (hasMeaningfulMove && gameEventBus.hasListeners('DRAG_MOVE')) {
        gameEventBus.emit('DRAG_MOVE', { x: pointer.x, y: pointer.y });
        lastDragMoveEmitPosRef.current = pointer;
      }

      applyDragOverlayTransform(pointer.x, pointer.y);
      // ghost 앵커: 시각적 블럭의 (0,0) 셀 중심 위치 기준
      // → ghost 상단 행이 시각적 블럭 상단 행과 정렬됨
      const dragCellSize = metrics.cell * DRAG_OVERLAY_SCALE;
      const { minX, maxX, minY, maxY } = getPieceBounds(draggingPiece.cells);
      const ghostAnchorX = pointer.x - (minX + maxX) / 2 * dragCellSize;
      const fingerYOffset = metrics.pitch * DRAG_LIFT_CELLS;
      const ghostAnchorY = pointer.y - fingerYOffset - (minY + maxY) / 2 * dragCellSize;
      const next = getGridPosFromPointer(ghostAnchorX, ghostAnchorY);
      if (!next) {
        if (hoverGridPosRef.current) {
          hoverGridPosRef.current = null;
          boardHandleRef.current?.setHoverLocation(null);
        }
        return;
      }

      const prev = hoverGridPosRef.current;
      if (prev && prev.x === next.x && prev.y === next.y) return;

      hoverGridPosRef.current = next;
      boardHandleRef.current?.setHoverLocation(next);
    });
  };

  const handleSwipeStart = (e: React.PointerEvent) => {
    if (isGameplayInputBlocked) return;
    // 슬라이드는 보드 영역에서만 시작하지 않고 전체 화면 허용
    // 단, 버튼 등 상호작용 요소 위에서는 스와이프 시작 방지
    if (isReviveSelectionMode) return;
    if (phase !== Phase.SLIDE) return;
    if (slideLockRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [role="button"]')) return;

    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    swipePointerIdRef.current = e.pointerId;
    swipeCommittedRef.current = false;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleScreenPointerDown = (e: React.PointerEvent) => {
    if (isGameplayInputBlocked) return;
    if (isReviveSelectionMode) return;

    if (draggingPiece) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-rotate-button], [data-slot], button, input, select, textarea, [role="button"]')) {
        return;
      }
      if (dragPointerIdRef.current !== null && e.pointerId === dragPointerIdRef.current) return;
      rotateActivePiece();
      return;
    }

    handleSwipeStart(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // 1. 드래그 중인 조각이 있다면 -> 조각 놓기 처리
    if (draggingPiece) {
      if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
      // Galaxy 인터랙션: 드래그 종료
      gameEventBus.emit('DRAG_END', {});
      // 드래그 종료 시 스와이프 시작 좌표가 남아있으면 다음 입력에서 오동작 가능
      clearSwipeTracking();
      // 빠른 탭(이동 없음) 시 fallback: handlePointerMove와 동일한 (0,0) 앵커 사용
      const fallbackCellSize = (boardMetricsRef.current?.cell ?? 32) * DRAG_OVERLAY_SCALE;
      const { minX: fbMinX, maxX: fbMaxX, minY: fbMinY, maxY: fbMaxY } = getPieceBounds(draggingPiece.cells);
      const hover = hoverGridPosRef.current ?? getGridPosFromPointer(
        e.clientX - (fbMinX + fbMaxX) / 2 * fallbackCellSize,
        e.clientY - (boardMetricsRef.current?.pitch ?? 60) * DRAG_LIFT_CELLS - (fbMinY + fbMaxY) / 2 * fallbackCellSize
      );

      if (hover && boardRef.current) {
        if (canPlacePieceWithObstacles(grid, obstacleState, draggingPiece, hover.x, hover.y)) {
          // Undo를 위해 현재 상태 저장 (배치 전)
          saveSnapshot();

          const newGrid = placePieceOnGrid(grid, draggingPiece, hover.x, hover.y);
          setGrid(newGrid);

          // 미션 이벤트: 블록 배치
          gameEventBus.emit('BLOCK_PLACED', {
            pieceType: draggingPiece.type,
            cells: draggingPiece.cells,
            rotation: draggingPiece.rotation,
            initialRotation: draggingPiece.initialRotation,
            value: draggingPiece.value,
          });
          setCanSkipSlide(false);
          clearComboMessageQueue();

          if (tutorialStep === 1) {
            setTutorialStep(2); // Proceed to Swipe Tutorial
          }

          // Increment move count
          moveCountRef.current += 1;

          const newSlots = [...slots];
          if (gameMode === 'daily_challenge' && challengeSeedRef.current !== null) {
            const nextPiece = generateChallengeSlots(challengeSeedRef.current, challengePieceIndexRef.current, 1)[0];
            challengePieceIndexRef.current += 1;
            newSlots[dragOriginIndex] = nextPiece;
          } else if (gameMode === 'weekly_event' && eventRuleRef.current) {
            newSlots[dragOriginIndex] = generateEventPiece(eventRuleRef.current);
          } else {
            newSlots[dragOriginIndex] = generateRandomPiece();
          }
          setSlots(newSlots);

          if (hasPossibleMovesWithObstacles(newGrid, obstacleState)) {
            setPhase(Phase.SLIDE);
          } else {
            setPhase(Phase.PLACE);
          }
        }
      }

      resetDraggingState();
      return;
    }

    // 2. 드래그 중이 아니고, 슬라이드 단계라면 -> 스와이프 처리
    if (isReviveSelectionMode) {
      clearSwipeTracking();
      return;
    }

    if (swipePointerIdRef.current !== null && e.pointerId !== swipePointerIdRef.current) return;
    if (!swipeCommittedRef.current) {
      tryCommitSwipeGesture(e.clientX, e.clientY);
    }
    clearSwipeTracking();
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!draggingPiece) {
      if (dragPointerIdRef.current !== null && e.pointerId === dragPointerIdRef.current) {
        clearSwipeTracking();
        resetDraggingState();
        return;
      }
      if (swipePointerIdRef.current !== null && e.pointerId === swipePointerIdRef.current) {
        clearSwipeTracking();
      }
      return;
    }
    if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
    // Galaxy 인터랙션: 터치 인터럽트(전화, 알림 등) 시에도 반발력 해제
    gameEventBus.emit('DRAG_END', {});
    clearSwipeTracking();
    resetDraggingState();
  };

  useEffect(() => {
    if (phase === Phase.SLIDE && !isAnimating) return;
    clearSwipeTracking();
  }, [clearSwipeTracking, isAnimating, phase]);

  // --- Event Handlers: Swipe / Slide ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameplayInputBlocked) return;
      if (e.key === 'r' || e.key === 'R') {
        if (draggingPiece) rotateActivePiece();
      }

      if (isReviveSelectionMode) {
        if (e.key === 'Escape') {
          setRevivePendingTileId(null);
        }
        return;
      }

      if (gameState === GameState.PLAYING && phase === Phase.SLIDE) {
        // Animation/Input Lock Check (ref 기반: state 반영 전에도 즉시 차단)
        if (slideLockRef.current) return;

        let dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null = null;
        if (e.key === 'ArrowUp') dir = 'UP';
        if (e.key === 'ArrowDown') dir = 'DOWN';
        if (e.key === 'ArrowLeft') dir = 'LEFT';
        if (e.key === 'ArrowRight') dir = 'RIGHT';

        if (dir) {
          executeSlideRef.current?.(dir);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    phase,
    draggingPiece,
    rotateActivePiece,
    isReviveSelectionMode,
    isGameplayInputBlocked,
  ]);

  const queueNewObstacleUnlocks = useCallback((scoreValue: number, maxTileValue: number) => {
    if (gameModeRef.current !== 'normal') return;
    const stage = getObstacleStage({ score: scoreValue, maxTile: maxTileValue });
    const eligibleFeatures = getUnlockedObstacleFeatures(stage);
    const current = new Set(unlockedObstacleFeaturesRef.current);
    const newlyUnlocked = eligibleFeatures.filter((feature) => !current.has(feature));
    if (newlyUnlocked.length === 0) return;

    const nextUnlocked = [...unlockedObstacleFeaturesRef.current, ...newlyUnlocked];
    unlockedObstacleFeaturesRef.current = nextUnlocked;
    setUnlockedObstacleFeatures(nextUnlocked);
    setObstacleUnlockQueue((prev) => [...prev, ...newlyUnlocked]);
  }, []);

  const queueObstacleUnlocksAfterSlide = useCallback((
    baseGrid: Grid,
    scoreAfterSlide: number
  ): void => {
    if (gameModeRef.current !== 'normal') return;
    queueNewObstacleUnlocks(scoreAfterSlide, getMaxTileValue(baseGrid));
  }, [queueNewObstacleUnlocks]);

  const rollObstacleStateBeforePlace = useCallback((
    baseGrid: Grid,
    baseObstacleState: ObstacleState,
    slideMergedTileIds: string[],
    scoreAfterSlide: number
  ): ObstacleState => {
    const clonedState = cloneObstacleState(baseObstacleState);
    if (gameModeRef.current !== 'normal') return clonedState;

    const maxTile = getMaxTileValue(baseGrid);
    queueNewObstacleUnlocks(scoreAfterSlide, maxTile);
    const liveTileIds = new Set(
      baseGrid.flatMap((row) => row.flatMap((tile) => (tile ? [tile.id] : [])))
    );
    const mergedTileIds = [...new Set(slideMergedTileIds)].filter((tileId) => liveTileIds.has(tileId));
    const rollResult = rollObstacleSpawn({
      grid: baseGrid,
      slots,
      obstacleState: clonedState,
      boardSize: boardSizeRef.current,
      score: scoreAfterSlide,
      maxTile,
      mergedTileIds,
      disableRotation: false,
    });
    return rollResult.obstacleState;
  }, [queueNewObstacleUnlocks, slots]);

  const executeSlide = (dir: Direction) => {
    if (isGameplayInputBlocked) return;
    if (slideLockRef.current) return; // Double check

    const {
      grid: newGrid,
      score: scoreAdded,
      moved,
      mergingTiles: newMergingTiles,
      mergedTiles,
      portalReleaseAnimations: newPortalReleaseAnimations,
      maxDistance,
      obstacleState: newObstacleState,
    } = slideGridWithObstacles(grid, obstacleState, dir);

    if (!moved) {
      // 예외 상태 안전장치: SLIDE 단계에서 어떤 방향도 불가능하면 PLACE로 복귀시킨다.
      if (!hasPossibleMovesWithObstacles(grid, obstacleState)) {
        const mergedIdsForRoll = pendingObstacleMergedTileIdsRef.current;
        pendingObstacleMergedTileIdsRef.current = [];
        const newObsState = rollObstacleStateBeforePlace(
          grid, obstacleState, mergedIdsForRoll, scoreRef.current
        );
        if (newObsState !== obstacleState) {
          setObstacleState(newObsState);
        }
        finishSlideTurn();
      }
      return;
    }

    // Fever time rule: only continues when a merge actually happened
    if (mergedTiles.length === 0) {
      clearComboMessageQueue();
      resetComboState();
    } else {
      // Combo: trigger increment based on merge count
      triggerComboIncrement(mergedTiles.length);

      // Combo message display
      if (comboCount >= 1) {
        const nextCount = comboCount + 1;
        if (nextCount >= 5) {
          showComboMessage('LEGENDARY!', 2000);
        } else if (nextCount >= 4) {
          showComboMessage('4x Combo!!', 1800);
        } else if (nextCount >= 3) {
          showComboMessage('3x Combo!', 1600);
        } else if (nextCount >= 2) {
          showComboMessage('2x Combo!', 1400);
        }
      }
    }

    // 미션 이벤트: 슬라이드 수행
    gameEventBus.emit('SLIDE_PERFORMED', {
      direction: dir.toLowerCase() as 'up' | 'down' | 'left' | 'right',
      mergeCount: mergedTiles.length,
      scoreGained: scoreAdded,
    });
    // 미션 이벤트: 타일 생성 (병합으로 새 값이 만들어질 때)
    for (const mt of mergedTiles) {
      gameEventBus.emit('TILE_CREATED', { value: mt.toValue });
    }

    if (tutorialStep === 2) {
      setTutorialStep(0);
      localStorage.setItem(ONBOARDING_STORAGE_KEYS.tutorialCompleted, 'true');
      void rescheduleNotifications({ allowPermissionPrompt: true });
    }

    // Increment move count for anti-cheat
    moveCountRef.current += 1;

    // Undo를 위해 현재 상태 저장 (슬라이드 전)
    saveSnapshot();
    const lockMs = getSlideAnimationDurationMs(maxDistance) + SLIDE_UNLOCK_BUFFER_MS;
    let pendingObstacleState = cloneObstacleState(newObstacleState);
    if (mergedTiles.length > 0) {
      pendingObstacleMergedTileIdsRef.current = [
        ...pendingObstacleMergedTileIdsRef.current,
        ...mergedTiles.map((tile) => tile.id),
      ];
    }

    // Lock Input
    slideLockRef.current = true;
    setIsAnimating(true);

    // Natural merge: 이동 중에는 합쳐지기 전 값으로 보이도록 오버라이드
    if (mergedTiles.length > 0) {
      const overrides: Record<string, number> = {};
      for (const mt of mergedTiles) overrides[mt.id] = mt.fromValue;
      setTileValueOverrides(overrides);
    } else {
      setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    }

    // Set merging tiles for animation
    if (mergeClearTimeoutRef.current) {
      window.clearTimeout(mergeClearTimeoutRef.current);
      mergeClearTimeoutRef.current = null;
    }
    if (newMergingTiles.length > 0) {
      setMergingTiles(newMergingTiles);
      mergeClearTimeoutRef.current = window.setTimeout(() => {
        setMergingTiles(EMPTY_MERGING_TILES);
        mergeClearTimeoutRef.current = null;
      }, lockMs);
    } else {
      setMergingTiles(EMPTY_MERGING_TILES);
    }

    if (portalReleaseClearTimeoutRef.current) {
      window.clearTimeout(portalReleaseClearTimeoutRef.current);
      portalReleaseClearTimeoutRef.current = null;
    }
    if (newPortalReleaseAnimations.length > 0) {
      setPortalReleaseAnimations(newPortalReleaseAnimations);
      portalReleaseClearTimeoutRef.current = window.setTimeout(() => {
        setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
        portalReleaseClearTimeoutRef.current = null;
      }, lockMs);
    } else {
      setPortalReleaseAnimations(EMPTY_PORTAL_RELEASE_ANIMATIONS);
    }

    setGrid(newGrid);
    setObstacleState(pendingObstacleState);

    // Post-animation 상태 변경을 스태거링하여 한 프레임에 몰리는 글리치 방지
    // Step 1 (lockMs): 병합 고스트 타일 제거 (위에서 이미 설정됨)
    // Step 2 (lockMs + 16ms): 값/점수 반영
    // Step 3 (lockMs + 32ms): 입력 해제
    if (mergeFinalizeTimeoutRef.current) {
      window.clearTimeout(mergeFinalizeTimeoutRef.current);
      mergeFinalizeTimeoutRef.current = null;
    }
    if (scoreAdded > 0) {
      mergeFinalizeTimeoutRef.current = window.setTimeout(() => {
        setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
        const mergedBurstIds = new Set(mergedTiles.map((tile) => tile.id));
        if (mergedBurstIds.size > 0) {
          setMergedNumberBurstTileIds(mergedBurstIds);
          setMergedNumberBurstByTileId(buildMergedBurstValueMap(mergedTiles));
          if (mergedNumberBurstClearTimeoutRef.current) {
            window.clearTimeout(mergedNumberBurstClearTimeoutRef.current);
          }
          mergedNumberBurstClearTimeoutRef.current = window.setTimeout(() => {
            setMergedNumberBurstTileIds(EMPTY_TILE_ID_SET);
            setMergedNumberBurstByTileId(EMPTY_TILE_BURST_MAP);
            mergedNumberBurstClearTimeoutRef.current = null;
          }, 280);
        }

        // 이벤트 점수 배율 & 트리플킬 보너스 적용
        let finalScore = scoreAdded;
        const evRule = eventRuleRef.current;
        if (gameMode === 'weekly_event' && evRule) {
          if (evRule.scoreMultiplier > 1) {
            finalScore = Math.round(finalScore * evRule.scoreMultiplier);
          }
          if (evRule.tripleKillBonus > 0 && mergedTiles.length >= 3) {
            finalScore += evRule.tripleKillBonus;
          }
        }
        // Combo multiplier (applied after event multiplier, capped at server max)
        const comboMult = comboMultiplierRef.current;
        if (comboMult > 1.0) {
          finalScore = Math.round(finalScore * comboMult);
        }
        // 상한 적용 (MAX_SCORE = 1,000,000)
        const MAX_SCORE = 1_000_000;
        finalScore = Math.min(finalScore, MAX_SCORE - scoreRef.current);
        if (finalScore < 0) finalScore = 0;
        const scoreAfterSlide = scoreRef.current + finalScore;
        setScore(prev => prev + finalScore);
        queueObstacleUnlocksAfterSlide(newGrid, scoreAfterSlide);

        // 1024 블럭이 새로 만들어질 때마다 스킨 조각 1개씩 지급
        // Undo 파밍 방지: 보드 위 실제 1024+ 타일 총 개수와 이미 보상 지급된 수를 비교
        const new1024Count = mergedTiles.filter(mt => mt.toValue === 1024).length;
        if (new1024Count > 0) {
          const board1024Total = newGrid.flat().filter(t => t !== null && t.value >= 1024).length;
          const rewardable = Math.max(0, board1024Total - rewarded1024CountRef.current);
          if (rewardable > 0) {
            addScoreMilestoneFragments(rewardable);
            rewarded1024CountRef.current += rewardable;
            showComboMessage('✦ 스킨 조각 획득!\n스킨 창에서 확인하세요', 2200);
          }
        }

        mergeFinalizeTimeoutRef.current = null;
      }, lockMs + 16);
    }

    if (unlockTimeoutRef.current) {
      window.clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
    unlockTimeoutRef.current = window.setTimeout(() => {
      slideLockRef.current = false;
      setIsAnimating(false);
      setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
      unlockTimeoutRef.current = null;

      if (scoreAdded <= 0) {
        const mergedTileIdsForObstacleRoll = pendingObstacleMergedTileIdsRef.current;
        pendingObstacleMergedTileIdsRef.current = [];
        pendingObstacleState = rollObstacleStateBeforePlace(
          newGrid,
          pendingObstacleState,
          mergedTileIdsForObstacleRoll,
          scoreRef.current
        );
        setObstacleState(pendingObstacleState);
      }

      if (scoreAdded > 0) {
        // 새 규칙: 머지가 발생했다면 이번 턴은 계속 스와이프만 가능
        setPhase(Phase.SLIDE);
        setCanSkipSlide(false);
      } else {
        finishSlideTurn();
      }
    }, lockMs + 32);
  };

  // Keep ref in sync so keyboard handler always uses latest closure
  executeSlideRef.current = executeSlide;

  // --- Game Over Check ---
  useEffect(() => {
    // 애니메이션이 진행 중이면 게임 오버 체크 연기
    // (슬라이드 후 grid가 업데이트되는 도중에 체크하면 잘못된 판정 발생)
    if (isAnimating || slideLockRef.current) {
      return;
    }

    if (gameState !== GameState.PLAYING) return;
    // state + ref 이중 가드: 네이티브 광고 콜백의 비동기 타이밍으로 인해
    // state가 아직 반영되지 않은 중간 렌더에서도 게임오버 판정을 방지
    if (isReviveSelectionMode || isReviveSelectionModeRef.current) return;

    const availability = getTurnActionAvailabilityWithObstacles(
      grid,
      slots,
      obstacleState,
      eventRuleRef.current?.disableRotation ?? false
    );

    if (phase === Phase.SLIDE && !availability.canSwipe) {
      pendingObstacleMergedTileIdsRef.current = [];
      finishSlideTurn();
      return;
    }

    if (phase === Phase.PLACE && availability.isGameOver) {
      setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
      if (isRewardInterstitialAdSupported() && !rewardInterstitialAdService.isAdReady()) {
        rewardInterstitialAdService.preloadAd();
      }
      // 모드별 세이브 정리
      if (gameModeRef.current === 'weekly_event') {
        pauseEventTimer();
        clearEventGameState();
      } else if (gameModeRef.current === 'daily_challenge') {
        clearDailyChallengeState();
      }
      // 게임오버 직전 최종 상태를 복기용 스냅샷에 추가
      setSnapshotHistory(prev => {
        const finalSnapshot: GameSnapshot = {
          grid: grid.map(row => row.map(tile => tile ? { ...tile } : null)),
          slots: slots.map(p => p ? { ...p, cells: [...p.cells] } : null),
          score,
          phase,
          canSkipSlide,
          obstacleState: cloneObstacleState(obstacleState),
          unlockedObstacleFeatures: [...unlockedObstacleFeatures],
        };
        const next = [...prev, finalSnapshot];
        if (next.length > MAX_SNAPSHOTS) {
          return next.slice(next.length - MAX_SNAPSHOTS);
        }
        return next;
      });
      const diagnosis = diagnoseGameOver(
        buildPlacementGridWithObstacles(grid, obstacleState),
        slots,
        eventRuleRef.current?.disableRotation ?? false
      );
      setGameOverReason(diagnosis);
      setGameState(GameState.GAME_OVER);
      // 이벤트 버스: 게임 오버 (activePlayDuration 사용 — 일시정지 시간 제외)
      const startedAt = activePlayStartedAtRef.current;
      const activeDurationMs = startedAt === null
        ? activePlayDurationMsRef.current
        : activePlayDurationMsRef.current + Math.max(0, Date.now() - startedAt);
      gameEventBus.emit('GAME_OVER', {
        score,
        mode: gameModeRef.current,
        boardSize: boardSizeRef.current,
        moves: moveCountRef.current,
        duration: Math.floor(activeDurationMs / 1000),
      });
      if (score > highScore) setHighScore(score);
    }
  }, [phase, grid, slots, gameState, score, highScore, isAnimating, finishSlideTurn, isReviveSelectionMode, pauseEventTimer, obstacleState, unlockedObstacleFeatures]);

  const refreshLiveRankEstimate = useCallback(async (force = false) => {
    if (gameStateRef.current !== GameState.PLAYING) return;
    if (gameModeRef.current !== 'normal') {
      setLiveRankEstimate(null);
      return;
    }

    const now = Date.now();
    if (!force && now < liveRankRetryAfterRef.current) return;
    if (!force && now - liveRankLastRequestAtRef.current < LIVE_RANK_MIN_REQUEST_INTERVAL_MS) return;

    if (liveRankRequestInFlightRef.current) {
      liveRankRequestQueuedRef.current = true;
      return;
    }

    liveRankRequestInFlightRef.current = true;
    liveRankLastRequestAtRef.current = now;
    const requestSequence = ++liveRankRequestSequenceRef.current;
    const requestedScore = scoreRef.current;
    const requestedDifficulty = String(boardSizeRef.current);

    try {
      const estimate = await rankingService.getLiveRankEstimate(requestedScore, requestedDifficulty);
      if (requestSequence !== liveRankRequestSequenceRef.current) return;

      liveRankFailureCountRef.current = 0;
      liveRankRetryAfterRef.current = 0;

      if (gameStateRef.current !== GameState.PLAYING) return;
      if (requestedScore !== scoreRef.current || requestedDifficulty !== String(boardSizeRef.current)) {
        liveRankRequestQueuedRef.current = true;
        return;
      }

      setLiveRankEstimate(estimate);
    } catch (error) {
      if (requestSequence !== liveRankRequestSequenceRef.current) return;

      liveRankFailureCountRef.current += 1;
      const cappedFailures = Math.min(liveRankFailureCountRef.current, 6);
      const backoffMs = Math.min(120_000, 5_000 * (2 ** (cappedFailures - 1)));
      liveRankRetryAfterRef.current = Date.now() + backoffMs;

      // 연속 3회 이상 실패 시 stale 데이터 제거 (오래된 순위가 계속 보이는 것 방지)
      if (liveRankFailureCountRef.current >= 3) {
        setLiveRankEstimate(null);
      }

      if (import.meta.env.DEV && liveRankFailureCountRef.current === 1) {
        console.warn('[랭킹 추정] 실시간 랭킹 조회 실패:', error);
      }
    } finally {
      liveRankRequestInFlightRef.current = false;
      if (liveRankRequestQueuedRef.current) {
        liveRankRequestQueuedRef.current = false;
        void refreshLiveRankEstimate();
      }
    }
  }, []);

  // --- 게임 중 예상 랭킹 업데이트 ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING || gameMode !== 'normal') {
      liveRankFailureCountRef.current = 0;
      liveRankRetryAfterRef.current = 0;
      liveRankLastRequestAtRef.current = 0;
      liveRankRequestInFlightRef.current = false;
      liveRankRequestQueuedRef.current = false;
      setLiveRankEstimate(null);
      return;
    }

    void refreshLiveRankEstimate(true);
    const intervalId = window.setInterval(() => {
      void refreshLiveRankEstimate();
    }, LIVE_RANK_POLL_INTERVAL_MS);
    const handleOnline = () => {
      void refreshLiveRankEstimate(true);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [gameMode, gameState, refreshLiveRankEstimate]);

  // 점수/난이도 변경 시 실제 랭킹 기준으로 빠르게 동기화
  useEffect(() => {
    if (gameState !== GameState.PLAYING || gameMode !== 'normal') return;

    const timeoutId = window.setTimeout(() => {
      void refreshLiveRankEstimate();
    }, LIVE_RANK_SCORE_SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boardSize, gameMode, gameState, score, refreshLiveRankEstimate]);

  const submitAutoRankProgress = useCallback(async (force = false) => {
    if (!force && gameStateRef.current !== GameState.PLAYING) return;
    if (gameModeRef.current === 'daily_challenge') return;

    const scoreNow = Math.max(0, Math.floor(scoreRef.current));
    if (scoreNow <= 0) return;

    const sessionId = sessionIdRef.current;
    if (autoRankSessionIdRef.current !== sessionId) {
      autoRankSessionIdRef.current = sessionId;
      autoRankLastSubmittedScoreRef.current = 0;
      autoRankLastSubmittedAtRef.current = 0;
    }

    const now = Date.now();
    const scoreDelta = scoreNow - autoRankLastSubmittedScoreRef.current;
    const elapsedSinceLast = now - autoRankLastSubmittedAtRef.current;
    const shouldSubmitByDelta = scoreDelta >= AUTO_RANK_SUBMIT_SCORE_DELTA_THRESHOLD;
    const shouldSubmitByInterval = scoreDelta > 0 && elapsedSinceLast >= AUTO_RANK_SUBMIT_FORCE_INTERVAL_MS;

    if (!force) {
      if (elapsedSinceLast < AUTO_RANK_SUBMIT_MIN_INTERVAL_MS) return;
      if (!shouldSubmitByDelta && !shouldSubmitByInterval) return;
    }

    if (autoRankSubmitInFlightRef.current) {
      autoRankSubmitQueuedRef.current = true;
      autoRankSubmitQueuedForceRef.current = autoRankSubmitQueuedForceRef.current || force;
      return;
    }

    autoRankSubmitInFlightRef.current = true;
    const requestSessionId = sessionId;
    const requestMode = gameModeRef.current;
    const safePlayerName =
      getReusablePlayerName(sessionLockedPlayerName) ??
      getReusablePlayerName(playerName) ??
      getReusablePlayerName(rankingService.getSavedName()) ??
      '익명';

    try {
      let succeeded = false;
      if (gameModeRef.current === 'weekly_event') {
        const eventResult = await submitEventScore({
          sessionId,
          name: safePlayerName,
          score: scoreNow,
          moves: moveCountRef.current,
          duration: toDurationSeconds(getCurrentEventPlayedMs()),
          attemptNumber: eventAttemptNumberRef.current,
          isIntermediate: true,
          isProgress: true,
          comboMultiplier: maxComboMultiplierRef.current,
          comboCount: maxComboCountRef.current,
        });
        succeeded = Boolean(eventResult.success);
      } else {
        const submitResult = await rankingService.submitProgressScore(
          sessionId,
          safePlayerName,
          scoreNow,
          `${boardSizeRef.current}x${boardSizeRef.current}`,
          getCurrentActiveDurationSeconds(),
          moveCountRef.current,
          getAnalyticsInstallId(),
          maxComboMultiplierRef.current,
          maxComboCountRef.current
        );
        succeeded = Boolean(submitResult.success);
      }

      if (requestSessionId !== sessionIdRef.current || requestMode !== gameModeRef.current) {
        return;
      }

      if (succeeded) {
        autoRankLastSubmittedScoreRef.current = scoreNow;
      }
      autoRankLastSubmittedAtRef.current = Date.now();
    } catch (error) {
      if (requestSessionId !== sessionIdRef.current || requestMode !== gameModeRef.current) {
        return;
      }
      autoRankLastSubmittedAtRef.current = Date.now();
      console.error('[AutoRank] progress submit failed', error);
    } finally {
      autoRankSubmitInFlightRef.current = false;
      if (autoRankSubmitQueuedRef.current) {
        const queuedForce = autoRankSubmitQueuedForceRef.current;
        autoRankSubmitQueuedRef.current = false;
        autoRankSubmitQueuedForceRef.current = false;
        void submitAutoRankProgress(queuedForce);
      }
    }
  }, [getCurrentActiveDurationSeconds, getCurrentEventPlayedMs, playerName, sessionLockedPlayerName]);

  useEffect(() => {
    submitAutoRankProgressRef.current = submitAutoRankProgress;
  }, [submitAutoRankProgress]);

  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      if (!autoRankSubmitInFlightRef.current) {
        autoRankSubmitQueuedRef.current = false;
        autoRankSubmitQueuedForceRef.current = false;
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void submitAutoRankProgress();
    }, AUTO_RANK_SUBMIT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameState, score, boardSize, gameMode, submitAutoRankProgress]);

  useEffect(() => {
    const handleOnline = () => {
      if (gameStateRef.current !== GameState.PLAYING) return;
      void submitAutoRankProgress(true);
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [submitAutoRankProgress]);


  // --- Render Helpers ---

  // 드래그 오버레이는 React 상태 갱신 대신 ref + transform으로 위치를 갱신해 지연을 줄인다.

  const renderDraggingPiece = () => {
    if (!draggingPiece) return null;

    const cells = draggingPiece.cells;
    const baseCellSize = boardMetricsRef.current?.cell ?? 32;
    const cellSize = baseCellSize * DRAG_OVERLAY_SCALE;
    const cellAppearance = resolveTileAppearance(draggingPiece.value);
    const dragPreviewRuntime = premiumSkinRuntime.dragPreview;
    const { minX, maxX, minY, maxY } = getPieceBounds(cells);
    const centerOffsetX = ((minX + maxX) / 2 + 0.5) * cellSize;
    const centerOffsetY = ((minY + maxY) / 2 + 0.5) * cellSize;

    return (
      <div
        ref={(el) => {
          dragOverlayRef.current = el;
          // 마운트 직후 초기 위치 설정 (깜빡임 방지)
          if (el && currentPointerPosRef.current) {
            const { x, y } = currentPointerPosRef.current;
            applyDragOverlayTransform(x, y);
          }
        }}
        className="fixed top-0 left-0 pointer-events-none z-50 opacity-90 will-change-transform"
        style={{
          marginTop: `-${centerOffsetY}px`,
          marginLeft: `-${centerOffsetX}px`,
        }}
      >
        <div className="relative">
          {cells.map((c, i) => (
            <div
              key={i}
              data-tile-kind="drag-overlay"
              className={`
                absolute rounded-lg
                ${dragPreviewRuntime.useResolvedAppearanceClass ? cellAppearance.className : ''}
              `}
              style={{
                left: c.x * cellSize,
                top: c.y * cellSize,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                ...(cellAppearance.style ?? {}),
                ...dragPreviewRuntime.cellStyle,
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const handleOpenNativeUpdateStore = useCallback(() => {
    if (!nativeUpdateRequirement) return;
    setIsOpeningUpdateStore(true);
    openNativeMarketForUpdate(nativeUpdateRequirement);
  }, [nativeUpdateRequirement]);

  // --- Views ---

  if (shouldShowPortraitLockOverlay) {
    return (
      <>
        <CookieConsent />
        <div className={`${isPremiumUiThemeActive ? premiumAppShellClassName : ''} min-h-screen min-h-[100dvh] flex items-center justify-center px-6 py-10 bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900`}>
          <div className={`w-full max-w-sm rounded-3xl border border-white/70 bg-white/80 backdrop-blur-sm shadow-xl p-8 text-center space-y-3 ${isPremiumUiThemeActive ? premiumModalWindowClassName : ''}`}>
            <div className="mx-auto w-14 h-14 rounded-2xl border border-gray-200 bg-white flex items-center justify-center text-2xl">
              📱
            </div>
            <h1 className="text-xl font-bold tracking-tight">{orientationLockMessage.title}</h1>
            <p className="text-sm text-gray-600 leading-relaxed">{orientationLockMessage.body}</p>
          </div>
        </div>
      </>
    );
  }

  if (nativeUpdateRequirement) {
    return (
      <>
        <NativeUpdateModal
          open
          requirement={nativeUpdateRequirement}
          isOpeningStore={isOpeningUpdateStore}
          onUpdateNow={handleOpenNativeUpdateStore}
        />
        <AnimatePresence mode="wait">
          {isLoading && <LoadingScreen key="loading-screen-update-gate" />}
        </AnimatePresence>
      </>
    );
  }

  // ========== 정적 페이지 라우팅 ==========
  if (currentRoute === '/privacy') {
    return (
      <>
        <CookieConsent />
        <PrivacyPolicy />
      </>
    );
  }
  if (currentRoute === '/terms') {
    return (
      <>
        <CookieConsent />
        <Terms />
      </>
    );
  }
  if (currentRoute === '/about') {
    return (
      <>
        <CookieConsent />
        <About />
      </>
    );
  }
  if (currentRoute === '/contact') {
    return (
      <>
        <CookieConsent />
        <Contact />
      </>
    );
  }
  if (currentRoute === '/admin-analytics') {
    return (
      <>
        <CookieConsent />
        <AdminAnalytics />
      </>
    );
  }

  const premiumUi = premiumUiOverrides;
  const premiumMenuRowContainerClassName =
    premiumUiObjects.panels.sunkenWhiteClassName
    || premiumUiObjects.panels.sunkenClassName
    || 'rounded-xl border border-gray-200 bg-white';
  const premiumMenuRowPrimaryButtonClassName =
    premiumUiObjects.buttons.gameClassName
    || premiumUiObjects.buttons.menuClassName
    || '';
  const premiumMenuRowSecondaryButtonClassName =
    premiumUiObjects.buttons.compartmentClassName
    || premiumUiObjects.buttons.gameClassName
    || premiumUiObjects.buttons.menuClassName
    || '';
  const premiumMenuRowContinueButtonClassName =
    `h-full w-10 shrink-0 flex items-center justify-center text-[17px] leading-none font-bold cursor-pointer ${premiumMenuRowSecondaryButtonClassName}`;
  const premiumMenuSelectedClassName =
    premiumUiObjects.panels.listItemHighlightClassName
    || 'font-bold';
  const premiumMutedTextClassForMenu = premiumMutedTextClassName || 'text-gray-600';

  // ========== MENU SCREEN ==========
  if (gameState === GameState.MENU) {
    const shouldSuppressGameModeTutorial = isMenuTutorialSuppressed({
      isNameInputOpen,
      isCustomizationOpen,
      isSkinOpen,
      isLeaderboardOpen,
      isStreakInfoOpen,
      isSeasonRewardOpen,
      isMissionModalOpen,
      isXpModalOpen,
      isCalendarOpen,
      isWeeklyEventModalOpen,
      isActiveGameExitModalOpen,
      showFirstSkinRewardModal,
    });

    const handleReplayTutorial = () => {
      clearOnboardingProgress();
      resetSequentialOnboarding();
      setSeqOnboardingStep(null);
      setSeqOnboardingIndex(0);
      setIsSeqOnboardingVisible(false);
      setTutorialResetKey(prev => prev + 1);
      setTutorialStep(1);
      const btn = document.getElementById('replay-tutorial-btn');
      if (btn) {
        btn.innerText = "✨ " + t('common:actions.resetDone', '리셋 완료!');
        setTimeout(() => {
          if (btn) btn.innerText = t('common:actions.replayTutorial', '튜토리얼 다시보기');
        }, 1500);
      }
    };

    const setLanguageFromMenu = (langCode: SupportedLanguage) => {
      i18n.changeLanguage(langCode);
      saveLanguageOverride(langCode);
    };

    const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
    const currentWeeklyEvent = getCurrentEvent();
    const currentWeeklyEventName = t(`game:weeklyEvent.events.${currentWeeklyEvent.eventType}.name` as any);
    const currentEventBannerTitle = t('game:weeklyEvent.newEventBanner' as any, { name: currentWeeklyEventName });
    const shouldShowCurrentEventBanner =
      isSequentialOnboardingCompleted() &&
      !hasParticipatedInCurrentEvent() &&
      !isCurrentEventBannerDismissed();

    const premiumWeeklyEventButton = (
      <div className={`w-full h-[52px] mb-3 ${premiumMenuRowContainerClassName}`}>
        <div className="flex h-full">
          <button
            id="weekly-event-btn"
            data-tutorial-anchor="weekly-event-btn"
            onClick={openWeeklyEventModal}
            className={`h-full flex-1 text-left font-bold px-4 flex items-center justify-between ${premiumMenuRowPrimaryButtonClassName}`}
          >
            <span>🎯 {t('game:weeklyEvent.menuButton')}</span>
            <span className={`text-sm font-normal ${premiumMutedTextClassForMenu}`}>
              {t('game:weeklyEvent.menuTag')}
            </span>
          </button>
          {hasActiveEventGame() && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                continueWeeklyEvent();
              }}
              className={premiumMenuRowContinueButtonClassName}
              aria-label={t('game:difficulties.continue')}
              title={t('game:difficulties.continue')}
            >
              <span>{'>'}</span>
            </button>
          )}
        </div>
      </div>
    );

    const activeNormalSize = getActiveNormalGameBoardSize();
    const premiumDifficultyRows = (
      <div className="flex flex-col gap-2 mt-2">
        {([
          { size: 4 as BoardSize, label: t('game:difficulties.expert'), sizeLabel: t('game:boardSizes.4x4'), emoji: '🔥' },
          { size: 5 as BoardSize, label: t('game:difficulties.normal'), sizeLabel: t('game:boardSizes.5x5'), emoji: '' },
          { size: 7 as BoardSize, label: t('game:difficulties.beginner'), sizeLabel: t('game:boardSizes.7x7'), emoji: '', id: 'mode-btn-beginner' },
          { size: 8 as BoardSize, label: t('game:difficulties.easy'), sizeLabel: t('game:boardSizes.8x8'), emoji: '' },
          { size: 10 as BoardSize, label: t('game:difficulties.infinite'), sizeLabel: t('game:boardSizes.10x10'), emoji: '' },
        ] as Array<{ size: BoardSize; label: string; sizeLabel: string; emoji: string; id?: string }>).map(mode => {
          const hasResume = activeNormalSize === mode.size;
          return (
            <div key={mode.size} className={`w-full h-[52px] ${premiumMenuRowContainerClassName}`}>
              <div className="flex h-full">
                <button
                  id={mode.id}
                  onClick={() => {
                    tryStartGame(mode.size);
                    if (mode.size === 7) localStorage.setItem(ONBOARDING_STORAGE_KEYS.gameModeTutorialSeen, 'true');
                  }}
                  className={`h-full flex-1 text-left font-bold px-4 flex items-center justify-between ${premiumMenuRowPrimaryButtonClassName}`}
                >
                  <span>{mode.emoji ? `${mode.emoji} ` : ''}{mode.label}</span>
                  <span className={`text-sm font-normal ${premiumMutedTextClassForMenu}`}>{mode.sizeLabel}</span>
                </button>
                {hasResume && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const saved = loadGameState();
                      if (saved) restoreSavedGame(saved);
                    }}
                    id="continue-btn"
                    className={premiumMenuRowContinueButtonClassName}
                    aria-label={t('game:difficulties.continue')}
                    title={t('game:difficulties.continue')}
                  >
                    <span>{'>'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

    const premiumUtilityButtons = (
      <fieldset className={premiumFieldsetClassName} style={{ marginTop: '16px' }}>
        <legend className="font-bold">{premiumUi?.utilityLegend ?? '메뉴'}</legend>
        <div className="flex flex-col gap-2 mt-2">
          <div className={`relative w-full h-[52px] ${premiumMenuRowContainerClassName}`}>
            <button
              data-tutorial-anchor="leaderboard-btn"
              className={`w-full h-full text-left font-bold px-4 flex items-center gap-2 ${premiumMenuRowPrimaryButtonClassName}`}
              onClick={openLeaderboardModal}
            >
              <Trophy size={16} />
              {t('modals:leaderboard.title')}
            </button>
          </div>

          <div className={`relative w-full h-[52px] ${premiumMenuRowContainerClassName}`}>
              <button
                className={`w-full h-full text-left font-bold px-4 flex items-center ${premiumMenuRowPrimaryButtonClassName}`}
                onClick={openStreakInfoModal}
                data-tutorial-anchor="streak-btn"
              >
                {todayAttended ? '🔥' : '🔥'} {t('common:streak.title')} ({streakCount})
              </button>
            </div>

          <div className={`relative w-full h-[52px] ${premiumMenuRowContainerClassName}`}>
            <button
              className={`w-full h-full text-left font-bold px-4 flex items-center ${premiumMenuRowPrimaryButtonClassName}`}
              onClick={openXpModal}
              data-tutorial-anchor="level-indicator"
            >
              ⭐ Lv.{xpLevel} ({xpPercent}%)
            </button>
          </div>

          <div className={`relative w-full h-[52px] ${premiumMenuRowContainerClassName}`}>
            <button
              className={`w-full h-full text-left font-bold px-4 flex items-center ${premiumMenuRowPrimaryButtonClassName}`}
              onClick={handleReplayTutorial}
            >
              ✨ {t('common:actions.replayTutorial', '튜토리얼 다시보기')}
            </button>
          </div>

          <fieldset className={premiumFieldsetClassName} style={{ marginTop: '12px' }}>
            <legend className="font-bold">{premiumUi?.languageLegend ?? '언어'}</legend>
            <div className="flex flex-col gap-2 mt-2">
              {(Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[]).map((langCode) => {
                const isSelected = currentLang === langCode;
                return (
                  <div key={langCode} className={`relative w-full h-[52px] ${premiumMenuRowContainerClassName}`}>
                    <button
                      className={`w-full h-full text-left px-4 flex items-center justify-between ${premiumMenuRowPrimaryButtonClassName} ${isSelected ? premiumMenuSelectedClassName : ''}`}
                      onClick={() => setLanguageFromMenu(langCode)}
                    >
                      <span className="font-bold">{LANGUAGE_CONFIGS[langCode].displayName} {LANGUAGE_CONFIGS[langCode].flag}</span>
                      {isSelected && <span className={`text-sm font-bold ${premiumMutedTextClassForMenu}`}>v</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
      </fieldset>
    );

    const menuActionButtons = (
      <>
        <AnimatePresence mode="wait">
          {isLoading && <LoadingScreen key="loading-screen-menu" />}
        </AnimatePresence>

        {DAILY_CHALLENGE_ENABLED && (
            <div className="relative w-full">
              <button
                onClick={startDailyChallenge}
                disabled={isDailyChallengeLoading}
                className={`
                relative group w-full py-4 px-6 rounded-2xl ${premiumMenuButtonClassName}
                bg-gradient-to-br from-amber-500 via-orange-500 to-red-500
                border border-amber-400/30
                shadow-lg shadow-orange-900/20
                hover:shadow-xl hover:shadow-orange-600/30 hover:-translate-y-0.5
                active:translate-y-0 active:shadow-md
                transition-all duration-200 ease-out
                text-white font-semibold text-lg
                ${isDailyChallengeLoading ? 'opacity-60 cursor-wait' : ''}
                ${hasActiveDailyChallenge() ? 'pr-14' : ''}
              `}
              >
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>🏆</span>
                    <span>{t('game:dailyChallenge.menuButton')}</span>
                  </span>
                  <span className={`${isPremiumUiThemeActive ? premiumMutedTextClassName : 'text-amber-200/70'} font-normal text-sm`}>5×5</span>
                </span>
              </button>
              {hasActiveDailyChallenge() && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const saved = loadDailyChallengeState();
                    if (saved) restoreSavedGame(saved);
                  }}
                  className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center
                    rounded-r-2xl border-l border-white/20
                    bg-white/10 hover:bg-white/25
                    transition-colors duration-150
                    text-white text-lg"
                  title={t('game:difficulties.continue')}
                >
                  ▶
                </button>
              )}
            </div>
            )}

        {/* 주간 이벤트 버튼 */}
            <div className="relative w-full">
              <button
                id="weekly-event-btn"
                data-tutorial-anchor="weekly-event-btn"
                onClick={openWeeklyEventModal}
                className={`
              relative group w-full py-4 px-6 rounded-2xl ${premiumMenuButtonClassName}
              bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500
              border border-purple-400/30
              shadow-lg shadow-purple-900/20
              hover:shadow-xl hover:shadow-purple-600/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-white font-semibold text-lg
              ${hasActiveEventGame() ? 'pr-14' : ''}
            `}
              >
                <span className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>🎯</span>
                    <span>{t('game:weeklyEvent.menuButton')}</span>
                  </span>
                  <span className={`${isPremiumUiThemeActive ? premiumMutedTextClassName : 'text-purple-200/70'} font-normal text-sm`}>
                    {t('game:weeklyEvent.menuTag')}
                  </span>
                </span>
              </button>
              {hasActiveEventGame() && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    continueWeeklyEvent();
                  }}
                  className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center
                  rounded-r-2xl border-l border-white/20
                  bg-white/10 hover:bg-white/25
                  transition-colors duration-150
                  text-white text-lg"
                  title={t('game:difficulties.continue')}
                >
                  ▶
                </button>
              )}
            </div>

        {([
          { size: 4 as BoardSize, label: t('game:difficulties.expert'), sizeLabel: t('game:boardSizes.4x4'), gradient: 'from-red-600 via-red-700 to-red-900', border: 'border-red-400/30', shadow: 'shadow-red-900/20', hoverShadow: 'hover:shadow-red-600/30', mutedColor: 'text-red-200/70' },
          { size: 5 as BoardSize, label: t('game:difficulties.normal'), sizeLabel: t('game:boardSizes.5x5'), gradient: 'from-blue-600 to-blue-700', border: 'border-blue-400/30', shadow: 'shadow-blue-900/20', hoverShadow: 'hover:shadow-blue-600/30', mutedColor: 'text-blue-200/70' },
          { size: 7 as BoardSize, label: t('game:difficulties.beginner'), sizeLabel: t('game:boardSizes.7x7'), gradient: 'from-indigo-600 to-indigo-800', border: 'border-indigo-400/30', shadow: 'shadow-indigo-900/20', hoverShadow: 'hover:shadow-indigo-600/30', mutedColor: 'text-indigo-200/70', id: 'mode-btn-beginner' },
          { size: 8 as BoardSize, label: t('game:difficulties.easy'), sizeLabel: t('game:boardSizes.8x8'), gradient: 'from-gray-800 to-gray-900', border: 'border-white/10', shadow: 'shadow-lg', hoverShadow: '', mutedColor: 'text-gray-400' },
          { size: 10 as BoardSize, label: t('game:difficulties.infinite'), sizeLabel: t('game:boardSizes.10x10'), gradient: 'from-neutral-900 to-black', border: 'border-white/10', shadow: 'shadow-lg', hoverShadow: '', mutedColor: 'text-gray-500' },
        ] as Array<{ size: BoardSize; label: string; sizeLabel: string; gradient: string; border: string; shadow: string; hoverShadow: string; mutedColor: string; id?: string }>).map((mode) => {
          const hasResume = getActiveNormalGameBoardSize() === mode.size;
          return (
            <div key={mode.size} className="relative w-full">
              <button
                id={mode.id}
                onClick={() => {
                  tryStartGame(mode.size);
                  if (mode.size === 7) localStorage.setItem(ONBOARDING_STORAGE_KEYS.gameModeTutorialSeen, 'true');
                }}
                className={`
                  relative group w-full py-4 px-6 rounded-2xl ${premiumMenuButtonClassName}
                  bg-gradient-to-br ${mode.gradient}
                  border ${mode.border}
                  shadow-lg ${mode.shadow}
                  hover:shadow-xl ${mode.hoverShadow} hover:-translate-y-0.5
                  active:translate-y-0 active:shadow-md
                  transition-all duration-200 ease-out
                  text-white font-semibold text-lg
                  ${hasResume ? 'pr-14' : ''}
                `}
              >
                <span className="flex items-center justify-between">
                  <span>{mode.label}</span>
                  <span className={`${isPremiumUiThemeActive ? premiumMutedTextClassName : mode.mutedColor} font-normal text-sm`}>{mode.sizeLabel}</span>
                </span>
              </button>
              {hasResume && (
                <button
                  id="continue-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const saved = loadGameState();
                    if (saved) restoreSavedGame(saved);
                  }}
                  className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center
                    rounded-r-2xl border-l border-white/20
                    bg-white/10 hover:bg-white/25
                    transition-colors duration-150
                    text-white text-lg"
                  title={t('game:difficulties.continue')}
                >
                  ▶
                </button>
              )}
            </div>
          );
        })}

        {/* XP/레벨 버튼 */}
        <button
          onClick={openXpModal}
          data-tutorial-anchor="level-indicator"
          className={`
          relative group w-full py-3.5 px-6 rounded-2xl ${premiumMenuButtonClassName}
          bg-white/60 backdrop-blur-sm
          border border-white/50
          shadow-lg
          hover:shadow-xl hover:-translate-y-0.5
          active:translate-y-0 active:shadow-md
          transition-all duration-200 ease-out
          text-gray-800 font-semibold text-base
          flex items-center justify-between
        `}
        >
          <span className="flex items-center gap-2">
            ⭐ Lv.{xpLevel}
          </span>
          <span className="text-gray-400 font-normal text-sm">
            <span className="inline-block w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden align-middle mr-1">
              <span className="block h-full bg-blue-500 rounded-full" style={{ width: `${xpPercent}%` }} />
            </span>
            {xpPercent}%
          </span>
        </button>

        {/* 출석/스트릭 버튼 (비프리미엄) */}
        {!isPremiumUiThemeActive && (
          <button
            onClick={openStreakInfoModal}
            data-tutorial-anchor="streak-btn"
            className={`
              w-full py-3.5 px-6 rounded-2xl ${premiumMenuButtonClassName}
              bg-white/40 backdrop-blur-sm
              border border-white/30
              text-gray-700 hover:text-gray-900
              hover:bg-white/60 hover:-translate-y-0.5
              active:translate-y-0 active:shadow-sm
              transition-all duration-200 ease-out
              shadow-sm
              text-sm font-semibold
              flex items-center justify-center gap-2
            `}
          >
            🔥 {t('common:streak.title')} ({streakCount})
          </button>
        )}

        {!isPremiumUiThemeActive && <LanguageSwitcher />}

        <button
          onClick={handleReplayTutorial}
          id="replay-tutorial-btn"
          className={`
            w-full py-3.5 px-6 rounded-2xl ${premiumMenuButtonClassName}
            bg-white/30 backdrop-blur-sm
            border border-white/20
            text-gray-600 hover:text-gray-900
            hover:bg-white/50 hover:-translate-y-0.5
            active:translate-y-0 active:shadow-sm
            transition-all duration-200 ease-out
            shadow-sm
            text-sm font-semibold
            flex items-center justify-center gap-2
          `}
        >
          <RotateCcw size={14} />
          {t('common:actions.replayTutorial', '튜토리얼 다시보기')}
        </button>
      </>
    );

    return (
      <>
        <CookieConsent />
        {comboMessage && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-[calc(12px+var(--ui-safe-top))] z-[120] w-max max-w-[92vw] -translate-x-1/2 rounded-2xl bg-stone-900 px-5 py-2.5 text-center text-[12px] font-semibold text-stone-100 shadow-2xl ring-1 ring-stone-600/70 whitespace-pre-line"
          >
            {comboMessage}
          </div>
        )}
        <div
          className={`${isPremiumUiThemeActive ? premiumAppShellClassName : ''} min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-6`}
          style={{
            paddingTop: 'calc(0.5rem + var(--ui-safe-top))',
            paddingBottom: isNative
              ? 'calc(var(--bottom-chrome-height, 80px) + 8px)'
              : '24px',
          }}
        >
          {/* 로고 영역 */}
          {isPremiumUiThemeActive ? (
            <div className={`${premiumWindowClassName} premium-home-window-surface w-full max-w-md animate-fade-in`}>
              <div className={`${premiumWindowBodyClassName} premium-home-window-body-surface text-center px-4 py-5`}>
                <h1 className="text-5xl font-bold tracking-tight leading-tight">
                  {(() => {
                    const titleText = String(t('game:title'));
                    const matched = titleText.match(/^(.*)\s\((.*)\)$/);
                    if (!matched) return titleText;
                    return (
                      <>
                        {matched[1]}
                        <br />
                        ({matched[2]})
                      </>
                    );
                  })()}
                </h1>
                <p className={`${premiumMutedTextClassForMenu} text-sm mt-2.5 leading-relaxed`}>
                  {tagline.split('\n').map((line, index, arr) => (
                    <React.Fragment key={`${line}-${index}`}>
                      {line}
                      {index < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 animate-fade-in">
              <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
                {t('game:title')}
              </h1>
              <p className="text-gray-500 text-lg max-w-xs mx-auto leading-relaxed">
                {tagline.split('\n').map((line, index, arr) => (
                  <React.Fragment key={`${line}-${index}`}>
                    {line}
                    {index < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            </div>
          )}

          {isPremiumUiThemeActive ? (
            <div className={`${premiumWindowClassName} premium-home-window-surface w-full max-w-md animate-slide-up ${premiumMenuWindowClassName}`}>
              <div className={premiumTitleBarClassName}>
                <div className={premiumTitleBarTextClassName}>{premiumUi?.menuWindowTitle ?? '난이도 선택'}</div>
                <div className={premiumTitleBarControlsClassName}>
                  <button aria-label="Close" onClick={() => setIsLeaderboardOpen(false)} />
                </div>
              </div>
              <div className={`${premiumWindowBodyClassName} premium-home-window-body-surface`}>
                <div className={`${premiumRadioGroupClassName} p-1`}>
                  {premiumWeeklyEventButton}
                  <fieldset className={premiumFieldsetClassName}>
                    <legend className="font-bold">{premiumUi?.difficultyLegend ?? '난이도 선택 메뉴'}</legend>
                    {premiumDifficultyRows}
                  </fieldset>
                  {premiumUtilityButtons}
                </div>

                {/* 주간이벤트 배너 (프리미엄) */}
                {shouldShowCurrentEventBanner && (
                  <div
                    onClick={() => { openWeeklyEventModal(); }}
                    className="relative mt-3 mx-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-2.5 text-white shadow-md cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissCurrentEventBanner(); }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      aria-label={t('game:weeklyEvent.bannerDismiss')}
                    >
                      <X size={14} />
                    </button>
                    <div className="flex items-start gap-2 pr-5 relative">
                      <span className="text-base shrink-0">🎯</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight">{currentEventBannerTitle}</p>
                        <p className="text-[10px] text-white/80 mt-0.5 leading-relaxed">
                          {t('game:weeklyEvent.newEventBannerSub' as any)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {isNativeApp() && hasParticipatedInPreviousEvent() && !hasClaimedEventReward() && !isRewardBannerDismissed() && (
                  <div
                    onClick={() => { openWeeklyEventModal(); }}
                    className="relative mt-3 mx-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 p-2.5 text-white shadow-md cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissRewardBanner(); }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      aria-label={t('game:weeklyEvent.bannerDismiss')}
                    >
                      <X size={14} />
                    </button>
                    <div className="flex items-start gap-2 pr-5 relative">
                      <span className="text-base shrink-0">🎁</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight">{t('game:weeklyEvent.rewardBanner')}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex justify-center">
                  <AppDownloadBanner isPremiumUiThemeActive={true} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
              {menuActionButtons}

              {/* 주간이벤트 배너: 새 이벤트 시작 + 미참여 */}
              {shouldShowCurrentEventBanner && (
                <div
                  onClick={() => { openWeeklyEventModal(); }}
                  className="relative w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-3 text-white shadow-md cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissCurrentEventBanner(); }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    aria-label={t('game:weeklyEvent.bannerDismiss')}
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-start gap-2 pr-5">
                    <span className="text-lg shrink-0">🎯</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{currentEventBannerTitle}</p>
                      <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
                        {t('game:weeklyEvent.newEventBannerSub' as any)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 주간이벤트 배너: 이전 주 보상 미수령 */}
              {isNativeApp() && hasParticipatedInPreviousEvent() && !hasClaimedEventReward() && !isRewardBannerDismissed() && (
                <div
                  onClick={() => { openWeeklyEventModal(); }}
                  className="relative w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 p-3 text-white shadow-md cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); dismissRewardBanner(); }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    aria-label={t('game:weeklyEvent.bannerDismiss')}
                  >
                    <X size={14} />
                  </button>
                  <div className="flex items-start gap-2 pr-5">
                    <span className="text-lg shrink-0">🎁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{t('game:weeklyEvent.rewardBanner')}</p>
                    </div>
                  </div>
                </div>
              )}

              <AppDownloadBanner isPremiumUiThemeActive={false} />
            </div>
          )}

          {/* 푸터 네비게이션 - 앱인토스에서는 숨김 (불필요한 영역 제거) */}
          {!isAppIntoS() && (
            <footer className="w-full max-w-md mt-4 pt-3 border-t border-gray-200">
              <nav className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
                <a href="#/about" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.about')}
                </a>
                <span className="text-gray-300">•</span>
                <a href="#/privacy" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.privacy')}
                </a>
                <span className="text-gray-300">•</span>
                <a href="#/terms" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.terms')}
                </a>
                <span className="text-gray-300">•</span>
                <a href="#/contact" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.contact')}
                </a>

                {isNative && (
                  <>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        openNativePrivacyOptionsForm().catch(() => {
                          // ignore
                        });
                      }}
                      className="hover:text-gray-900 transition-colors"
                    >
                      {t('common:footer.adPrivacy')}
                    </button>
                  </>
                )}
              </nav>
              <p className="text-center text-xs text-gray-400 mt-3">
                {t('common:footer.copyright')}
              </p>
            </footer>
          )}

          <AdBanner
            nativeBottomMarginPx={menuNativeBannerBottomMarginPx}
            reserveNativeSpace={!isNative}
            includeSafeBottomInReservedSpace={false}
            fixedPosition={isNative ? 'above-bottom-nav-no-safe' : undefined}
          />

          {isNative && (
            <BottomNavBar
              showSkin={isNativeApp()}
              showCustomization={!isNativeApp()}
              customizationLocked={!customizationGate.allowed}
              customizationLockReason={customizationGate.reasonKey ? t(customizationGate.reasonKey as any) : t('game:actions.locked')}
              dailyMissionCompleted={dailyMissionCompleted}
              calendarPendingCount={getCalendarItems().filter(i => !i.isCompleted).length}
              skinBadge={!isFirstScoreSkinRewardClaimed()}
              isPremiumUiThemeActive={isPremiumUiThemeActive}
              onSkinPress={openSkinModal}
              onCustomizationPress={openCustomizationModal}
              onLeaderboardPress={openLeaderboardModal}
              onMissionPress={openMissionModal}
              onCalendarPress={openCalendarModal}
              onHeightChange={setMenuBottomNavHeight}
            />
          )}

          <BlockCustomizationModal
            open={isCustomizationOpen}
            onClose={() => setIsCustomizationOpen(false)}
          />

          <SkinModal
            open={isSkinOpen}
            onClose={() => {
              setIsSkinOpen(false);
              setSkinModalAutoDraw(false);
              // 모달 닫힐 때 무료 뽑기 상태 리셋 (재진입 시 pending 상태 기반으로 다시 활성화)
              setSkinModalFreeDraw(false);
              startSequentialOnboardingAfterSkinTutorial();
            }}
            freeDraw={skinModalFreeDraw}
            autoDraw={skinModalAutoDraw}
            onFreeDrawUsed={(consumed) => {
              const shouldConsumeFirstReward = !isFirstScoreSkinRewardClaimed();
              if (shouldConsumeFirstReward) {
                trackAnalyticsEvent({
                  name: consumed ? 'first_skin_reward_consume_success' : 'first_skin_reward_consume_failure',
                });
              }
              if (!consumed) return;
              if (shouldConsumeFirstReward) {
                const claimPersisted = claimFirstScoreSkinReward();
                if (!claimPersisted) {
                  console.warn('[App] First-score reward claim persistence degraded to session-only latch.');
                }
                firstSkinRewardTriggeredRef.current = false;
              }
              setSkinModalFreeDraw(false);
            }}
          />

          <DailyLaunchModal
            open={isDailyLaunchModalOpen}
            onClose={() => setIsDailyLaunchModalOpen(false)}
            onGoToSkinDraw={handleDailyLaunchSkinDraw}
            onContinueGame={handleDailyLaunchContinueGame}
            onGoToMissions={handleDailyLaunchMissions}
            hasActiveGame={hasActiveEventGame() || getActiveNormalGameBoardSize() !== null}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            premiumWindowClassName={premiumWindowClassName}
            premiumWindowBodyClassName={premiumWindowBodyClassName}
            premiumTitleBarClassName={premiumTitleBarClassName}
            premiumTitleBarTextClassName={premiumTitleBarTextClassName}
            premiumTitleBarControlsClassName={premiumTitleBarControlsClassName}
            premiumModalWindowClassName={premiumModalWindowClassName}
            premiumPillButtonClassName={premiumPillButtonClassName}
            premiumGameButtonClassName={premiumGameButtonClassName}
          />

          <LeaderboardModal
            open={isLeaderboardOpen}
            onClose={() => setIsLeaderboardOpen(false)}
          />

          <NameInputModal
            open={isNameInputOpen}
            difficulty={pendingDifficulty}
            initialName={playerName || rankingService.getSavedName()}
            hasActiveGame={showActiveGameWarning}
            onClose={closeNameInputModal}
            onSubmit={handleNameSubmit}
          />

          {activeGameRankingSnapshot && (
            <ActiveGameExitModal
              open={isActiveGameExitModalOpen}
              context={activeGameExitContext}
              score={activeGameRankingSnapshot.score}
              difficulty={activeGameRankingSnapshot.difficulty}
              boardSize={activeGameRankingSnapshot.boardSize}
              duration={activeGameRankingSnapshot.duration}
              moves={activeGameRankingSnapshot.moves}
              sessionId={activeGameRankingSnapshot.sessionId}
              playerName={activeGameRankingSnapshot.playerName}
              lockedPlayerName={activeGameRankingSnapshot.sessionLockedPlayerName}
              isPremiumUiThemeActive={isPremiumUiThemeActive}
              gameMode={gameMode}
              eventAttemptNumber={eventAttemptNumberRef.current}
              onCancel={handleActiveGameExitCancel}
              onProceedWithoutRegister={handleActiveGameExitProceedWithoutRegister}
              onSessionNameLocked={handleActiveGameExitNameLocked}
              onRegisteredAndProceed={handleActiveGameExitRegisteredAndProceed}
              comboMultiplier={maxComboMultiplierRef.current}
              comboCount={maxComboCountRef.current}
            />
          )}

          <GameModeTutorial
            key={tutorialResetKey}
            enabled={activeOnboardingStep === 'menu-game-mode'}
            suppressed={shouldSuppressGameModeTutorial || activeOnboardingStep !== 'menu-game-mode'}
            onComplete={refreshMenuOnboardingStep}
            onSkip={refreshMenuOnboardingStep}
          />
          <SkinFeatureTutorial
            isEnabled={activeOnboardingStep === 'menu-skin-feature' && !shouldSuppressGameModeTutorial}
            onComplete={handleSkinFeatureTutorialComplete}
            onSkip={handleSkinFeatureTutorialSkip}
          />
          <SequentialOnboardingOverlay
            step={seqOnboardingStep}
            visible={
              isSeqOnboardingVisible
              && gameState === GameState.MENU
              && activeOnboardingStep === 'none'
              && !shouldSuppressGameModeTutorial
            }
            onAdvance={handleSeqOnboardingAdvance}
            onOpenFeature={handleSeqOpenFeature}
            index={seqOnboardingIndex}
            total={SEQUENTIAL_STEPS.length}
          />

          <StreakInfoModal
            open={isStreakInfoOpen}
            onClose={() => setIsStreakInfoOpen(false)}
          />

          <SeasonRewardModal
            open={isSeasonRewardOpen}
            rewards={seasonRewards}
            onClose={() => {
              setIsSeasonRewardOpen(false);
              markSeasonRewardsSeen(seasonRewards);
            }}
          />

          <MissionModal
            open={isMissionModalOpen}
            onClose={() => setIsMissionModalOpen(false)}
            onRewardClaimed={(fragments) => {
              showComboMessage(`✦ ${t('game:missions.rewardToast', { amount: fragments } as any)}`, 2500);
              setDailyMissionCompleted(getDailyCompletedCount());
            }}
          />

          <XpLevelModal
            open={isXpModalOpen}
            onClose={() => setIsXpModalOpen(false)}
            onSpecialRewardClaim={(reward) => {
              // FREE_DRAW: 무료 스킨 뽑기 수행 후 SkinModal 표시
              if (reward.startsWith('FREE_DRAW')) {
                const drawCount = reward === 'FREE_DRAW_5' ? 5 : 1;
                let newSkins = 0;
                let dupFragments = 0;
                // 연속 뽑기 동안 최신 보유 상태를 로컬 스냅샷으로 유지해 보상 누락을 방지한다.
                let drawSettings = loadSkinSettings();
                for (let i = 0; i < drawCount; i++) {
                  const result = drawSkin(drawSettings);
                  if (!result) continue;
                  if (result.type === 'new') {
                    addSkin(result.skin);
                    newSkins++;
                    drawSettings = {
                      ...drawSettings,
                      ownedSkins: [...drawSettings.ownedSkins, result.skin],
                    };
                  } else {
                    addFragments(result.fragmentsEarned);
                    dupFragments += result.fragmentsEarned;
                    drawSettings = {
                      ...drawSettings,
                      fragments: drawSettings.fragments + result.fragmentsEarned,
                    };
                  }
                }
                const msg = newSkins > 0
                  ? `🎰 ${t('common:xp.rewardClaimed' as any)} (+${newSkins} skin${newSkins > 1 ? 's' : ''})`
                  : `🎰 ${t('common:xp.rewardClaimed' as any)} (+${dupFragments} ✦)`;
                showComboMessage(msg, 2500);
                openSkinModal();
                return;
              }
              // SELECT_*: 교환용 조각 지급 후 SkinModal 오픈
              if (reward === 'SELECT_NORMAL_SKIN') {
                addFragments(FRAGMENT_COST_NORMAL);
                showComboMessage(`🎁 +${FRAGMENT_COST_NORMAL} ✦ — ${t('common:xp.rewardClaimed' as any)}`, 2500);
                openSkinModal();
              } else if (reward === 'SELECT_PREMIUM_SKIN' || reward === 'SELECT_PREMIUM_SKIN_AND_TITLE') {
                addFragments(FRAGMENT_COST_PREMIUM);
                showComboMessage(`🎁 +${FRAGMENT_COST_PREMIUM} ✦ — ${t('common:xp.rewardClaimed' as any)}`, 2500);
                openSkinModal();
              } else {
                showComboMessage(`🎁 ${t('common:xp.rewardClaimed' as any)}`, 2500);
              }
            }}
          />

          <CalendarModal
            open={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            onAction={(action) => {
              if (action === 'streak') openStreakInfoModal();
              else if (action === 'mission') openMissionModal();
              else if (action === 'daily_challenge') startDailyChallenge();
              else if (action === 'weekly_event') openWeeklyEventModal();
            }}
          />

          {/* 주간 이벤트 모달 — 메뉴 화면에서 접근 가능하도록 여기에 배치 */}
          <WeeklyEventModal
            isOpen={isWeeklyEventModalOpen}
            onClose={() => setIsWeeklyEventModalOpen(false)}
            onStartEvent={requestSessionNameForWeeklyEventStart}
            onContinueEvent={continueWeeklyEvent}
          />
        </div>
      </>
    );
  }

  const reviveDestroyCount = REVIVE_DESTROY_COUNT_BY_BOARD_SIZE[boardSize];
  const occupiedTileCount = countOccupiedTiles(grid);
  const isRotationDisabledByRule = Boolean(eventRuleRef.current?.disableRotation);
  const isUndoLockedByMode =
    gameMode === 'daily_challenge' ||
    (gameMode === 'weekly_event' && Boolean(eventRuleRef.current?.disableUndo));
  const isBlockRefreshLockedByMode =
    gameMode === 'daily_challenge' ||
    (gameMode === 'weekly_event' && Boolean(eventRuleRef.current?.disableBlockRefresh));
  const isReviveLockedByMode =
    gameMode === 'daily_challenge' ||
    (gameMode === 'weekly_event' && Boolean(eventRuleRef.current?.disableRevive));
  const canUseUndoRechargeAd = !isUndoLockedByMode && undoRemaining === 0 && isRewardAdSupported();
  const canOfferRevive =
    !isReviveLockedByMode &&
    isRewardInterstitialAdSupported() &&
    !hasUsedReviveThisRun &&
    occupiedTileCount > 0 &&
    !isReviveSelectionMode;
  const reviveSelectionHintKey = revivePendingTileId
    ? 'modals:gameOver.reviveSelectionConfirmHint'
    : 'modals:gameOver.reviveSelectionHint';

  const isPlacePhase = phase === Phase.PLACE;
  const isSwipePhase = phase === Phase.SLIDE;
  const isPlaceFocusMode = isPlacePhase;
  const isSwipeFocusMode = isSwipePhase;
  const focusSurfaceClass = 'drop-shadow-[0_22px_40px_rgba(15,23,42,0.18)]';
  const boardFocusSurfaceClass = (isPlaceFocusMode || isSwipeFocusMode)
    ? focusSurfaceClass
    : '';
  const undoFocusSurfaceClass = isSwipeFocusMode
    ? focusSurfaceClass
    : '';
  const slotFocusSurfaceClass = isPlaceFocusMode
    ? focusSurfaceClass
    : '';
  const slotVisibilityRuntime = premiumSkinRuntime.app.slotVisibility;
  const slotVisibilityClass = isAnimating
    ? slotVisibilityRuntime.animatingClassName
    : (isSwipeFocusMode
      ? slotVisibilityRuntime.swipeClassName
      : slotVisibilityRuntime.idleClassName);
  const phaseIndicatorInteractivityClass = isPlacePhase && !isReviveSelectionMode
    ? 'pointer-events-auto'
    : 'pointer-events-none opacity-35 grayscale select-none';
  const shouldShowRankingSyncNotice =
    gameState === GameState.PLAYING &&
    score > 0 &&
    (gameMode === 'normal' || gameMode === 'weekly_event');
  const rankingSyncNotice = String(t(
    isNetworkOnline ? 'game:liveRank.autoSaveNotice' : 'game:liveRank.autoSaveWhenOnlineNotice',
    {
      defaultValue: isNetworkOnline
        ? '[!점수는 자동저장됩니다!]'
        : '[!점수는 인터넷 연결 시에 반영됩니다!]',
    } as any,
  ));
  const availableMainHeightPx = Math.max(180, viewportSize.height - layoutChromeHeights.header - Math.max(layoutChromeHeights.footer, STABLE_BANNER_RESERVE_PX));
  const isGameHeaderCompact =
    viewportSize.height <= 720 ||
    viewportSize.width <= 360 ||
    availableMainHeightPx < 500;

  // 모드 알리미(phase) 상태 기반 포커스:
  // - PLACE: 보드 + 슬롯 강조
  // - SLIDE: 보드 + Undo 강조 (슬롯은 비강조)
  const isSlotPointerLocked = isSwipePhase || isAnimating || isReviveSelectionMode;
  const isSlotDisabled = isAnimating || isReviveSelectionMode;
  const shouldShowBlockRefreshAdCta =
    !isBlockRefreshLockedByMode &&
    showBlockRefreshAdButton &&
    blockRefreshRemaining <= 0;
  const currentLevelBadge = getHighestLevelBadgeForLevel(xpLevel);
  const isBlockRefreshButtonDisabled =
    isBlockRefreshLockedByMode ||
    isAnimating ||
    isReviveSelectionMode ||
    Boolean(draggingPiece);
  const gameplayTutorialBlocked = getIsGameplayTutorialBlocked({
    isPlayingState: gameState === GameState.PLAYING,
    showHelpModal,
    showFirstSkinRewardModal,
  });

  // ========== GAME SCREEN ==========
  return (
    <>
      <CookieConsent />
      {comboMessage && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-[calc(12px+var(--ui-safe-top))] z-[120] w-max max-w-[92vw] -translate-x-1/2 rounded-2xl bg-stone-900 px-5 py-2.5 text-center text-[12px] font-semibold text-stone-100 shadow-2xl ring-1 ring-stone-600/70 whitespace-pre-line"
        >
          {comboMessage}
        </div>
      )}
      <div
        className={`${isPremiumUiThemeActive ? premiumAppShellClassName : ''} min-h-screen min-h-[100dvh] flex flex-col items-center text-gray-900 touch-none`}
        onPointerDown={handleScreenPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* 상단 크롬 래퍼: safe-area + 이벤트/데일리 배너 + 헤더를 하나로 측정 */}
        <div ref={headerRef} className="w-full flex flex-col items-center shrink-0" style={{ paddingTop: 'var(--game-safe-top)' }}>

          {/* 데일리 챌린지 배너 */}
          {gameMode === 'daily_challenge' && (
            <div
              className="w-full text-center py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white text-xs font-bold tracking-wide"
              style={{
                maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
              }}
            >
              🏆 {t('game:dailyChallenge.banner')}
            </div>
          )}

          {/* 주간 이벤트 배너 */}
          {gameMode === 'weekly_event' && eventRuleRef.current && (
            <div
              className="w-full text-center py-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2"
              style={{
                maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
              }}
            >
              <span>{t(`game:weeklyEvent.events.${eventRuleRef.current.type}.name`)}</span>
              {eventTimerDisplay && (
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] tabular-nums">
                  ⏱ {eventTimerDisplay}
                </span>
              )}
              <span className="text-[10px] opacity-80">
                {String(t('game:weeklyEvent.tags.attempts', { current: eventAttemptNumberRef.current, max: 3 } as any))}
              </span>
            </div>
          )}

          {/* Header */}
          <header
            className={`w-full flex justify-between items-center ${isGameHeaderCompact ? 'px-3 pb-1.5' : 'px-4 pb-2'} ${isPremiumUiThemeActive ? premiumGameHeaderClassName : ''}`}
            style={{
              maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
              // safe-top은 상단 래퍼가 일괄 담당하므로 헤더는 내부 여백만 설정
              paddingTop: isGameHeaderCompact ? (isPremiumUiThemeActive ? '6px' : '10px') : (isPremiumUiThemeActive ? '8px' : '16px'),
              // 보드와의 간격을 줄이기 위해 헤더 하단 여백을 공통값으로 고정
              paddingBottom: isGameHeaderCompact ? '6px' : '10px',
              // 앱인토스: 우측 상단 공통 내비게이션 영역 확보
              paddingRight: 'calc(16px + var(--appintos-nav-safe-right))'
            }}
          >
            <div className={`flex items-center ${isGameHeaderCompact ? 'gap-2' : 'gap-3'} min-w-0`}>
              {/* Home Button */}
              <button
                type="button"
                onClick={handleHomeButtonClick}
                disabled={isAnimating}
                className={`
                  ${isGameHeaderCompact ? 'p-2' : 'p-2.5'} rounded-full flex items-center justify-center ${premiumIconButtonClassName}
              border shadow-sm transition-all duration-200
              ${isAnimating
                    ? 'bg-gray-100/50 text-gray-300 border-gray-200/50 cursor-not-allowed'
                    : 'bg-white/70 hover:bg-white text-gray-700 border-white/50 hover:shadow-md active:scale-95'
                  }
            `}
                aria-label={t('common:aria.home')}
              >
                <Home size={18} />
              </button>
              <div className="space-y-0.5 min-w-0">
                <h2 className={`${isGameHeaderCompact ? 'text-[11px] flex-nowrap min-w-0' : 'text-sm flex-wrap'} font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5`}>
                  {t('common:labels.score')}
                  {gameMode === 'normal' && liveRankEstimate !== null && gameState === GameState.PLAYING
                    && score > 0 && liveRankEstimate.totalEntries >= 2 && (
                      <span className={isGameHeaderCompact ? 'text-[10px] font-semibold text-blue-600 whitespace-nowrap truncate' : 'text-xs font-semibold text-blue-600'}>
                        {String(t('game:liveRank.estimatedRank', { rank: liveRankEstimate.rank } as any))}
                      </span>
                    )}
                </h2>
                <p className={`${isGameHeaderCompact ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900 tabular-nums leading-none`}>{score}</p>
                {currentLevelBadge && (
                  <p className={isGameHeaderCompact ? 'text-[10px] font-semibold text-purple-600 whitespace-nowrap truncate' : 'text-xs font-semibold text-purple-600'}>
                    {currentLevelBadge.emoji} Lv.{currentLevelBadge.level}
                  </p>
                )}
                {gameMode === 'normal' && liveRankEstimate !== null && gameState === GameState.PLAYING
                  && score > 0 && liveRankEstimate.totalEntries >= 2 && (
                    <>
                      <p className={isGameHeaderCompact ? 'text-[10px] font-semibold text-blue-500 whitespace-nowrap truncate' : 'text-xs font-semibold text-blue-500'}>
                        {liveRankEstimate.pointsToNext > 0
                          ? String(t('game:liveRank.pointsToNext', { points: liveRankEstimate.pointsToNext } as any))
                          : t('game:liveRank.topRank')}
                      </p>
                    </>
                  )}
                {shouldShowRankingSyncNotice && (
                  <p className={isGameHeaderCompact ? 'max-w-[150px] text-[10px] font-semibold text-emerald-600 whitespace-nowrap truncate' : 'text-[10px] font-semibold text-emerald-600'}>
                    {rankingSyncNotice}
                  </p>
                )}
              </div>
            </div>
            <div className={`flex flex-col items-end ${isGameHeaderCompact ? 'gap-1.5' : 'gap-2'} transition-opacity duration-200 shrink-0`}>
              {/* Phase Indicator - Glass Pill - 고정 폭으로 레이아웃 안정화 */}
              <div className={`
            ${isGameHeaderCompact ? 'px-3 py-1.5 text-xs min-w-[82px] gap-1.5' : 'px-4 py-2 text-sm min-w-[100px] gap-2'} rounded-full font-semibold flex items-center justify-center ${premiumPillButtonClassName}
            ${isPremiumUiThemeActive ? premiumHeaderMainButtonClassName : ''}
            transition-all duration-200 ease-out
            ${phaseIndicatorInteractivityClass}
            ${isPlacePhase
                  ? 'bg-emerald-50/90 backdrop-blur-sm border border-emerald-200/90 text-emerald-700 shadow-sm'
                  : 'bg-slate-100/90 backdrop-blur-sm border border-slate-300/80 text-slate-700 shadow-sm'
                }
          `}
                aria-disabled={!isPlacePhase}
                tabIndex={isPlacePhase ? 0 : -1}
              >
                {isPlacePhase ? t('game:phases.place') : t('game:phases.swipe')}
                {isSwipePhase && <Move size={14} />}
              </div>

              {/* Help & Undo Buttons - Same Row */}
              <div className={`flex items-center ${isGameHeaderCompact ? 'gap-1.5' : 'gap-2'}`}>
                {/* Help Button */}
                <button
                  type="button"
                  onClick={openHelpModal}
                  disabled={isReviveSelectionMode}
                  className={`
                  ${isGameHeaderCompact ? 'p-1.5' : 'p-2'} rounded-full text-gray-600 ${premiumIconButtonClassName} ${isPremiumUiThemeActive ? premiumHeaderIconButtonClassName : ''}
                  flex items-center justify-center leading-none
                  bg-white/70 hover:bg-white border border-white/50
                  shadow-sm hover:shadow-md transition-all duration-200 active:scale-95
                  ${(isSwipeFocusMode || isReviveSelectionMode) ? 'opacity-35 grayscale pointer-events-none select-none' : ''}
                `}
                  aria-label={t('common:aria.help')}
                >
                  <HelpCircle size={18} className="block" />
                </button>

                {/* Undo / Recharge Button (single slot) */}
                <button
                  id="game-undo-btn"
                  type="button"
                  data-premium-ui-allow-gradient="true"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={canUseUndoRechargeAd ? handleWatchRewardAd : executeUndo}
                  disabled={
                    canUseUndoRechargeAd
                      ? (isAnimating || isReviveSelectionMode)
                      : (isUndoLockedByMode || !lastSnapshot || undoRemaining <= 0 || isAnimating || isReviveSelectionMode)
                  }
                  aria-label={
                    canUseUndoRechargeAd
                      ? t('game:rewardAd.watchButtonFull')
                      : t('game:actions.undo')
                  }
                  className={`
                ${isGameHeaderCompact ? 'px-2.5 py-1 gap-1.5' : 'px-3 py-1.5 gap-2'} rounded-full text-xs font-semibold flex items-center justify-center ${premiumGameButtonClassName} ${isPremiumUiThemeActive ? premiumHeaderActionButtonClassName : ''}
                border shadow-sm transition-all duration-200
                ${undoFocusSurfaceClass}
                pointer-events-auto
                ${canUseUndoRechargeAd
                      ? `bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-yellow-400/50 shadow-md active:scale-95 ${isSwipeFocusMode ? 'opacity-35 grayscale pointer-events-none select-none' : ''} ${(isAnimating || isReviveSelectionMode) ? 'opacity-50 cursor-not-allowed' : 'hover:from-yellow-600 hover:to-amber-600 hover:shadow-lg'}`
                      : (isUndoLockedByMode || !lastSnapshot || undoRemaining <= 0 || isAnimating || isReviveSelectionMode)
                        ? 'bg-gray-100/50 text-gray-300 border-gray-200/50 cursor-not-allowed'
                        : 'bg-white/70 hover:bg-white text-gray-700 border-white/50 hover:shadow-md active:scale-95'
                    }
              `}
                >
                  {canUseUndoRechargeAd ? (
                    <>
                      <span>📺</span>
                      <span>{t('game:rewardAd.watchButton')}</span>
                    </>
                  ) : (
                    <>
                      <Undo2 size={14} />
                      <span className="tabular-nums">{undoRemaining}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </header>
        </div>{/* /상단 크롬 래퍼 */}

        {/* Main Game Area */}
        <main
          className="flex-1 w-full flex flex-col items-center justify-start min-h-0 p-4"
          style={{
            maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
            gap: `${gameLayoutProfile.mainGapPx}px`,
            paddingTop: `${gameLayoutProfile.mainTopPaddingPx}px`,
            paddingBottom: `${gameLayoutProfile.mainBottomPaddingPx}px`,
            boxSizing: 'border-box'
          }}
        >

          {isReviveSelectionMode && (
            <div className="w-full rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[12px] text-amber-900 shadow-sm">
              <p className="font-semibold">
                {String(t('modals:gameOver.reviveSelectionStatus', { remaining: reviveBreakRemaining } as any))}
              </p>
              <p className="mt-1 text-[11px] text-amber-800/80">
                {String(t(reviveSelectionHintKey))}
              </p>
            </div>
          )}

          <div className={`
            transition-shadow duration-200 w-full flex items-center justify-center
            ${boardFocusSurfaceClass}
          `}>
            {isPremiumUiThemeActive ? (
              <div
                className={`game-mode-focus-shell game-mode-focus-board ${premiumWindowClassName} ${premiumGameBoardWindowClassName} w-full max-w-[520px]`}
                data-game-phase={phase}
                data-focus-family={premiumSkinRuntime.family}
              >
                <div className={`${premiumWindowBodyClassName} ${premiumGameBoardBodyClassName} relative`}>
                  <ComboIndicator comboCount={comboCount} timerMs={comboTimerMs} isActive={isComboActive} multiplier={comboMultiplierRef.current} />
                  <Board
                    ref={boardHandleRef}
                    htmlId="game-board"
                    grid={grid}
                    obstacleState={obstacleState}
                    phase={phase}
                    activePiece={draggingPiece}
                    boardRef={boardRef}
                    mergingTiles={mergingTiles}
                    portalReleaseAnimations={portalReleaseAnimations}
                    valueOverrides={tileValueOverrides}
                    boardScale={boardScale}
                    reviveSelectionEnabled={isReviveSelectionMode}
                    revivePendingTileId={revivePendingTileId}
                    onReviveTileTap={handleReviveTileTap}
                    reviveDestroyEffects={reviveDestroyEffects}
                    mergedNumberBurstTileIds={mergedNumberBurstTileIds}
                    mergedNumberBurstByTileId={mergedNumberBurstByTileId}
                  />
                </div>
              </div>
            ) : (
              <div
                className="game-mode-focus-shell game-mode-focus-board relative"
                data-game-phase={phase}
                data-focus-family="default"
              >
                <ComboIndicator comboCount={comboCount} timerMs={comboTimerMs} isActive={isComboActive} multiplier={comboMultiplierRef.current} />
                <Board
                  ref={boardHandleRef}
                  htmlId="game-board"
                  grid={grid}
                  obstacleState={obstacleState}
                  phase={phase}
                  activePiece={draggingPiece}
                  boardRef={boardRef}
                  mergingTiles={mergingTiles}
                  portalReleaseAnimations={portalReleaseAnimations}
                  valueOverrides={tileValueOverrides}
                  boardScale={boardScale}
                  reviveSelectionEnabled={isReviveSelectionMode}
                  revivePendingTileId={revivePendingTileId}
                  onReviveTileTap={handleReviveTileTap}
                  reviveDestroyEffects={reviveDestroyEffects}
                  mergedNumberBurstTileIds={mergedNumberBurstTileIds}
                  mergedNumberBurstByTileId={mergedNumberBurstByTileId}
                />
              </div>
            )}
          </div>


          {/* Inventory Slots */}
          <div className={`
          game-mode-focus-shell game-mode-focus-slots w-full grid grid-cols-3 gap-4
          transition-shadow duration-200
          ${slotFocusSurfaceClass}
          ${isSlotPointerLocked ? 'pointer-events-none' : ''}
          ${slotVisibilityClass}
        `}
            data-game-phase={phase}
            data-focus-family={premiumSkinRuntime.family}
          >
            {slots.map((p, i) => (
              <Slot
                key={p ? p.id : i}
                index={i}
                piece={p}
                htmlId={i === 0 ? 'slot-0' : undefined}
                onPointerDown={handlePointerDown}
                onRotate={rotateSlotPiece}
                rotationDisabled={isRotationDisabledByRule}
                isPressed={pressedSlotIndex === i}
                disabled={isSlotDisabled}
              />
            ))}
          </div>

          <div className="w-full min-h-10 flex items-center justify-center relative">
            {blockRefreshNotice && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute -top-11 left-1/2 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-full bg-gray-900/90 px-3 py-1.5 text-center text-[11px] font-medium text-white shadow-lg backdrop-blur-sm whitespace-pre-line"
              >
                {blockRefreshNotice}
              </div>
            )}
            {shouldShowBlockRefreshAdCta ? (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleWatchBlockRefreshAd}
                disabled={isBlockRefreshButtonDisabled || isBlockRefreshAdInProgress}
                className={`
                  inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold ${premiumGameButtonClassName}
                  border transition-all duration-200
                  ${(isBlockRefreshButtonDisabled || isBlockRefreshAdInProgress)
                    ? 'bg-gray-100/60 text-gray-400 border-gray-200/80 cursor-not-allowed'
                    : 'bg-gray-200/85 text-gray-700 border-gray-300/85 shadow-sm hover:bg-gray-300/90 hover:shadow-md'}
                `}
              >
                <span>{t('game:blockRefresh.ad.watchButton')}</span>
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleRefreshPreviewBlocks}
                disabled={isBlockRefreshButtonDisabled}
                className={`
                  inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold ${premiumGameButtonClassName}
                  border transition-all duration-200
                  ${isBlockRefreshButtonDisabled
                    ? 'bg-gray-100/60 text-gray-400 border-gray-200/80 cursor-not-allowed'
                    : 'bg-white/80 text-gray-700 border-white/70 shadow-sm hover:bg-white hover:shadow-md'}
                `}
              >
                <span>{t('game:blockRefresh.refreshButton')}</span>
              </button>
            )}

            <button
              type="button"
              data-rotate-button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isRotationDisabledByRule) return;
                if (!draggingPiece) return;
                rotateActivePiece();
              }}
              className={`
                absolute right-0 inline-flex items-center justify-center
                w-9 h-9 rounded-full ${premiumIconButtonClassName}
                bg-white/80 border border-white/70
                text-gray-700 shadow-sm
                hover:bg-white
                transition-colors
                ${draggingPiece && !isRotationDisabledByRule ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
              `}
              aria-label={t('common:aria.rotateBlock')}
              aria-hidden={!draggingPiece || isRotationDisabledByRule}
              tabIndex={draggingPiece && !isRotationDisabledByRule ? 0 : -1}
            >
              <RotateCw size={16} />
            </button>
          </div>

        </main>

        {gameState !== GameState.GAME_OVER && (
          <>
            {!gameplayTutorialBlocked && <TutorialOverlay step={tutorialStep} />}
            <GameFeaturesTutorial
              tutorialStep={tutorialStep}
              blocked={gameplayTutorialBlocked}
            />
          </>
        )}
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
        {activeObstacleUnlock && (
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-2xl border border-white/70 bg-white p-5 text-gray-900 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 transition active:scale-95"
                aria-label="방해요소 자세히 보기"
                onClick={() => setShowObstacleUnlockDetails((prev) => !prev)}
              >
                <HelpCircle size={17} />
              </button>
              <div className="mb-2 pr-10 text-xs font-bold text-rose-500">
                새 방해요소가 열렸어요
              </div>
              <div className="flex items-center gap-4 pr-8">
                <ObstacleExampleBlock feature={activeObstacleUnlock} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black leading-tight">
                    {OBSTACLE_UNLOCK_COPY[activeObstacleUnlock].title}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-snug text-gray-700">
                    {OBSTACLE_UNLOCK_COPY[activeObstacleUnlock].summary}
                  </p>
                </div>
              </div>
              {showObstacleUnlockDetails && (
                <div className="mt-4 space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-xs font-semibold leading-5 text-gray-700">
                  <p>{OBSTACLE_UNLOCK_COPY[activeObstacleUnlock].role}</p>
                  <p>{OBSTACLE_UNLOCK_COPY[activeObstacleUnlock].clear}</p>
                  <p>
                    지금 점수 기준으로 이 요소는 약 {formatObstacleChance(activeObstacleUnlockChance?.featureChance ?? 0)}로 떠요.
                  </p>
                  <p>{OBSTACLE_UNLOCK_COPY[activeObstacleUnlock].chanceNote} 안 뜨면 다음 스와이프에서 확률이 조금 올라가요.</p>
                  {(activeObstacleUnlockChance?.activeObstacleCount ?? 0) >= 2 && (
                    <p>방해요소가 2개 있으면 새로 생기지 않아요.</p>
                  )}
                </div>
              )}
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.99]"
                onClick={() => {
                  setShowObstacleUnlockDetails(false);
                  setObstacleUnlockQueue((prev) => prev.slice(1));
                }}
              >
                알겠어요
              </button>
            </div>
          </div>
        )}

        {/*
          In-game ad lane

          The game layout reserves this lane with STABLE_BANNER_RESERVE_PX. Do not
          reintroduce footer DOM measurement into boardScale calculations: web AdSense
          and native ad SDKs may resize after load/orientation changes, while the board
          must remain stable for every skin and device shape.
        */}
        <div className="w-full shrink-0">
          <div className={`
          w-full transition-opacity duration-200
          ${isSwipeFocusMode ? 'opacity-20 pointer-events-none' : 'opacity-100'}
        `}>
            <AdBanner
              includeSafeBottomInReservedSpace={true}
              webLayout="compact-banner"
              webReservedHeightPx={STABLE_BANNER_RESERVE_PX}
            />
          </div>
        </div>

        {/* Dragging Overlay */}
        {renderDraggingPiece()}

        {/* Game Over Modal */}
        {gameState === GameState.GAME_OVER && !isReviewMode && (
          <GameOverModal
            sessionId={sessionIdRef.current}
            score={score}
            difficulty={`${boardSize}x${boardSize}`}
            boardSize={boardSize}
            duration={gameMode === 'weekly_event'
              ? toDurationSeconds(getCurrentEventPlayedMs())
              : getCurrentActiveDurationSeconds()}
            moves={moveCountRef.current}
            playerName={playerName}
            lockedPlayerName={sessionLockedPlayerName}
            canOfferRevive={canOfferRevive}
            reviveDestroyCount={reviveDestroyCount}
            isReviveAdReady={isReviveAdReady}
            isReviveInProgress={isReviveAdInProgress}
            onWatchReviveAd={handleWatchReviveAd}
            onSessionNameLocked={handleActiveGameExitNameLocked}
            onClose={handleGameOverClose}
            onReview={handleEnterReviewMode}
            hasReviewSnapshots={snapshotHistory.length > 0}
            gameMode={gameMode}
            challengeDate={challengeDateRef.current ?? undefined}
            eventAttemptNumber={eventAttemptNumberRef.current}
            onViewRankings={handleGameOverViewRankings}
            gameOverReason={gameOverReason}
            comboMultiplier={maxComboMultiplierRef.current}
            comboCount={maxComboCountRef.current}
          />
        )}

        {/* 복기(Review) 모드 */}
        {gameState === GameState.GAME_OVER && isReviewMode && snapshotHistory.length > 0 && (
          <div className="fixed inset-0 z-50 flex flex-col items-center bg-white">
            {/* 상단 헤더 */}
            <div
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0"
              style={{ paddingTop: 'calc(12px + var(--game-safe-top))' }}
            >
              <span className="text-sm font-semibold text-gray-700">
                {t('modals:gameOver.reviewGame')} ({reviewIndex + 1}/{snapshotHistory.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReviewGoHome}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 active:scale-95 transition-all"
                >
                  {t('modals:gameOver.goHome', '홈으로')}
                </button>
                <button
                  onClick={handleReviewOpenRankings}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 active:scale-95 transition-all"
                >
                  {t('modals:gameOver.viewRankings', '랭킹보기')}
                </button>
                <button
                  onClick={handleExitReviewMode}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 active:scale-95 transition-all"
                >
                  {t('modals:gameOver.close', '닫기')}
                </button>
              </div>
            </div>

            {/* 보드 표시 (읽기 전용) */}
            <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
              <div className="w-full max-w-[420px]">
                <Board
                  htmlId="review-board"
                  grid={snapshotHistory[reviewIndex].grid}
                  obstacleState={snapshotHistory[reviewIndex].obstacleState}
                  phase={snapshotHistory[reviewIndex].phase}
                  activePiece={null}
                  boardRef={boardRef}
                  mergingTiles={EMPTY_MERGING_TILES}
                  boardScale={boardScale}
                  readonly={true}
                />
              </div>
            </div>

            {/* 하단 네비게이션 */}
            <div className="w-full flex items-center justify-center gap-6 py-4 border-t border-gray-200 shrink-0">
              <button
                onClick={() => setReviewIndex(prev => Math.max(0, prev - 1))}
                disabled={reviewIndex === 0}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                ← {t('modals:gameOver.reviewPrev', '이전')}
              </button>
              <span className="text-sm font-semibold text-gray-500 tabular-nums">
                {reviewIndex + 1} / {snapshotHistory.length}
              </span>
              <button
                onClick={() => setReviewIndex(prev => Math.min(snapshotHistory.length - 1, prev + 1))}
                disabled={reviewIndex === snapshotHistory.length - 1}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {t('modals:gameOver.reviewNext', '다음')} →
              </button>
            </div>
          </div>
        )}

        {/* ── 최초 50점 돌파 무료 스킨 뽑기권 모달 ── */}
        {showFirstSkinRewardModal && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mx-4 w-full max-w-sm rounded-3xl bg-white/95 backdrop-blur-md p-6 text-center shadow-2xl"
            >
              <div className="mb-3 text-4xl">🎁</div>
              <h2 className="text-lg font-extrabold text-gray-900">
                {t('game:firstSkinReward.title' as any)}
              </h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {t('game:firstSkinReward.description' as any)}
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-base font-bold text-white shadow-lg active:scale-[0.97] transition-transform"
                  onClick={handleGoToSkinDraw}
                >
                  {t('game:firstSkinReward.goToDraw' as any)}
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 active:bg-gray-200 transition-colors"
                  onClick={handleFirstSkinRewardLater}
                >
                  {t('common:actions.later' as any)}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {activeGameRankingSnapshot && (
          <ActiveGameExitModal
            open={isActiveGameExitModalOpen}
            context={activeGameExitContext}
            score={activeGameRankingSnapshot.score}
            difficulty={activeGameRankingSnapshot.difficulty}
            boardSize={activeGameRankingSnapshot.boardSize}
            duration={activeGameRankingSnapshot.duration}
            moves={activeGameRankingSnapshot.moves}
            sessionId={activeGameRankingSnapshot.sessionId}
            playerName={activeGameRankingSnapshot.playerName}
            lockedPlayerName={activeGameRankingSnapshot.sessionLockedPlayerName}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            gameMode={gameMode}
            eventAttemptNumber={eventAttemptNumberRef.current}
            onCancel={handleActiveGameExitCancel}
            onProceedWithoutRegister={handleActiveGameExitProceedWithoutRegister}
            onSessionNameLocked={handleActiveGameExitNameLocked}
            onRegisteredAndProceed={handleActiveGameExitRegisteredAndProceed}
            comboMultiplier={maxComboMultiplierRef.current}
            comboCount={maxComboCountRef.current}
          />
        )}
      </div>
      <AnimatePresence mode="wait">
        {isLoading && <LoadingScreen key="loading-screen-game" />}
      </AnimatePresence>
    </>
  );
};

export default App;
