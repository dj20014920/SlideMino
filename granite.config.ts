import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'slidemino',
  // @ts-expect-error - appType is used by the runtime but missing from current types.
  appType: 'game',
  brand: {
    displayName: '블록 슬라이드 (Block Slide)',
    primaryColor: '#B59D5B',
    icon: 'https://slidemino.private-apps.tossmini.com/brand-icon.png',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
  webViewProps: {
    type: 'game',
  },
});
