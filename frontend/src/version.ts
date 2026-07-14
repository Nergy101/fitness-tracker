// Build-time app version, injected by CI via the VITE_APP_VERSION env var
// (see .github/workflows/docker-publish.yml + frontend/Dockerfile).
// Format: YYYY.MM.DD.<revision> — falls back to "dev" for local builds.
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";
