import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BlockCustomizationProvider } from './context/BlockCustomizationContext';
import { initI18n } from './i18n/config';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

/**
 * 앱 시작 시 i18n 초기화를 기다린 후 렌더링합니다.
 * 네이티브 앱에서 기기 언어를 정확하게 감지하기 위해 비동기로 초기화합니다.
 */
const startApp = async () => {
  try {
    // i18n 초기화 (네이티브 기기 언어 감지 포함)
    await initI18n();
  } catch (error) {
    console.error('[App] Failed to initialize i18n:', error);
  }

  // 앱 렌더링
  root.render(
    <React.StrictMode>
      <BlockCustomizationProvider>
        <App />
      </BlockCustomizationProvider>
    </React.StrictMode>
  );
};

// 앱 시작
startApp();
