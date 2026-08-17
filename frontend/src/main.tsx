import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { isStandalone } from "./installPrompt";

// Mirror "installed app" onto <html> before first paint so CSS can key on it
// (see .bottom-nav in index.css). The equivalent `display-mode` media query is
// the primary signal; this class is the fallback for iOS webviews that only
// expose navigator.standalone. It cannot live in the inline <script> in
// index.html — the production CSP is `script-src 'self'`, which blocks inline
// scripts, so anything that must run has to ship inside the bundle.
if (isStandalone()) {
  document.documentElement.classList.add("standalone");
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

// Wrap at the root so a crash anywhere — including the login screen and the
// workout runner (which App renders before its inner boundary) — shows the
// recovery UI instead of a blank page.
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
