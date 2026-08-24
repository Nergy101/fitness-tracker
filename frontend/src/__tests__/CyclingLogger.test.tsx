import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CyclingLogger from "../components/CyclingLogger";
import { todayKey } from "../dateKey";

const mockCreateCycling = vi.fn().mockResolvedValue({ id: 1 });
const mockGetCycling = vi.fn().mockResolvedValue([]);
const mockUpdateCycling = vi.fn().mockResolvedValue({ id: 1 });
const mockDeleteCycling = vi.fn().mockResolvedValue(undefined);

vi.mock("../api", () => ({
  api: {
    createCycling: (...args: unknown[]) => mockCreateCycling(...args),
    getCycling: (...args: unknown[]) => mockGetCycling(...args),
    updateCycling: (...args: unknown[]) => mockUpdateCycling(...args),
    deleteCycling: (...args: unknown[]) => mockDeleteCycling(...args),
  },
  OfflineError: class OfflineError extends Error {
    readonly offline = true;
    constructor(message = "Offline") {
      super(message);
      this.name = "OfflineError";
    }
  },
}));

describe("CyclingLogger", () => {
  const onWorkoutLogged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Smoke tests ──

  it("renders the collapsed Cycling button", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    expect(screen.getByText("Cycling")).toBeInTheDocument();
  });

  // ── Expand / collapse ──

  it("expands the form when Cycling button is clicked", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    expect(screen.getByText("Log a Cycling Ride")).toBeInTheDocument();
    expect(screen.getByText("Save Cycling Ride")).toBeInTheDocument();
  });

  it("collapses the form when Close (X) is clicked", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    expect(screen.getByText("Log a Cycling Ride")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.getByText("Cycling")).toBeInTheDocument();
  });

  it("collapses the form when backdrop is clicked", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/60");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(screen.getByText("Cycling")).toBeInTheDocument();
  });

  // ── Duration selection ──

  it("shows duration quick-select buttons when form is open", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("shows custom minutes input when Custom is selected", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
  });

  it("switches away from custom input when a preset duration is clicked", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
    fireEvent.click(screen.getByText("15m"));
    expect(screen.queryByPlaceholderText("Minutes")).not.toBeInTheDocument();
  });

  // ── Form fields ──

  it("renders distance input with placeholder", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    expect(screen.getByPlaceholderText("e.g. 24.0")).toBeInTheDocument();
  });

  it("defaults the date to the local calendar day, not the UTC one", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    expect(screen.getByDisplayValue(todayKey())).toBeInTheDocument();
  });

  it("renders Notes input with aria-label", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  });

  it("shows summary preview when distance and duration are set", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    const distanceInput = screen.getByPlaceholderText("e.g. 24.0");
    fireEvent.change(distanceInput, { target: { value: "12.5" } });
    // Default 30m duration: preview shows "12.5 km" and the formatted duration
    expect(screen.getByText("12.5 km")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
  });

  it("disables submit until a distance is entered", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    const submit = screen.getByText("Save Cycling Ride");
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "10" } });
    expect(screen.getByText("Save Cycling Ride")).not.toBeDisabled();
  });

  // ── Submit ──

  it("calls api.createCycling with correct data on submit", async () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    await vi.waitFor(() => {
      expect(mockCreateCycling).toHaveBeenCalledWith({
        duration_seconds: 1800,
        distance_km: 20,
        date: expect.any(String),
        notes: "",
      });
    });
  });

  it("calls onWorkoutLogged after successful submit", async () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    await vi.waitFor(() => {
      expect(onWorkoutLogged).toHaveBeenCalled();
    });
  });

  it("shows success toast after submit", async () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    await vi.waitFor(() => {
      expect(screen.getByText("Cycling ride logged!")).toBeInTheDocument();
    });
  });

  it("submits with custom duration when provided", async () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.click(screen.getByText("Custom"));
    fireEvent.change(screen.getByPlaceholderText("Minutes"), { target: { value: "75" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    await vi.waitFor(() => {
      expect(mockCreateCycling).toHaveBeenCalledWith(
        expect.objectContaining({ duration_seconds: 4500 }),
      );
    });
  });

  // ── Error handling ──

  it("shows error toast on API failure", async () => {
    mockCreateCycling.mockRejectedValueOnce(new Error("Server error"));

    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    await vi.waitFor(() => {
      expect(screen.getByText("Failed to save cycling ride")).toBeInTheDocument();
    });
  });

  it("shows offline toast on OfflineError", async () => {
    const { OfflineError } = await import("../api");
    mockCreateCycling.mockRejectedValueOnce(new OfflineError());

    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    await vi.waitFor(() => {
      expect(screen.getByText("Cycling ride queued for sync")).toBeInTheDocument();
    });
  });

  it("does not submit without a valid distance", async () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Cycling"));
    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Save Cycling Ride"));

    expect(mockCreateCycling).not.toHaveBeenCalled();
  });

  // ── Recent entries ──

  it("renders recent rides when entries exist", async () => {
    mockGetCycling.mockResolvedValue([
      { id: 5, duration_seconds: 2700, distance_km: 24, date: "2026-08-01", notes: "" },
    ]);
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    await vi.waitFor(() => {
      expect(screen.getByText("Recent Cycling Rides")).toBeInTheDocument();
    });
    expect(screen.getByText("24.0 km")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit cycling")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete cycling")).toBeInTheDocument();
  });

  it("does not render recent rides when there are none", async () => {
    mockGetCycling.mockResolvedValue([]);
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    expect(screen.queryByText("Recent Cycling Rides")).not.toBeInTheDocument();
  });

  // ── Edit ──

  it("opens edit form populated from entry and calls update on submit", async () => {
    mockGetCycling.mockResolvedValue([
      { id: 5, duration_seconds: 2700, distance_km: 24, date: "2026-08-01", notes: "fast" },
    ]);
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Edit cycling")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit cycling"));

    // Form populated from the entry
    expect(screen.getByText("Edit Cycling Ride")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 24.0")).toHaveValue(24);

    fireEvent.change(screen.getByPlaceholderText("e.g. 24.0"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Update Cycling Ride"));

    await vi.waitFor(() => {
      expect(mockUpdateCycling).toHaveBeenCalledWith(5, {
        duration_seconds: 2700,
        distance_km: 30,
        date: "2026-08-01",
        notes: "fast",
      });
    });
  });

  // ── Delete ──

  it("confirms and deletes an entry", async () => {
    mockGetCycling.mockResolvedValue([
      { id: 5, duration_seconds: 2700, distance_km: 24, date: "2026-08-01", notes: "" },
    ]);
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Delete cycling")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete cycling"));
    expect(screen.getByText("Delete cycling ride?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      expect(mockDeleteCycling).toHaveBeenCalledWith(5);
    });
  });
});
