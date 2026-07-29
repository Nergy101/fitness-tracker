import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFocusTrap } from "../useFocusTrap";
import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";

describe("useFocusTrap", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function createRefWithElement(
    el: HTMLElement | null,
  ): RefObject<HTMLElement | null> {
    return { current: el };
  }

  it("adds keyboard listener when container exists", () => {
    const onClose = vi.fn();
    const ref = createRefWithElement(container);
    const addSpy = vi.spyOn(document, "addEventListener");

    renderHook(() => useFocusTrap(ref, onClose));

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    addSpy.mockRestore();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    const ref = createRefWithElement(container);
    renderHook(() => useFocusTrap(ref, onClose));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing when container is null", () => {
    const onClose = vi.fn();
    const ref = createRefWithElement(null);
    renderHook(() => useFocusTrap(ref, onClose));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("traps focus on Tab when focusable elements exist", () => {
    const onClose = vi.fn();
    const button1 = document.createElement("button");
    const button2 = document.createElement("button");
    container.appendChild(button1);
    container.appendChild(button2);
    const ref = createRefWithElement(container);

    renderHook(() => useFocusTrap(ref, onClose));

    // Focus the last element
    button2.focus();

    // Tab forward from last should wrap to first
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
    );
    expect(document.activeElement).toBe(button1);
  });

  it("traps focus on Shift+Tab when focusable elements exist", () => {
    const onClose = vi.fn();
    const button1 = document.createElement("button");
    const button2 = document.createElement("button");
    container.appendChild(button1);
    container.appendChild(button2);
    const ref = createRefWithElement(container);

    renderHook(() => useFocusTrap(ref, onClose));

    // Focus the first element
    button1.focus();

    // Shift+Tab from first should wrap to last
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })
    );
    expect(document.activeElement).toBe(button2);
  });

  it("prevents default Tab when no focusable elements exist", () => {
    const onClose = vi.fn();
    const ref = createRefWithElement(container);
    renderHook(() => useFocusTrap(ref, onClose));

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const preventSpy = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(preventSpy).toHaveBeenCalled();
  });

  it("removes listener on unmount", () => {
    const onClose = vi.fn();
    const ref = createRefWithElement(container);
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useFocusTrap(ref, onClose));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("restores previous focus on unmount", () => {
    const onClose = vi.fn();
    const prevButton = document.createElement("button");
    document.body.appendChild(prevButton);
    prevButton.focus();

    const ref = createRefWithElement(container);
    const { unmount } = renderHook(() => useFocusTrap(ref, onClose));

    // Focus trap should have focused the first element in container
    // (but container has no focusable elements, so prevFocus stays)

    unmount();

    // Should have restored focus to prevButton
    expect(document.activeElement).toBe(prevButton);
    document.body.removeChild(prevButton);
  });
});