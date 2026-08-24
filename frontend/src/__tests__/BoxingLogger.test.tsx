import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BoxingLogger from "../components/BoxingLogger";
import { todayKey } from "../dateKey";

const mockCreateBoxing = vi.fn().mockResolvedValue({ id: 1 });
const mockGetBoxing = vi.fn().mockResolvedValue([]);
const mockUpdateBoxing = vi.fn().mockResolvedValue({ id: 1 });
const mockDeleteBoxing = vi.fn().mockResolvedValue(undefined);

vi.mock("../api", () => ({
  api: {
    createBoxing: (...args: unknown[]) => mockCreateBoxing(...args),
    getBoxing: (...args: unknown[]) => mockGetBoxing(...args),
    updateBoxing: (...args: unknown[]) => mockUpdateBoxing(...args),
    deleteBoxing: (...args: unknown[]) => mockDeleteBoxing(...args),
  },
  OfflineError: class OfflineError extends Error {
    readonly offline = true;
    constructor(message = "Offline") {
      super(message);
      this.name = "OfflineError";
    }
  },
}));

describe("BoxingLogger", () => {
  const onWorkoutLogged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Smoke tests ──

  it("renders the collapsed Boxing button", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    expect(screen.getByText("Boxing")).toBeInTheDocument();
  });

  // ── Expand / collapse ──

  it("expands the form when Boxing button is clicked", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    expect(screen.getByText("Log Boxing")).toBeInTheDocument();
    expect(screen.getByText("Save Boxing Workout")).toBeInTheDocument();
  });

  it("collapses the form when Close (X) is clicked", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    expect(screen.getByText("Log Boxing")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Close"));
    // Back to collapsed
    expect(screen.getByText("Boxing")).toBeInTheDocument();
  });

  it("collapses the form when backdrop is clicked", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    // Click the backdrop (the fixed overlay with bg-black/60)
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/60");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(screen.getByText("Boxing")).toBeInTheDocument();
  });

  // ── Duration selection ──

  it("shows duration quick-select buttons when form is open", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("shows custom minutes input when Custom is selected", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
  });

  it("switches away from custom input when a preset duration is clicked after Custom", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
    fireEvent.click(screen.getByText("15m"));
    expect(screen.queryByPlaceholderText("Minutes")).not.toBeInTheDocument();
  });

  // ── Form fields ──

  it("renders kcal per minute input with default value", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    const kcalInput = screen.getByDisplayValue("10");
    expect(kcalInput).toBeInTheDocument();
  });

  it("defaults the date to the local calendar day, not the UTC one", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    expect(screen.getByDisplayValue(todayKey())).toBeInTheDocument();
  });

  it("renders rounds optional input", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    expect(screen.getByPlaceholderText("e.g. 10")).toBeInTheDocument();
  });

  it("renders Notes input with aria-label", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  });

  it("shows estimated kcal preview", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    // Default 30min * 10 kcal/min = 300 kcal
    expect(screen.getByText(/~300 kcal/)).toBeInTheDocument();
  });

  // ── Submit ──

  it("calls api.createBoxing with correct data on submit", async () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));

    // Select 30m (default is already 30m = 1800s)
    fireEvent.click(screen.getByText("Save Boxing Workout"));

    await vi.waitFor(() => {
      expect(mockCreateBoxing).toHaveBeenCalledWith({
        duration_seconds: 1800,
        kcal_per_min: 10,
        rounds: null,
        date: expect.any(String),
        notes: "",
      });
    });
  });

  it("calls onWorkoutLogged after successful submit", async () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    fireEvent.click(screen.getByText("Save Boxing Workout"));

    await vi.waitFor(() => {
      expect(onWorkoutLogged).toHaveBeenCalled();
    });
  });

  it("shows success toast after submit", async () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    fireEvent.click(screen.getByText("Save Boxing Workout"));

    await vi.waitFor(() => {
      expect(screen.getByText(/Boxing workout logged!/)).toBeInTheDocument();
    });
  });

  // ── Error handling ──

  it("shows error toast on API failure", async () => {
    mockCreateBoxing.mockRejectedValueOnce(new Error("Server error"));

    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    fireEvent.click(screen.getByText("Save Boxing Workout"));

    await vi.waitFor(() => {
      expect(
        screen.getByText("Failed to save boxing workout"),
      ).toBeInTheDocument();
    });
  });

  it("shows offline toast on OfflineError", async () => {
    const { OfflineError } = await import("../api");
    mockCreateBoxing.mockRejectedValueOnce(new OfflineError());

    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    fireEvent.click(screen.getByText("Save Boxing Workout"));

    await vi.waitFor(() => {
      expect(
        screen.getByText("Boxing workout queued for sync"),
      ).toBeInTheDocument();
    });
  });

  // ── Custom duration submission ──

  it("submits with custom duration when provided", async () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));

    // Select Custom, then type 20 minutes (= 1200 seconds)
    fireEvent.click(screen.getByText("Custom"));
    const customInput = screen.getByPlaceholderText("Minutes");
    fireEvent.change(customInput, { target: { value: "20" } });

    fireEvent.click(screen.getByText("Save Boxing Workout"));

    await vi.waitFor(() => {
      expect(mockCreateBoxing).toHaveBeenCalledWith(
        expect.objectContaining({ duration_seconds: 1200 }),
      );
    });
  });

  // ── Recent entries ──

  it("renders recent sessions when entries exist", async () => {
    mockGetBoxing.mockResolvedValue([
      { id: 3, duration_seconds: 2700, kcal_per_min: 10, rounds: 10, date: "2026-08-01", notes: "" },
    ]);
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    await vi.waitFor(() => {
      expect(screen.getByText("Recent Boxing Sessions")).toBeInTheDocument();
    });
    expect(screen.getByText("10 rounds")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit boxing")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete boxing")).toBeInTheDocument();
  });

  it("does not render recent sessions when there are none", async () => {
    mockGetBoxing.mockResolvedValue([]);
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    expect(screen.queryByText("Recent Boxing Sessions")).not.toBeInTheDocument();
  });

  // ── Edit ──

  it("opens edit form populated from entry and calls update on submit", async () => {
    mockGetBoxing.mockResolvedValue([
      { id: 3, duration_seconds: 2700, kcal_per_min: 12, rounds: 12, date: "2026-08-01", notes: "hard" },
    ]);
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Edit boxing")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit boxing"));

    expect(screen.getByText("Edit Boxing Session")).toBeInTheDocument();
    // rounds populated
    expect(screen.getByPlaceholderText("e.g. 10")).toHaveValue(12);

    fireEvent.change(screen.getByPlaceholderText("e.g. 10"), { target: { value: "15" } });
    fireEvent.click(screen.getByText("Update Boxing Session"));

    await vi.waitFor(() => {
      expect(mockUpdateBoxing).toHaveBeenCalledWith(3, {
        duration_seconds: 2700,
        kcal_per_min: 12,
        rounds: 15,
        date: "2026-08-01",
        notes: "hard",
      });
    });
  });

  // ── Delete ──

  it("confirms and deletes an entry", async () => {
    mockGetBoxing.mockResolvedValue([
      { id: 3, duration_seconds: 2700, kcal_per_min: 10, rounds: 10, date: "2026-08-01", notes: "" },
    ]);
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText("Delete boxing")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Delete boxing"));
    expect(screen.getByText("Delete boxing session?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete"));

    await vi.waitFor(() => {
      expect(mockDeleteBoxing).toHaveBeenCalledWith(3);
    });
  });
});
