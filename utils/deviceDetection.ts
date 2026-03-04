/**
 * 디바이스 환경 감지 유틸리티
 * - 에뮬레이터/시뮬레이터 감지
 * - 개발용 자동 해금 분기
 */

import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

let cachedIsEmulator: boolean | null = null;
let cachedIsDevDevice: boolean | null = null;
let cachedShouldAutoUnlockAllSkinsForDev: boolean | null = null;

// 본인 개발 에뮬레이터 식별자 allowlist
// 필요 시 .env.local 에 VITE_DEV_EMULATOR_IDS="ID1,ID2" 형태로 추가 가능
const BASE_DEV_DEVICE_IDS = [
  'C73B6020-1526-46B8-A178-8399EA3AF094',
];

const readExtraDevDeviceIds = (): string[] => {
  const raw = import.meta.env?.VITE_DEV_EMULATOR_IDS;
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const DEV_DEVICE_IDS = Array.from(
  new Set([...BASE_DEV_DEVICE_IDS, ...readExtraDevDeviceIds()].map((id) => id.toUpperCase()))
);

/**
 * 개발용 테스트 디바이스인지 확인.
 * - 실기기는 항상 false
 * - 에뮬레이터/시뮬레이터에서 ID allowlist 일치 시 true
 */
export const isDevDevice = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'web') return false;
  if (cachedIsDevDevice === true) return true;

  try {
    const deviceInfo = await Device.getInfo();
    if (!deviceInfo.isVirtual) {
      cachedIsDevDevice = false;
      return false;
    }

    const idResult = await Device.getId();
    const deviceId = idResult.identifier?.toUpperCase() ?? '';
    cachedIsDevDevice = DEV_DEVICE_IDS.some((id) => deviceId === id);

    if (import.meta.env.DEV) {
      console.log('[DevDevice] platform:', deviceInfo.platform, 'identifier:', deviceId, 'matched:', cachedIsDevDevice);
    }

    return cachedIsDevDevice;
  } catch {
    return false;
  }
};

/**
 * 현재 디바이스가 에뮬레이터/시뮬레이터인지 확인
 * - iOS 시뮬레이터
 * - Android 에뮬레이터
 *
 * 결과는 캐시되어 한 세션 동안 재사용됨.
 */
export const isEmulator = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'web') {
    return false;
  }

  if (cachedIsEmulator === true) {
    return true;
  }

  try {
    const deviceInfo = await Device.getInfo();
    cachedIsEmulator = Boolean(deviceInfo.isVirtual);
    return cachedIsEmulator;
  } catch {
    return false;
  }
};

/**
 * 스킨 자동 전체 해금 허용 여부.
 *
 * 허용 조건:
 * 1) 웹 아님
 * 2) 에뮬레이터/시뮬레이터임
 * 3) 등록된 본인 개발 에뮬레이터 식별자와 일치
 *
 * 따라서 배포된 사용자 실기기에서는 항상 false.
 */
export const shouldAutoUnlockAllSkinsForDev = async (): Promise<boolean> => {
  if (Capacitor.getPlatform() === 'web') return false;
  if (cachedShouldAutoUnlockAllSkinsForDev === true) return true;

  const emulator = await isEmulator();
  if (!emulator) return false;

  const devDevice = await isDevDevice();
  if (devDevice) {
    cachedShouldAutoUnlockAllSkinsForDev = true;
    return true;
  }
  return false;
};

/**
 * 에뮬레이터/개발 캐시 초기화 (테스트용)
 */
export const resetEmulatorCache = (): void => {
  cachedIsEmulator = null;
  cachedIsDevDevice = null;
  cachedShouldAutoUnlockAllSkinsForDev = null;
};
