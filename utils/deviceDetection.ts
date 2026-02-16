/**
 * 디바이스 환경 감지 유틸리티
 * - 에뮬레이터/시뮬레이터 감지
 */

import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

let cachedIsEmulator: boolean | null = null;

/**
 * 현재 디바이스가 에뮬레이터/시뮬레이터인지 확인
 * - iOS 시뮬레이터
 * - Android 에뮬레이터
 * 
 * 결과는 캐시되어 한 세션 동안 재사용됨.
 */
export const isEmulator = async (): Promise<boolean> => {
  // 웹 환경이면 에뮬레이터 아님
  if (Capacitor.getPlatform() === 'web') {
    return false;
  }

  // 이미 확인했으면 캐시된 값 반환
  if (cachedIsEmulator !== null) {
    return cachedIsEmulator;
  }

  try {
    const deviceInfo = await Device.getInfo();
    cachedIsEmulator = Boolean(deviceInfo.isVirtual);
    return cachedIsEmulator;
  } catch {
    cachedIsEmulator = false;
    return false;
  }
};

/**
 * 에뮬레이터 캐시 초기화 (테스트용)
 */
export const resetEmulatorCache = (): void => {
  cachedIsEmulator = null;
};
