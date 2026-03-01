/**
 * 스킨 컬렉션 서비스
 * - 스킨 저장/로드 (localStorage)
 * - 가중치 랜덤 뽑기 (프리미엄 = 확률 절반)
 * - 중복 뽑기 → 스킨 조각 지급
 * - 조각으로 스킨 교환
 */

import { SKIN_CATALOG, FRAGMENTS_PER_DUPLICATE, FRAGMENT_COST_NORMAL, FRAGMENT_COST_PREMIUM } from '../constants';
import type { SkinItem, SkinSettings, SkinDrawResult } from '../types';

const SKIN_STORAGE_KEY = 'slidemino.skin.v2';

export const DEFAULT_SKIN_SETTINGS: SkinSettings = {
  version: 2,
  ownedSkins: [],
  activeSkinId: null,
  fragments: 0,
  scoreMilestoneCredits: 0,
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

export const loadSkinSettings = (): SkinSettings => {
  try {
    const raw = localStorage.getItem(SKIN_STORAGE_KEY);
    if (!raw) return DEFAULT_SKIN_SETTINGS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SKIN_SETTINGS;

    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 2) return DEFAULT_SKIN_SETTINGS;

    const ownedSkins: SkinItem[] = [];
    if (Array.isArray(obj.ownedSkins)) {
      for (const item of obj.ownedSkins) {
        const sanitized = sanitizeSkinItem(item);
        if (sanitized) ownedSkins.push(sanitized);
      }
    }

    // activeSkinId: 보유 중인 스킨일 때만 유지
    const activeSkinId =
      typeof obj.activeSkinId === 'string' &&
      ownedSkins.some(s => s.id === obj.activeSkinId)
        ? obj.activeSkinId
        : null;

    // fragments: 기존 데이터에 없으면 0으로 초기화 (하위 호환)
    const fragments =
      typeof obj.fragments === 'number' && Number.isFinite(obj.fragments)
        ? Math.max(0, Math.floor(obj.fragments))
        : 0;

    const scoreMilestoneCredits =
      typeof obj.scoreMilestoneCredits === 'number' && Number.isFinite(obj.scoreMilestoneCredits)
        ? Math.max(0, Math.floor(obj.scoreMilestoneCredits))
        : 0;

    return { version: 2, ownedSkins, activeSkinId, fragments, scoreMilestoneCredits };
  } catch {
    return DEFAULT_SKIN_SETTINGS;
  }
};

export const saveSkinSettings = (settings: SkinSettings): void => {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage 저장 실패는 무시 (용량 초과/private mode)
  }
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
 * 스킨 교환에 필요한 조각 수 (일반: 10, 프리미엄: 30)
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
  return settings.ownedSkins.length >= SKIN_CATALOG.length;
};

/**
 * 스킨 조각 추가 (데일리 챌린지 보상 등)
 */
export const addFragments = (amount: number): void => {
  const settings = loadSkinSettings();
  settings.fragments += Math.max(0, Math.floor(amount));
  saveSkinSettings(settings);
};
