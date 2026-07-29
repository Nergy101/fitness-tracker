import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeasurementsSection from "../components/health/MeasurementsSection";

const mockGetMeasurements = vi.fn().mockResolvedValue([]);
const mockGetMeasurementChanges = vi.fn().mockResolvedValue(null);
const mockCreateMeasurement = vi.fn().mockResolvedValue({});

vi.mock("../api", () => ({
  api: {
    getMeasurements: (...args: any[]) => mockGetMeasurements(...args),
    getMeasurementChanges: (...args: any[]) => mockGetMeasurementChanges(...args),
    createMeasurement: (...args: any[]) => mockCreateMeasurement(...args),
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

describe("MeasurementsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
    mockGetMeasurementChanges.mockResolvedValue(null);
    mockCreateMeasurement.mockResolvedValue({});
  });

  it("renders latest measurements with values", async () => {
    mockGetMeasurements.mockResolvedValue([
      { id: 1, date: "2026-07-29", waist_cm: 80, hips_cm: 95, chest_cm: null, left_arm_cm: null, right_arm_cm: null, left_thigh_cm: null, right_thigh_cm: null, neck_cm: null } as any,
    ]);
    mockGetMeasurementChanges.mockResolvedValue({ first: null, latest: null, deltas: { waist_cm: -2.5, hips_cm: 1.0 } } as any);

    render(<MeasurementsSection />);
    await waitFor(() => {
      expect(screen.getByText("80 cm")).toBeInTheDocument();
      expect(screen.getByText("-2.5")).toBeInTheDocument();
    });
  });
});