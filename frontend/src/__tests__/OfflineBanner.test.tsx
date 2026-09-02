import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import OfflineBanner from "../components/OfflineBanner";

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    setOnLine(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when the browser is online", () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });

  it("shows the banner when it mounts offline", () => {
    setOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("shows the banner when the 'offline' event fires", () => {
    render(<OfflineBanner />);
    fireEvent(window, new Event("offline"));
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("hides the banner when the 'online' event fires", () => {
    setOnLine(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    fireEvent(window, new Event("online"));
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });

  it("removes its event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<OfflineBanner />);
    expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
    addSpy.mockClear();
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});