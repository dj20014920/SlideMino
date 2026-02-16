/**
 * 스킨 컬렉션 서비스
 * - 스킨 저장/로드 (localStorage)
 * - 미보유 스킨 랜덤 뽑기
 * - 컬렉션 완성 여부 체크
 * - 에뮬레이터 테스트 모드 (모든 스킨 잠금 해제)
 */

import { SKIN_CATALOG } from '../constants';
import type { SkinItem, SkinSettings } from '../types';
import { isEmulator } from '../utils/deviceDetection';

const SKIN_STORAGE_KEY = 'slidemino.skin.v2';

export const DEFAULT_SKIN_SETTINGS: SkinSettings = {
  version: 2,
  ownedSkins: [],
  activeSkinId: null,
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

    const activeSkinId =
      typeof obj.activeSkinId === 'string' && ownedSkins.some(s => s.id === obj.activeSkinId)
        ? obj.activeSkinId
        : null;

    return { version: 2, ownedSkins, activeSkinId };
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
 * 미보유 스킨 중 하나를 랜덤 선택하여 SkinItem 생성.
 * 모든 스킨 보유 시 null 반환.
 */
export const pickRandomSkin = (settings: SkinSettings): SkinItem | null => {
  const ownedIds = new Set(settings.ownedSkins.map(s => s.id));
  const unowned = SKIN_CATALOG.filter(entry => !ownedIds.has(entry.id));

  if (unowned.length === 0) return null;

  const picked = unowned[Math.floor(Math.random() * unowned.length)];
  return {
    id: picked.id,
    hex: picked.hex,
    acquiredAt: Date.now(),
  };
};

/**
 * 컬렉션 완성 여부 (카탈로그의 모든 스킨을 보유)
 */
export const isCollectionComplete = (settings: SkinSettings): boolean => {
  return settings.ownedSkins.length >= SKIN_CATALOG.length;
};

/**
 * 🧪 테스트 모드: 에뮬레이터/시뮬레이터에서 모든 스킨 잠금 해제
 * 
 * @returns 에뮬레이터인 경우 카탈로그의 모든 스킨을 owned로 반환
 */
export const getAllSkinsUnlockedForEmulator = async (): Promise<SkinItem[] | null> => {
  const isEmulatorEnv = await isEmulator();
  if (!isEmulatorEnv) return null;

  // 에뮬레이터에서는 모든 스킨을 소유한 것으로 처리
  return SKIN_CATALOG.map(entry => ({
    id: entry.id,
    hex: entry.hex,
    acquiredAt: 0, // 테스트 모드 표시용
  }));
};

/**
 * 🧪 테스트 모드: 에뮬레이터에서 스킨 보유 여부 확인
 * 
 * @returns 에뮬레이터이면 항상 true, 아니면 실제 보유 여부
 */
export const isSkinOwned = async (skinId: string, settings: SkinSettings): Promise<boolean> => {
  const isEmulatorEnv = await isEmulator();
  if (isEmulatorEnv) return true;
  
  return settings.ownedSkins.some(s => s.id === skinId);
};
