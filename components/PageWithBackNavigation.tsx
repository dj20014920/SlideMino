import React, { useEffect, useRef, ComponentType } from 'react';
import { ArrowLeft } from 'lucide-react';
import { navigateTo } from '../utils/routing';
import { isNativeApp } from '../utils/platform';
import { BackNavigationTutorial } from './BackNavigationTutorial';

/**
 * 뒤로가기 기능을 제공하는 고차 컴포넌트(HOC)
 *
 * 기능:
 * 1. 스와이프 제스처로 뒤로가기 (오른쪽으로 스와이프)
 * 2. Android 하드웨어 백버튼 지원
 * 3. 상단 고정 네비게이션 바 (뒤로가기 버튼)
 *
 * 사용법:
 * export default withBackNavigation(YourComponent);
 */

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isDragging: boolean;
}

export function withBackNavigation<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  return function PageWithBackNavigation(props: P) {
    const touchStateRef = useRef<TouchState>({
      startX: 0,
      startY: 0,
      startTime: 0,
      isDragging: false,
    });

    const handleGoBack = () => {
      navigateTo('/');
    };

    // 스와이프 제스처 처리
    useEffect(() => {
      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        touchStateRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startTime: Date.now(),
          isDragging: false,
        };
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!touchStateRef.current.startX) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStateRef.current.startX;
        const deltaY = touch.clientY - touchStateRef.current.startY;

        // 가로 스와이프가 세로 스와이프보다 크고, 오른쪽으로 스와이프일 때만
        if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
          touchStateRef.current.isDragging = true;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (!touchStateRef.current.startX) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStateRef.current.startX;
        const deltaY = touch.clientY - touchStateRef.current.startY;
        const deltaTime = Date.now() - touchStateRef.current.startTime;

        // 스와이프 조건:
        // 1. 오른쪽으로 최소 100px 이상 이동
        // 2. 세로 이동보다 가로 이동이 더 큼 (각도 조건)
        // 3. 500ms 이내에 완료 (속도 조건)
        const isValidSwipe =
          deltaX > 100 &&
          Math.abs(deltaX) > Math.abs(deltaY) * 1.5 &&
          deltaTime < 500;

        if (isValidSwipe) {
          handleGoBack();
        }

        // 상태 초기화
        touchStateRef.current = {
          startX: 0,
          startY: 0,
          startTime: 0,
          isDragging: false,
        };
      };

      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });

      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }, []);

    // Android 하드웨어 백버튼 처리 (네이티브 앱에서만)
    useEffect(() => {
      if (!isNativeApp()) return;

      let backButtonListener: any;

      const setupBackButton = async () => {
        try {
          // 동적 import로 Capacitor 플러그인 로드 (웹 빌드에서는 제외)
          const { App: CapacitorApp } = await import('@capacitor/app');
          backButtonListener = await CapacitorApp.addListener('backButton', () => {
            handleGoBack();
          });
        } catch (error) {
          console.warn('Capacitor App plugin not available:', error);
        }
      };

      setupBackButton();

      return () => {
        if (backButtonListener) {
          backButtonListener.remove();
        }
      };
    }, []);

    return (
      <div className="relative min-h-screen">
        {/* 고정 헤더 네비게이션 바 */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center">
            <button
              onClick={handleGoBack}
              className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors duration-200 active:scale-95 transform"
              aria-label="뒤로가기"
            >
              <ArrowLeft size={24} strokeWidth={2} />
              <span className="font-medium">뒤로가기</span>
            </button>
          </div>
        </header>

        {/* 원래 페이지 컴포넌트 */}
        <WrappedComponent {...props} />

        {/* 뒤로가기 제스처 튜토리얼 (Ghost Hand) */}
        <BackNavigationTutorial />
      </div>
    );
  };
}

/**
 * Hook 형태로도 사용 가능한 유틸리티
 */
export function useBackNavigation() {
  const handleGoBack = () => {
    navigateTo('/');
  };

  return { handleGoBack };
}
