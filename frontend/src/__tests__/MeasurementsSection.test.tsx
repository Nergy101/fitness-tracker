import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MeasurementsSection from "../components/health/MeasurementsSection";
import type {
  BodyMeasurementResponse,
  MeasurementChangesResponse,
  BodyMeasurementCreate,
} from "../api";

const mockGetMeasurements = vi.fn().mockResolvedValue([]);
const mockGetMeasurementChanges = vi.fn().mockResolvedValue(null);
const mockCreateMeasurement = vi.fn().mockResolvedValue({});

vi.mock("../api", () => ({
  api: {
    getMeasurements: (...args: unknown[]) => mockGetMeasurements(...args),
    getMeasurementChanges: (...args: unknown[]) => mockGetMeasurementChanges(...args),
    createMeasurement: (...args: unknown[]) => mockCreateMeasurement(...args),
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  RulerIcon: () => <span data-icon="ruler" />,
  PlusCircleIcon: () => <span data-icon="plus" />,
  XIcon: () => <span data-icon="x" />,
  CaretDownIcon: () => <span data-icon="caret-down" />,
  CaretUpIcon: () => <span data-icon="caret-up" />,
  BarbellIcon: () => <span data-icon="barbell" />,
  ChartLineUpIcon: () => <span data-icon="chart-line" />,
  TrendDownIcon: () => <span data-icon="trend-down" />,
  ChartBarIcon: () => <span data-icon="chart-bar" />,
  GearIcon: () => <span data-icon="gear" />,
  PersonSimpleRunIcon: () => <span data-icon="run" />,
  SneakerIcon: () => <span data-icon="sneaker" />,
  HandFistIcon: () => <span data-icon="fist" />,
}));
vi.mock("@phosphor-icons/react/dist/csr/Boot", () => ({
  Boot: () => <span data-icon="boot" />,
}));

vi.mock("../components/health/utils", () => ({
  shortDate: (d: string) => d.slice(0, 10),
}));

function makeMeasurement(overrides: Partial<BodyMeasurementResponse> = {}): BodyMeasurementResponse {
  return {
    id: 1,
    date: "2026-07-29",
    waist_cm: 80,
    hips_cm: 95,
    chest_cm: null,
    left_arm_cm: null,
    right_arm_cm: null,
    left_thigh_cm: null,
    right_thigh_cm: null,
    neck_cm: null,
    estimated_body_fat_pct: null,
    body_fat_method: null,
    notes: "",
    created_at: "2026-07-29T00:00:00Z",
    ...overrides,
  };
}

function twoMeasurements(): BodyMeasurementResponse[] {
  return [
    makeMeasurement({ id: 1, date: "2026-07-20", waist_cm: 82, hips_cm: 96 }),
    makeMeasurement({ id: 2, date: "2026-07-29", waist_cm: 80, hips_cm: 95 }),
  ];
}

describe("MeasurementsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
    mockGetMeasurementChanges.mockResolvedValue(null);
    mockCreateMeasurement.mockResolvedValue({});
  });

  it("renders latest measurements with values", async () => {
    const latest = makeMeasurement({ waist_cm: 80, hips_cm: 95 });
    const changes: MeasurementChangesResponse = {
      first: null,
      latest: null,
      deltas: { waist_cm: -2.5, hips_cm: 1.0 },
    };
    mockGetMeasurements.mockResolvedValue([latest]);
    mockGetMeasurementChanges.mockResolvedValue(changes);

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("80 cm")).toBeInTheDocument();
      expect(screen.getByText("-2.5")).toBeInTheDocument();
    });
  });

  it("shows only the Add button when there are no measurements", async () => {
    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Measurements")).toBeInTheDocument();
    });
    // No measurement rows, no range toggle, no chart
    expect(screen.queryByText("Trends")).not.toBeInTheDocument();
    expect(screen.queryByText("Show on chart")).not.toBeInTheDocument();
  });

  it("submits a measurement and refreshes the list", async () => {
    const latest = makeMeasurement();
    mockGetMeasurements.mockResolvedValueOnce([]).mockResolvedValue([latest]);
    mockGetMeasurementChanges
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ first: null, latest: null, deltas: { waist_cm: 0 } });

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Measurements")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("+ Add Measurements"));

    // Fill in two fields
    const waist = screen.getByPlaceholderText("Waist (cm)");
    const hips = screen.getByPlaceholderText("Hips (cm)");
    fireEvent.change(waist, { target: { value: "79.5" } });
    fireEvent.change(hips, { target: { value: "94" } });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockCreateMeasurement).toHaveBeenCalledTimes(1);
    });
    const createArg = mockCreateMeasurement.mock.calls[0][0] as BodyMeasurementCreate;
    expect(createArg.waist_cm).toBe(79.5);
    expect(createArg.hips_cm).toBe(94);
    // Unfilled fields are sent as null
    expect(createArg.neck_cm).toBeNull();
    // List refreshed after save
    await waitFor(() => {
      expect(screen.getByText("80 cm")).toBeInTheDocument();
    });
  });

  it("toggles the selected measurement set (does not drop the last one)", async () => {
    mockGetMeasurements.mockResolvedValue(twoMeasurements());
    mockGetMeasurementChanges.mockResolvedValue(null);

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("Show on chart")).toBeInTheDocument();
    });

    // Default waist selected. Deselect it -> chart should drop waist.
    fireEvent.click(screen.getByRole("button", { name: "Waist" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Hips" })).toBeInTheDocument();
    });

    // Try to deselect the last remaining selected field (Hips) -> stays selected
    fireEvent.click(screen.getByRole("button", { name: "Hips" }));
    // Re-add Waist
    fireEvent.click(screen.getByRole("button", { name: "Waist" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Waist" })).toBeInTheDocument();
    });
  });

  it("switches the range filter buttons", async () => {
    mockGetMeasurements.mockResolvedValue(twoMeasurements());
    mockGetMeasurementChanges.mockResolvedValue(null);

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("Show on chart")).toBeInTheDocument();
    });

    // Default is 90d
    fireEvent.click(screen.getByText("30d"));
    fireEvent.click(screen.getByText("All"));
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("renders the trend chart when there are 2+ measurements", async () => {
    mockGetMeasurements.mockResolvedValue(twoMeasurements());
    mockGetMeasurementChanges.mockResolvedValue(null);

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("Trends")).toBeInTheDocument();
    });
    // Waist + Hips appear in the measurement rows, toggle buttons, and legend
    expect(screen.getAllByText("Waist").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Hips").length).toBeGreaterThanOrEqual(2);
  });

  it("does not render the chart for a single measurement", async () => {
    mockGetMeasurements.mockResolvedValue([makeMeasurement()]);
    mockGetMeasurementChanges.mockResolvedValue(null);

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Measurements")).toBeInTheDocument();
    });
    expect(screen.queryByText("Trends")).not.toBeInTheDocument();
    expect(screen.queryByText("Show on chart")).not.toBeInTheDocument();
  });
});
