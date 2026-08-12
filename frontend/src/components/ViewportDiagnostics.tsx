/**
 * On-device viewport readout.
 *
 * The installed PWA has no address bar and no devtools, so the only way to see
 * what iOS actually reports is to render it. This exists because the bottom-nav
 * gap survived six rounds of CSS retuning: the numbers below distinguish the two
 * possible causes in one glance.
 *
 *   screen height == viewport height  → the webview covers the screen, and any
 *                                       gap under the nav is the nav's own padding.
 *   screen height >  viewport height  → the webview is letterboxed into the safe
 *                                       area; the strip below it is the page
 *                                       background bleeding through, and no
 *                                       amount of padding can reclaim it.
 *
 * `nav gap` is the direct answer: distance from the nav's bottom edge to the
 * bottom of the viewport. Zero means the layout is right and the eye is seeing
 * something outside the page.
 */
import { useCallback, useEffect, useState } from "react";

interface Readings {
  screenH: number;
  screenW: number;
  innerH: number;
  innerW: number;
  clientH: number;
  visualH: number;
  visualScale: number;
  insetTop: number;
  insetBottom: number;
  navBottom: number;
  navGap: number;
  navPadBottom: string;
  standaloneProp: boolean;
  displayModeQuery: boolean;
  dpr: number;
  /** The live meta tag — proves which index.html the app actually booted. */
  viewportMeta: string;
}

/** env() is not readable from JS, so measure it off a throwaway probe element. */
function readInsets(): { top: number; bottom: number } {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;" +
    "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  return { top, bottom };
}

function measure(): Readings {
  const insets = readInsets();
  const nav = document.querySelector(".bottom-nav");
  const rect = nav?.getBoundingClientRect();
  const navBottom = rect ? Math.round(rect.bottom) : -1;
  const innerH = Math.round(window.innerHeight);
  return {
    screenH: Math.round(window.screen.height),
    screenW: Math.round(window.screen.width),
    innerH,
    innerW: Math.round(window.innerWidth),
    clientH: Math.round(document.documentElement.clientHeight),
    visualH: Math.round(window.visualViewport?.height ?? 0),
    visualScale: window.visualViewport?.scale ?? 0,
    insetTop: Math.round(insets.top),
    insetBottom: Math.round(insets.bottom),
    navBottom,
    navGap: navBottom < 0 ? -1 : innerH - navBottom,
    navPadBottom: nav ? getComputedStyle(nav).paddingBottom : "—",
    standaloneProp:
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayModeQuery:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches,
    dpr: window.devicePixelRatio,
    viewportMeta:
      document
        .querySelector('meta[name="viewport"]')
        ?.getAttribute("content") ?? "—",
  };
}

export default function ViewportDiagnostics() {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<Readings | null>(null);

  const refresh = useCallback(() => {
    setR(measure());
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, [open, refresh]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-accent hover:text-accent-hover transition-colors"
      >
        Viewport diagnostics
      </button>
    );
  }

  // Letterboxed: the page is laid out shorter than the physical screen, so the
  // leftover strip is painted by the propagated body background, not by the nav.
  const letterboxed = r !== null && r.screenH - r.innerH > 2;

  // A visual viewport narrower than the screen means the page is laid out at a
  // scaled-down width and blown back up, which shortens the height too — a
  // different fault from a letterbox, and one the height numbers alone hide.
  const scaled = r !== null && Math.abs(r.screenW - r.innerW) > 2;

  const rows: Array<[string, string]> = r
    ? [
        ["screen w × h", `${r.screenW} × ${r.screenH}`],
        ["window.inner w × h", `${r.innerW} × ${r.innerH}`],
        ["documentElement.clientHeight", `${r.clientH}`],
        ["visualViewport.height", `${r.visualH}`],
        ["visualViewport.scale", `${r.visualScale}`],
        ["safe-area top / bottom", `${r.insetTop} / ${r.insetBottom}`],
        ["nav bottom edge", `${r.navBottom}`],
        ["gap under nav", `${r.navGap}`],
        ["nav padding-bottom", r.navPadBottom],
        ["navigator.standalone", `${r.standaloneProp}`],
        ["display-mode: standalone", `${r.displayModeQuery}`],
        ["devicePixelRatio", `${r.dpr}`],
      ]
    : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-fg/50">Viewport diagnostics</p>
        <div className="flex gap-3">
          <button onClick={refresh} className="text-xs text-accent">
            Refresh
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-fg/40">
            Hide
          </button>
        </div>
      </div>

      {r && (
        <>
          <p className="text-[11px] leading-snug text-fg/60">
            {letterboxed
              ? `Letterboxed: the page is ${r.screenH - r.innerH}px shorter than the screen${scaled ? ` and ${r.screenW - r.innerW}px narrower` : ""}. The strip under the nav is outside the page — CSS padding cannot remove it.`
              : `Page covers the screen. Any visible gap is the nav's own ${r.navPadBottom} padding.`}
          </p>
          {/* The booted shell's own meta tag: if this still shows a scale lock,
              the device is running a stale precached index.html, not the fix. */}
          <p className="font-mono text-[10px] leading-snug text-fg/40 break-all">
            meta: {r.viewportMeta}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-fg/40 truncate">{label}</dt>
                <dd className="text-fg/80 text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
