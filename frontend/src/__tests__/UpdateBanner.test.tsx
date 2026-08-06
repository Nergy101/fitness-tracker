import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UpdateBanner from "../components/UpdateBanner";

describe("UpdateBanner", () => {
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'New version available' message", () => {
    render(<UpdateBanner onUpdate={onUpdate} />);
    expect(screen.getByText("New version available")).toBeInTheDocument();
  });

  it("renders a Refresh button", () => {
    render(<UpdateBanner onUpdate={onUpdate} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("calls onUpdate when Refresh is clicked", () => {
    render(<UpdateBanner onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
