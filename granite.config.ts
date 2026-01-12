import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'slidemino',
  appType: 'game',
  brand: {
    displayName: 'Slidemino',
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
