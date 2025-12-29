/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ADMOB_BANNER_IOS?: string;
	readonly VITE_ADMOB_BANNER_ANDROID?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

