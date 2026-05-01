/**
 * 스킨 컬렉션 서비스
 * - 스킨 저장/로드 (localStorage)
 * - 가중치 랜덤 뽑기 (프리미엄 = 확률 절반)
 * - 중복 뽑기 → 스킨 조각 지급
 * - 조각으로 스킨 교환
 */

import { SKIN_CATALOG, FRAGMENTS_PER_DUPLICATE, FRAGMENT_COST_NORMAL, FRAGMENT_COST_PREMIUM } from '../constants';
import type { SkinItem, SkinSettings, SkinDrawResult } from '../types';
import { gameEventBus } from './gameEventBus';

const SKIN_STORAGE_KEY = 'slidemino.skin.v3';
const SKIN_STORAGE_BACKUP_KEY = 'slidemino.skin.v3.backup';
const LEGACY_SKIN_STORAGE_KEY = 'slidemino.skin.v2';
const SKIN_SETTINGS_ENVELOPE_TAG = 'skin-settings-envelope-v1';

type SkinSettingsEnvelope = {
  tag: typeof SKIN_SETTINGS_ENVELOPE_TAG;
  checksum: string;
  savedAt: number;
  settings: unknown;
};

export const DEFAULT_SKIN_SETTINGS: SkinSettings = {
  version: 2,
  ownedSkins: [],
  activeSkinId: null,
  fragments: 0,
  scoreMilestoneCredits: 0,
  daily1024Date: '',
  daily1024Earned: 0,
};

// 유효한 hex 색상인지 검증
const isValidHex = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
};

// 저장된 스킨 데이터를 검증하여 안전하게 파싱
const sanitizeSkinItem = (raw: unknown): SkinItem | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return null;
  if (!isValidHex(obj.hex)) return null;
  if (typeof obj.acquiredAt !== 'number' || !Number.isFinite(obj.acquiredAt)) return null;
  return { id: obj.id, hex: obj.hex, acquiredAt: obj.acquiredAt };
};

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const computeChecksum = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const normalizeSkinSettings = (parsed: unknown): SkinSettings | null => {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 2) return null;

  // Removed skin ID → replacement ID migration map.
  // When a skin is removed from the catalog, existing users who owned it
  // are transparently migrated to the closest surviving counterpart.
  const REMOVED_SKIN_MIGRATION: Record<string, string> = {
    skin_1: 'skin_0',   // basicCoralPunch → basicCherryPop
    skin_18: 'skin_19', // basicVioletFlash → basicPurpleRush
    skin_22: 'skin_23', // basicRoseDash → basicRedCore
  };

  const ownedSkins: SkinItem[] = [];
  const validCatalogIds = new Set(SKIN_CATALOG.map((entry) => entry.id));
  const seenSkinIds = new Set<string>();
  if (Array.isArray(obj.ownedSkins)) {
    for (const item of obj.ownedSkins) {
      const sanitized = sanitizeSkinItem(item);
      if (!sanitized) continue;

      // Migrate removed skin IDs to their replacement
      const migratedId = REMOVED_SKIN_MIGRATION[sanitized.id] ?? sanitized.id;
      if (!validCatalogIds.has(migratedId)) continue;
      if (seenSkinIds.has(migratedId)) continue;
      seenSkinIds.add(migratedId);

      // Preserve original acquiredAt; use replacement skin's hex from catalog
      const replacementEntry = SKIN_CATALOG.find(e => e.id === migratedId);
      ownedSkins.push({
        id: migratedId,
        hex: replacementEntry?.hex ?? sanitized.hex,
        acquiredAt: sanitized.acquiredAt,
      });
    }
  }

  const activeSkinId =
    typeof obj.activeSkinId === 'string' &&
    ownedSkins.some(s => s.id === obj.activeSkinId)
      ? obj.activeSkinId
      : null;

  const fragments =
    typeof obj.fragments === 'number' && Number.isFinite(obj.fragments)
      ? Math.max(0, Math.floor(obj.fragments))
      : 0;

  const scoreMilestoneCredits =
    typeof obj.scoreMilestoneCredits === 'number' && Number.isFinite(obj.scoreMilestoneCredits)
      ? Math.max(0, Math.floor(obj.scoreMilestoneCredits))
      : 0;

  const daily1024Date =
    typeof obj.daily1024Date === 'string' ? obj.daily1024Date : '';
  const daily1024Earned =
    typeof obj.daily1024Earned === 'number' && Number.isFinite(obj.daily1024Earned)
      ? Math.max(0, Math.floor(obj.daily1024Earned))
      : 0;

  return { version: 2, ownedSkins, activeSkinId, fragments, scoreMilestoneCredits, daily1024Date, daily1024Earned };
};

const buildEnvelope = (settings: SkinSettings): SkinSettingsEnvelope => {
  const serializedSettings = JSON.stringify(settings);
  return {
    tag: SKIN_SETTINGS_ENVELOPE_TAG,
    checksum: computeChecksum(serializedSettings),
    savedAt: Date.now(),
    settings,
  };
};

const parseEnvelope = (raw: string | null): SkinSettings | null => {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const envelope = parsed as Record<string, unknown>;
    if (envelope.tag !== SKIN_SETTINGS_ENVELOPE_TAG) return null;
    if (typeof envelope.checksum !== 'string') return null;
    if (envelope.settings === undefined) return null;

    const serializedSettings = JSON.stringify(envelope.settings);
    if (computeChecksum(serializedSettings) !== envelope.checksum) return null;

    return normalizeSkinSettings(envelope.settings);
  } catch {
    return null;
  }
};

const saveEnvelope = (settings: SkinSettings): boolean => {
  const envelopeRaw = JSON.stringify(buildEnvelope(settings));
  const legacyRaw = JSON.stringify(settings);
  const primarySaved = safeSetItem(SKIN_STORAGE_KEY, envelopeRaw);
  if (!primarySaved) return false;

  // 백업/레거시는 best-effort
  safeSetItem(SKIN_STORAGE_BACKUP_KEY, envelopeRaw);
  safeSetItem(LEGACY_SKIN_STORAGE_KEY, legacyRaw);
  return true;
};

export const loadSkinSettings = (): SkinSettings => {
  const primary = parseEnvelope(safeGetItem(SKIN_STORAGE_KEY));
  if (primary) return primary;

  const backup = parseEnvelope(safeGetItem(SKIN_STORAGE_BACKUP_KEY));
  if (backup) {
    saveEnvelope(backup);
    return backup;
  }

  try {
    const legacyRaw = safeGetItem(LEGACY_SKIN_STORAGE_KEY);
    if (!legacyRaw) return DEFAULT_SKIN_SETTINGS;
    const legacyParsed: unknown = JSON.parse(legacyRaw);
    const legacySettings = normalizeSkinSettings(legacyParsed);
    if (!legacySettings) return DEFAULT_SKIN_SETTINGS;

    saveEnvelope(legacySettings);
    return legacySettings;
  } catch {
    return DEFAULT_SKIN_SETTINGS;
  }
};

export const saveSkinSettings = (settings: SkinSettings): boolean => {
  return saveEnvelope(settings);
};

/**
 * 가중치 랜덤 스킨 뽑기.
 * - 일반 스킨: 가중치 2, 프리미엄 스킨: 가중치 1 (확률 절반)
 * - 보유 스킨이 뽑히면 → 중복 → 스킨 조각 지급
 * - 미보유 스킨이 뽑히면 → 새 스킨 획득
 */
export const drawSkin = (settings: SkinSettings): SkinDrawResult | null => {
  if (SKIN_CATALOG.length === 0) return null;

  const ownedIds = new Set(settings.ownedSkins.map(s => s.id));
  const totalWeight = SKIN_CATALOG.reduce(
    (sum, entry) => sum + (entry.premium ? 1 : 2), 0,
  );

  let roll = Math.random() * totalWeight;
  for (const entry of SKIN_CATALOG) {
    roll -= entry.premium ? 1 : 2;
    if (roll <= 0) {
      if (ownedIds.has(entry.id)) {
        return { type: 'duplicate', skin: entry, fragmentsEarned: FRAGMENTS_PER_DUPLICATE };
      }
      return { type: 'new', skin: { id: entry.id, hex: entry.hex, acquiredAt: Date.now() } };
    }
  }

  // 안전장치 (부동소수점 오차 방지)
  const last = SKIN_CATALOG[SKIN_CATALOG.length - 1];
  if (ownedIds.has(last.id)) {
    return { type: 'duplicate', skin: last, fragmentsEarned: FRAGMENTS_PER_DUPLICATE };
  }
  return { type: 'new', skin: { id: last.id, hex: last.hex, acquiredAt: Date.now() } };
};

/**
 * 스킨 교환에 필요한 조각 수 (일반: 15, 프리미엄: 50)
 */
export const getFragmentCost = (skinId: string): number => {
  const entry = SKIN_CATALOG.find(e => e.id === skinId);
  if (!entry) return Infinity;
  return entry.premium ? FRAGMENT_COST_PREMIUM : FRAGMENT_COST_NORMAL;
};

/**
 * 컬렉션 완성 여부 (카탈로그의 모든 스킨을 보유)
 */
export const isCollectionComplete = (settings: SkinSettings): boolean => {
  const validCatalogIds = new Set(SKIN_CATALOG.map((entry) => entry.id));
  const ownedCount = new Set(
    settings.ownedSkins
      .map((skin) => skin.id)
      .filter((id) => validCatalogIds.has(id))
  ).size;
  return ownedCount >= SKIN_CATALOG.length;
};

/**
 * 스킨 조각 추가 — 이벤트 버스를 통해 Context에 위임.
 * 직접 localStorage를 쓰지 않아 Context의 debounced save와 경합하지 않습니다.
 */
// ── First-score skin reward (최초 50점 달성 보상) ──
const FIRST_SCORE_REWARD_KEY = 'slidemino.first_score_skin_reward';
const FIRST_SCORE_REWARD_BACKUP_KEY = `${FIRST_SCORE_REWARD_KEY}.backup`;
const FIRST_SCORE_REWARD_SESSION_KEY = `${FIRST_SCORE_REWARD_KEY}.session`;
const FIRST_SCORE_REWARD_SHOWN_KEY = `${FIRST_SCORE_REWARD_KEY}.shown`;
const FIRST_SCORE_REWARD_SHOWN_BACKUP_KEY = `${FIRST_SCORE_REWARD_SHOWN_KEY}.backup`;
const FIRST_SCORE_REWARD_SHOWN_SESSION_KEY = `${FIRST_SCORE_REWARD_SHOWN_KEY}.session`;
const FIRST_SCORE_REWARD_PENDING_KEY = `${FIRST_SCORE_REWARD_KEY}.pending`;
const FIRST_SCORE_REWARD_PENDING_BACKUP_KEY = `${FIRST_SCORE_REWARD_PENDING_KEY}.backup`;
const FIRST_SCORE_REWARD_PENDING_SESSION_KEY = `${FIRST_SCORE_REWARD_PENDING_KEY}.session`;
const CLAIMED_REWARD_VALUE = 'claimed';
const SHOWN_REWARD_VALUE = 'shown';
const PENDING_REWARD_VALUE = 'pending';
let firstScoreRewardClaimedMemoryLatch = false;
let firstScoreRewardShownMemoryLatch = false;
let firstScoreRewardPendingMemoryLatch = false;

const getStorage = (kind: 'local' | 'session'): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch (error) {
    console.warn('[skinService] Failed to access storage layer', { kind, error });
    return null;
  }
};

const readStorageFlag = (
  storage: Storage | null,
  key: string,
  expectedValue: string = CLAIMED_REWARD_VALUE
): boolean => {
  if (!storage) return false;
  try {
    return storage.getItem(key) === expectedValue;
  } catch (error) {
    console.warn('[skinService] Failed to read reward flag', { key, error });
    return false;
  }
};

const writeStorageFlag = (
  storage: Storage | null,
  key: string,
  value: string = CLAIMED_REWARD_VALUE
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('[skinService] Failed to write reward flag', { key, error });
    return false;
  }
};

/** 최초 50점 스킨 보상 노출 여부(모달 표시) 확인 */
export function isFirstScoreSkinRewardShown(): boolean {
  if (firstScoreRewardShownMemoryLatch) return true;

  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');

  const sessionShown = readStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SHOWN_SESSION_KEY, SHOWN_REWARD_VALUE);
  const primaryShown = readStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_KEY, SHOWN_REWARD_VALUE);
  const backupShown = readStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_BACKUP_KEY, SHOWN_REWARD_VALUE);
  const shown = sessionShown || primaryShown || backupShown || isFirstScoreSkinRewardClaimed();
  if (!shown) return false;

  firstScoreRewardShownMemoryLatch = true;

  if (!sessionShown) {
    writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SHOWN_SESSION_KEY, SHOWN_REWARD_VALUE);
  }
  if (!primaryShown) {
    writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_KEY, SHOWN_REWARD_VALUE);
  }
  if (!backupShown) {
    writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_BACKUP_KEY, SHOWN_REWARD_VALUE);
  }

  return true;
}

/** 최초 50점 스킨 보상 노출 처리 (1회) */
export function markFirstScoreSkinRewardShown(): boolean {
  firstScoreRewardShownMemoryLatch = true;

  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');

  const sessionSaved = writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SHOWN_SESSION_KEY, SHOWN_REWARD_VALUE);
  const primarySaved = writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_KEY, SHOWN_REWARD_VALUE);
  const backupSaved = writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_BACKUP_KEY, SHOWN_REWARD_VALUE);
  const persistSucceeded = primarySaved || backupSaved;

  if (!persistSucceeded) {
    console.warn('[skinService] Reward shown-state could not be persisted to localStorage; session latch only.', {
      sessionSaved,
    });
  }

  return persistSucceeded || sessionSaved;
}

/** 최초 50점 스킨 보상이 대기 상태인지 확인 (무료 뽑기 미소비) */
export function isFirstScoreSkinRewardPending(): boolean {
  if (isFirstScoreSkinRewardClaimed()) return false;
  if (firstScoreRewardPendingMemoryLatch) return true;

  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');

  const sessionPending = readStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_PENDING_SESSION_KEY, PENDING_REWARD_VALUE);
  const primaryPending = readStorageFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_KEY, PENDING_REWARD_VALUE);
  const backupPending = readStorageFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_BACKUP_KEY, PENDING_REWARD_VALUE);

  const pending = sessionPending || primaryPending || backupPending;
  if (!pending) return false;

  firstScoreRewardPendingMemoryLatch = true;

  if (!sessionPending) {
    writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_PENDING_SESSION_KEY, PENDING_REWARD_VALUE);
  }
  if (!primaryPending) {
    writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_KEY, PENDING_REWARD_VALUE);
  }
  if (!backupPending) {
    writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_BACKUP_KEY, PENDING_REWARD_VALUE);
  }

  return true;
}

/** 최초 50점 스킨 보상 대기 상태 설정 */
export function setFirstScoreSkinRewardPending(pending: boolean): boolean {
  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');

  if (!pending) {
    firstScoreRewardPendingMemoryLatch = false;
    const removeFlag = (storage: Storage | null, key: string): boolean => {
      if (!storage) return false;
      try {
        storage.removeItem(key);
        return true;
      } catch (error) {
        console.warn('[skinService] Failed to clear reward pending flag', { key, error });
        return false;
      }
    };

    const sessionCleared = removeFlag(sessionStorageRef, FIRST_SCORE_REWARD_PENDING_SESSION_KEY);
    const primaryCleared = removeFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_KEY);
    const backupCleared = removeFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_BACKUP_KEY);
    const persistSucceeded = primaryCleared || backupCleared;

    if (!persistSucceeded) {
      console.warn('[skinService] Reward pending-state clear degraded to session-only latch.', {
        sessionCleared,
      });
    }
    return persistSucceeded || sessionCleared;
  }

  firstScoreRewardPendingMemoryLatch = true;
  const sessionSaved = writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_PENDING_SESSION_KEY, PENDING_REWARD_VALUE);
  const primarySaved = writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_KEY, PENDING_REWARD_VALUE);
  const backupSaved = writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_PENDING_BACKUP_KEY, PENDING_REWARD_VALUE);
  const persistSucceeded = primarySaved || backupSaved;

  if (!persistSucceeded) {
    console.warn('[skinService] Reward pending-state could not be persisted to localStorage; session latch only.', {
      sessionSaved,
    });
  }

  return persistSucceeded || sessionSaved;
}

/** 최초 50점 스킨 보상을 이미 수령했는지 확인 */
export function isFirstScoreSkinRewardClaimed(): boolean {
  if (firstScoreRewardClaimedMemoryLatch) return true;

  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');

  const sessionClaimed = readStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SESSION_KEY);
  const primaryClaimed = readStorageFlag(localStorageRef, FIRST_SCORE_REWARD_KEY);
  const backupClaimed = readStorageFlag(localStorageRef, FIRST_SCORE_REWARD_BACKUP_KEY);

  const claimed = sessionClaimed || primaryClaimed || backupClaimed;
  if (!claimed) return false;

  firstScoreRewardClaimedMemoryLatch = true;

  // best-effort self-healing (손상/부분실패 복구)
  if (!sessionClaimed) {
    writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SESSION_KEY);
  }
  if (!primaryClaimed) {
    writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_KEY);
  }
  if (!backupClaimed) {
    writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_BACKUP_KEY);
  }

  return true;
}

/** 최초 50점 스킨 보상을 수령 처리 (되돌릴 수 없음) */
export function claimFirstScoreSkinReward(): boolean {
  firstScoreRewardClaimedMemoryLatch = true;
  firstScoreRewardShownMemoryLatch = true;
  firstScoreRewardPendingMemoryLatch = false;

  const localStorageRef = getStorage('local');
  const sessionStorageRef = getStorage('session');

  const sessionSaved = writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SESSION_KEY);
  const primarySaved = writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_KEY);
  const backupSaved = writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_BACKUP_KEY);
  setFirstScoreSkinRewardPending(false);
  writeStorageFlag(sessionStorageRef, FIRST_SCORE_REWARD_SHOWN_SESSION_KEY, SHOWN_REWARD_VALUE);
  writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_KEY, SHOWN_REWARD_VALUE);
  writeStorageFlag(localStorageRef, FIRST_SCORE_REWARD_SHOWN_BACKUP_KEY, SHOWN_REWARD_VALUE);
  const persistSucceeded = primarySaved || backupSaved;

  if (!persistSucceeded) {
    console.warn('[skinService] Reward claim could not be persisted to localStorage; session latch only.', {
      sessionSaved,
    });
  }

  return persistSucceeded || sessionSaved;
}

export const addFragments = (amount: number, source: string = 'unknown'): void => {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return;
  gameEventBus.emit('FRAGMENTS_ADDED', { amount: safeAmount, source });
};

/**
 * 스킨 조각 영속 추가
 * - load → 가산 → save 성공 시에만 FRAGMENTS_ADDED 이벤트 발행
 */
export const addFragmentsPersisted = (amount: number, source: string = 'unknown'): boolean => {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return false;

  const current = loadSkinSettings();
  const next: SkinSettings = {
    ...current,
    fragments: Math.max(0, Math.floor(current.fragments + safeAmount)),
  };

  const saved = saveSkinSettings(next);
  if (!saved) return false;

  gameEventBus.emit('FRAGMENTS_ADDED', { amount: safeAmount, source });
  return true;
};

/**
 * 스킨 조각 영속 차감
 * - load → 차감 → save 성공 시에만 FRAGMENTS_ADDED(음수) 이벤트 발행
 */
export const deductFragmentsPersisted = (amount: number, source: string = 'unknown'): boolean => {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return false;

  const current = loadSkinSettings();
  if (current.fragments < safeAmount) return false;

  const next: SkinSettings = {
    ...current,
    fragments: Math.max(0, Math.floor(current.fragments - safeAmount)),
  };

  const saved = saveSkinSettings(next);
  if (!saved) return false;

  gameEventBus.emit('FRAGMENTS_ADDED', { amount: -safeAmount, source });
  return true;
};
