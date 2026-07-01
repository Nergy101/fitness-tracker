/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  // Safari <14.1 prefix; optional so callers must narrow before use.
  webkitAudioContext?: typeof AudioContext;
}
