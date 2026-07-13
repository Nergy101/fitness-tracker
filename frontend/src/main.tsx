import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

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
