/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ADMOB_BANNER_IOS?: string;
	readonly VITE_ADMOB_BANNER_ANDROID?: string;
	readonly VITE_SCREENSHOT_MODE?: string;
	readonly VITE_APP_STORE?: string;
	readonly VITE_AD_FORCE_TEST_MODE?: string;
	readonly VITE_AD_DISTRIBUTION_CHANNEL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
