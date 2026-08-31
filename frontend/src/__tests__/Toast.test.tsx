import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Toast from "../components/Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children with a status role", () => {
    render(<Toast onDismiss={vi.fn()}>Saved!</Toast>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("auto-dismisses after the default duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Saved!</Toast>);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss before a custom duration elapses", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss} duration={1000}>Saved!</Toast>);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onDismiss when the callback changes without restarting the timer", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Toast onDismiss={first}>Saved!</Toast>);
    // Parent re-renders with a new callback while the toast is showing.
    rerender(<Toast onDismiss={second}>Saved!</Toast>);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("restarts the dismiss timer when duration changes", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast onDismiss={onDismiss} duration={1000}>Saved!</Toast>);
    rerender(<Toast onDismiss={onDismiss} duration={3000}>Saved!</Toast>);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears the timer on unmount so onDismiss is not called", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast onDismiss={onDismiss}>Saved!</Toast>);
    unmount();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
