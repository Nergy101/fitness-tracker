import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside a container while it's mounted.
 * - Tab / Shift+Tab cycle through focusable elements within the container only.
 * - Escape calls `onClose`.
 * - On unmount, restores focus to the element that was active before mount.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prevFocus = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the container.
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length > 0) focusable[0].focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const current = container!.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (current.length === 0) {
        e.preventDefault();
        return;
      }
      const first = current[0];
      const last = current[current.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that triggered the modal.
      if (prevFocus && typeof prevFocus.focus === "function") {
        prevFocus.focus();
      }
    };
  }, [containerRef]);
}
