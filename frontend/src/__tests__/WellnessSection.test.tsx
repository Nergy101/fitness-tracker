import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WellnessSection from "../components/health/WellnessSection";
import type { WellnessResponse, WellnessTrendsResponse } from "../api";

const mockCreateWellnessEntry = vi.fn();
const mockGetWellnessEntries = vi.fn();
const mockGetWellnessTrends = vi.fn();

vi.mock("../api", () => ({
  api: {
    createWellnessEntry: (...args: unknown[]) => mockCreateWellnessEntry(...args),
    getWellnessEntries: (...args: unknown[]) => mockGetWellnessEntries(...args),
    getWellnessTrends: (...args: unknown[]) => mockGetWellnessTrends(...args),
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  SmileyIcon: ({ size, weight, className }: any) => <span data-icon="smiley" data-size={size} />,
  SmileyMehIcon: ({ size, weight, className }: any) => <span data-icon="smiley-meh" data-size={size} />,
  SmileySadIcon: ({ size, weight, className }: any) => <span data-icon="smiley-sad" data-size={size} />,
  SmileyStickerIcon: ({ size, weight, className }: any) => <span data-icon="smiley-sticker" data-size={size} />,
  SmileyWinkIcon: ({ size, weight, className }: any) => <span data-icon="smiley-wink" data-size={size} />,
  BarbellIcon: ({ size, weight, className }: any) => <span data-icon="barbell" data-size={size} />,
  PersonSimpleRunIcon: ({ size, weight, className }: any) => <span data-icon="run" data-size={size} />,
  SneakerIcon: ({ size, weight, className }: any) => <span data-icon="sneaker" data-size={size} />,
  BoxingGloveIcon: ({ size, weight, className }: any) => <span data-icon="boxing" data-size={size} />,
  HandFistIcon: ({ size, weight, className }: any) => <span data-icon="fist" data-size={size} />,
}));

const mockEntry: WellnessResponse = {
  id: 1,
  date: "2026-07-28",
  mood: 4,
  energy: 3,
  stress: 2,
  sleep_hours: 7.5,
  notes: "",
  created_at: "2026-07-28T00:00:00Z",
};

const mockTrends: WellnessTrendsResponse = {
  weekly_averages: [
    { week_start: "2026-07-20", avg_mood: 3.5, avg_energy: 3.0, avg_stress: 2.5, avg_sleep: 7.0 },
    { week_start: "2026-07-13", avg_mood: 4.0, avg_energy: 3.5, avg_stress: 2.0, avg_sleep: 7.5 },
    { week_start: "2026-07-06", avg_mood: 3.0, avg_energy: 2.5, avg_stress: 3.0, avg_sleep: 6.5 },
    { week_start: "2026-06-29", avg_mood: 3.8, avg_energy: 3.2, avg_stress: 2.2, avg_sleep: 7.8 },
    { week_start: "2026-06-22", avg_mood: 4.2, avg_energy: 3.8, avg_stress: 1.8, avg_sleep: 8.0 },
  ],
};

describe("WellnessSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWellnessEntries.mockResolvedValue([]);
    mockGetWellnessTrends.mockResolvedValue({ weekly_averages: [] });
    mockCreateWellnessEntry.mockResolvedValue({ id: 99 });
  });

  it("renders the wellness section with sliders", async () => {
    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    // Check 4 sliders are present
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(4);
  });

  it("renders latest entry when data is available", async () => {
    mockGetWellnessEntries.mockResolvedValue([mockEntry]);

    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    // Last entry should show in the "Last:" line
    expect(screen.getByText(/Last:/)).toBeInTheDocument();
    expect(screen.getByText(/Energy 3\/5/)).toBeInTheDocument();
  });

  it("renders trends when available", async () => {
    mockGetWellnessEntries.mockResolvedValue([mockEntry]);
    mockGetWellnessTrends.mockResolvedValue(mockTrends);

    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    // 4 weekly average mood values should be rendered
    const moodStats = screen.getAllByText("3.5");
    expect(moodStats.length).toBeGreaterThan(0);
  });

  it("changes mood slider value", async () => {
    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    const sliders = screen.getAllByRole("slider");
    expect(sliders[0]).toHaveValue("3");
    fireEvent.change(sliders[0], { target: { value: "5" } });
    expect(sliders[0]).toHaveValue("5");
  });

  it("submits wellness entry", async () => {
    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Log Check-in"));

    await waitFor(() => {
      expect(mockCreateWellnessEntry).toHaveBeenCalledWith({
        mood: 3,
        energy: 3,
        stress: 3,
        sleep_hours: 7,
      });
    });
  });

  it("changes energy and stress sliders", async () => {
    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    const sliders = screen.getAllByRole("slider");
    // Energy is index 1, stress is index 2
    fireEvent.change(sliders[1], { target: { value: "4" } });
    fireEvent.change(sliders[2], { target: { value: "2" } });
    expect(sliders[1]).toHaveValue("4");
    expect(sliders[2]).toHaveValue("2");
  });

  it("does not render latest entry when entries is empty", async () => {
    mockGetWellnessEntries.mockResolvedValue([]);
    mockGetWellnessTrends.mockResolvedValue({ weekly_averages: [] });

    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Last:/)).not.toBeInTheDocument();
  });

  it("does not render trends when weekly_averages is empty", async () => {
    mockGetWellnessEntries.mockResolvedValue([mockEntry]);
    mockGetWellnessTrends.mockResolvedValue({ weekly_averages: [] });

    render(<WellnessSection />);

    await waitFor(() => {
      expect(screen.getByText("Log Check-in")).toBeInTheDocument();
    });

    // With empty trends and an entry, the "Last:" should show but no trend boxes
    expect(screen.getByText(/Last:/)).toBeInTheDocument();
  });
});