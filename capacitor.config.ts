import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 앱 이름 결정 (앱인토스 빌드 시 한글명 사용)
 * 빌드 시 VITE_APP_STORE=appintos 환경변수로 결정
 */
const getAppName = (): string => {
  // 빌드 타임에 환경변수 체크 (Capacitor CLI는 Node.js 환경)
  const store = process.env.VITE_APP_STORE;
  if (store === 'appintos') {
    return '슬라이드미노';
  }
  return 'SlideMino';
};

const config: CapacitorConfig = {
  appId: 'com.slidemino.app',
  appName: getAppName(),
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#fafafa'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    backgroundColor: '#fafafa'
  }
};

export default config;
