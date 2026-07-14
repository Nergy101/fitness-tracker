/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Build-time version string injected by CI (e.g. "2026.07.14.3"). */
  readonly VITE_APP_VERSION?: string;
}

interface Window {
  // Safari <14.1 prefix; optional so callers must narrow before use.
  webkitAudioContext?: typeof AudioContext;
}
