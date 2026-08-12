/**
 * Guards the viewport meta tag.
 *
 * A standalone iOS app only paints the full screen when `viewport-fit=cover` is
 * present; without it the web view is letterboxed into the safe area and a strip
 * of page background sits under the bottom nav that no CSS can remove. Scale
 * locks (`maximum-scale` / `user-scalable=no`) are the suspected trigger for
 * that letterbox, and iOS ignores them for accessibility anyway — the
 * input-focus auto-zoom is handled by the >=16px control font-size in index.css.
 */
import { describe, expect, it } from "vitest";
// `?raw` rather than node:fs — src/ is type-checked without node types, and the
// jsdom environment makes import.meta.url an http: URL that fileURLToPath rejects.
import html from "../../index.html?raw";

const viewport = /<meta\s+name="viewport"[\s\S]*?content="([^"]+)"/.exec(html)?.[1] ?? "";

describe("index.html viewport", () => {
  it("declares viewport-fit=cover so the iOS PWA is not letterboxed", () => {
    expect(viewport).toContain("viewport-fit=cover");
  });

  it("declares width=device-width and initial-scale=1", () => {
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("initial-scale=1");
  });

  it("carries no scale lock", () => {
    expect(viewport).not.toContain("maximum-scale");
    expect(viewport).not.toContain("user-scalable");
  });
});
