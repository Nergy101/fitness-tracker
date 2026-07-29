import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MetricNamesDiagnostic from "../components/health/MetricNamesDiagnostic";
import type { MetricNamesResponse } from "../api";

const mockGetMetricNames = vi.fn();

vi.mock("../api", () => ({
  api: {
    getMetricNames: (...args: unknown[]) => mockGetMetricNames(...args),
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  CaretDownIcon: ({ size, className }: any) => <span data-icon="caret-down" data-size={size} />,
  CaretUpIcon: ({ size, className }: any) => <span data-icon="caret-up" data-size={size} />,
  PulseIcon: ({ size, className }: any) => <span data-icon="pulse" data-size={size} />,
}));

describe("MetricNamesDiagnostic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders collapsed by default", () => {
    render(<MetricNamesDiagnostic />);
    expect(screen.getByText(/Imported metrics/i)).toBeInTheDocument();
  });

  it("toggles open and fetches data", async () => {
    mockGetMetricNames.mockResolvedValue({
      metrics: [
        {
          metric_name: "step_count",
          count: 1500,
          earliest: "2026-01-01",
          latest: "2026-07-29",
          latest_qty: 8432,
        },
      ],
    } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("step_count")).toBeInTheDocument();
    });
    expect(screen.getByText("1500")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockGetMetricNames.mockRejectedValue(new Error("Failed"));

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load metric names/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no metrics", async () => {
    mockGetMetricNames.mockResolvedValue({ metrics: [] } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText(/No Apple Health data/)).toBeInTheDocument();
    });
  });

  it("shows vo2_max detection when present", async () => {
    mockGetMetricNames.mockResolvedValue({
      metrics: [
        {
          metric_name: "vo2_max",
          count: 12,
          earliest: "2026-03-01",
          latest: "2026-07-28",
          latest_qty: 42.5,
        },
      ],
    } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText("vo2_max")).toBeInTheDocument();
    });

    // Should have green vo2 text
    expect(screen.getByText(/vo2_max data is present/)).toBeInTheDocument();
  });

  it("shows no vo2_max warning when absent", async () => {
    mockGetMetricNames.mockResolvedValue({
      metrics: [
        {
          metric_name: "step_count",
          count: 100,
          earliest: "2026-01-01",
          latest: "2026-07-29",
          latest_qty: 5000,
        },
      ],
    } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText("step_count")).toBeInTheDocument();
    });

    // Should have orange warning
    expect(screen.getByText(/No vo2_max rows found/)).toBeInTheDocument();
  });

  it("can toggle closed after opening", async () => {
    mockGetMetricNames.mockResolvedValue({ metrics: [] } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    const toggle = screen.getByText(/Imported metrics/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/No Apple Health data/)).toBeInTheDocument();
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.queryByText(/No Apple Health data/)).not.toBeInTheDocument();
    });
  });

  it("does not fetch again if already loaded", async () => {
    mockGetMetricNames.mockResolvedValue({
      metrics: [
        {
          metric_name: "heart_rate",
          count: 500,
          earliest: "2026-01-01",
          latest: "2026-07-29",
          latest_qty: 72,
        },
      ],
    } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    // Open
    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText("heart_rate")).toBeInTheDocument();
    });

    // Close
    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.queryByText("heart_rate")).not.toBeInTheDocument();
    });

    // Re-open (should use cached data, not fetch again)
    fireEvent.click(screen.getByText(/Imported metrics/i));

    // Should still show the data (cached)
    await waitFor(() => {
      expect(screen.getByText("heart_rate")).toBeInTheDocument();
    });

    // Should only have been called once
    expect(mockGetMetricNames).toHaveBeenCalledTimes(1);
  });

  it("renders correct table headers when data loaded", async () => {
    mockGetMetricNames.mockResolvedValue({
      metrics: [
        {
          metric_name: "active_energy",
          count: 300,
          earliest: "2026-01-01",
          latest: "2026-07-29",
          latest_qty: 450.2,
        },
      ],
    } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText("Metric")).toBeInTheDocument();
      expect(screen.getByText("Rows")).toBeInTheDocument();
      expect(screen.getByText("Latest")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
    });
  });

  it("shows dashes for null latest and latest_qty", async () => {
    mockGetMetricNames.mockResolvedValue({
      metrics: [
        {
          metric_name: "unknown_metric",
          count: 1,
          earliest: null,
          latest: null,
          latest_qty: null,
        },
      ],
    } as MetricNamesResponse);

    render(<MetricNamesDiagnostic />);

    fireEvent.click(screen.getByText(/Imported metrics/i));

    await waitFor(() => {
      expect(screen.getByText("unknown_metric")).toBeInTheDocument();
    });

    // Should show dashes for null values
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(2);
  });
});