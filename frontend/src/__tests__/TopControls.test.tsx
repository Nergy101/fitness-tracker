import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TopControls from "../components/TopControls";

const themeMock = vi.hoisted(() => ({
  theme: "dark" as "light" | "dark",
  mode: "system" as "system" | "light" | "dark",
  cycleMode: vi.fn(),
}));

const audioMock = vi.hoisted(() => ({
  muted: false,
  toggleMuted: vi.fn(),
}));

vi.mock("../useTheme", () => ({
  useTheme: () => themeMock,
}));

vi.mock("../useAudio", () => ({
  useAudio: () => audioMock,
}));

describe("TopControls", () => {
  beforeEach(() => {
    themeMock.theme = "dark";
    themeMock.mode = "system";
    themeMock.cycleMode.mockClear();
    audioMock.muted = false;
    audioMock.toggleMuted.mockClear();
  });

  it("renders a mute button labelled for the current sound state", () => {
    render(<TopControls />);
    expect(screen.getByRole("button", { name: "Mute sounds" })).toBeInTheDocument();
  });

  it("calls toggleMuted when the sound button is clicked", () => {
    render(<TopControls />);
    fireEvent.click(screen.getByRole("button", { name: "Mute sounds" }));
    expect(audioMock.toggleMuted).toHaveBeenCalledTimes(1);
  });

  it("relabels the sound button when muted", () => {
    audioMock.muted = true;
    render(<TopControls />);
    expect(screen.getByRole("button", { name: "Unmute sounds" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mute sounds" })).not.toBeInTheDocument();
  });

  it("labels the theme button for system mode", () => {
    themeMock.mode = "system";
    render(<TopControls />);
    expect(screen.getByRole("button", { name: "System theme" })).toBeInTheDocument();
  });

  it("labels the theme button for dark mode as switch to system", () => {
    themeMock.mode = "dark";
    render(<TopControls />);
    expect(screen.getByRole("button", { name: "Switch to system theme" })).toBeInTheDocument();
  });

  it("labels the theme button for light mode as switch to dark", () => {
    themeMock.mode = "light";
    render(<TopControls />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it("calls cycleMode when the theme button is clicked", () => {
    render(<TopControls />);
    fireEvent.click(screen.getByRole("button", { name: "System theme" }));
    expect(themeMock.cycleMode).toHaveBeenCalledTimes(1);
  });
});
