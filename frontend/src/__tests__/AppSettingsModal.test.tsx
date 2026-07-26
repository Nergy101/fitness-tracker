import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppSettingsModal from "../components/AppSettingsModal";

// Mock useTheme
vi.mock("../useTheme", () => ({
  useTheme: () => ({
    theme: "dark" as const,
    mode: "dark" as const,
    setMode: vi.fn(),
    cycleMode: vi.fn(),
  }),
}));

// Mock useAudio
vi.mock("../useAudio", () => ({
  useAudio: () => ({
    muted: false,
    toggleMuted: vi.fn(),
  }),
}));

// Mock useLocale
vi.mock("../useLocale", () => ({
  useLocale: () => ({
    locale: "dmy" as const,
    setLocale: vi.fn(),
    toggleLocale: vi.fn(),
  }),
}));

// Mock useOnboarding
vi.mock("../useOnboarding", () => ({
  useOnboarding: () => ({
    complete: true,
    markComplete: vi.fn(),
    reset: vi.fn(),
  }),
}));

// Mock useFocusTrap
vi.mock("../useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

// Mock version
vi.mock("../version", () => ({
  APP_VERSION: "1.0.0",
}));

// Mock subcomponents
vi.mock("../components/health/HealthSettingsSection", () => ({
  default: ({ onSaved }: { onSaved: () => void }) => (
    <div data-testid="health-settings-section">
      <button data-testid="save-health" onClick={onSaved}>
        Save Health Settings
      </button>
    </div>
  ),
}));

vi.mock("../components/BackupSection", () => ({
  default: () => <div data-testid="backup-section">BackupSection</div>,
}));

vi.mock("../components/CreditsSection", () => ({
  default: () => <div data-testid="credits-section">CreditsSection</div>,
}));

describe("AppSettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Smoke tests ──────────────────────────────────────────

  it("renders the settings modal with title", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders the version number", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders the sub-tab pills: General, Health, Credits", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Credits")).toBeInTheDocument();
  });

  it("shows General tab content by default", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    // Theme section
    expect(screen.getByText("Theme")).toBeInTheDocument();
    // Date format section
    expect(screen.getByText("Date format")).toBeInTheDocument();
    // Sound effects
    expect(screen.getByText("Sound effects")).toBeInTheDocument();
  });

  it("renders theme options: System, Light, Dark", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByLabelText("System theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Light theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Dark theme")).toBeInTheDocument();
  });

  it("renders date format options: D/M and M/D", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByLabelText("Day/month date format")).toBeInTheDocument();
    expect(screen.getByLabelText("Month/day date format")).toBeInTheDocument();
  });

  it("renders the BackupSection in General tab", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByTestId("backup-section")).toBeInTheDocument();
  });

  it("renders the 'Replay intro tour' button in General tab", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    expect(screen.getByText("Replay intro tour")).toBeInTheDocument();
  });

  it("renders the sound checkbox", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    const checkbox = screen.getByLabelText("Mute sounds");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked(); // muted=false, so checked=true
  });

  it("has the dialog role", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Settings");
  });

  // ── Key interactions ─────────────────────────────────────

  it("calls onClose when close button (×) is clicked", () => {
    const onClose = vi.fn();
    render(<AppSettingsModal onClose={onClose} onHealthSaved={vi.fn()} />);

    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to Health tab when Health pill is clicked", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    fireEvent.click(screen.getByText("Health"));

    expect(screen.getByTestId("health-settings-section")).toBeInTheDocument();
    expect(screen.getByText("Health Profile")).toBeInTheDocument();
  });

  it("switches to Credits tab when Credits pill is clicked", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    fireEvent.click(screen.getByText("Credits"));

    expect(screen.getByTestId("credits-section")).toBeInTheDocument();
  });

  it("switches back to General tab", () => {
    render(<AppSettingsModal onClose={vi.fn()} onHealthSaved={vi.fn()} />);

    // Go to Health
    fireEvent.click(screen.getByText("Health"));
    expect(screen.getByTestId("health-settings-section")).toBeInTheDocument();

    // Go back to General
    fireEvent.click(screen.getByText("General"));
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByTestId("backup-section")).toBeInTheDocument();
  });

  it("calls onHealthSaved and onClose when health settings are saved", () => {
    const onClose = vi.fn();
    const onHealthSaved = vi.fn();
    render(<AppSettingsModal onClose={onClose} onHealthSaved={onHealthSaved} />);

    // Switch to Health tab
    fireEvent.click(screen.getByText("Health"));

    // Click save in the mocked HealthSettingsSection
    fireEvent.click(screen.getByTestId("save-health"));

    expect(onHealthSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose and resets onboarding when 'Replay intro tour' is clicked", () => {
    const onClose = vi.fn();
    render(<AppSettingsModal onClose={onClose} onHealthSaved={vi.fn()} />);

    fireEvent.click(screen.getByText("Replay intro tour"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});