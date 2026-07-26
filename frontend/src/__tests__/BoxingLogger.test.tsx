import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BoxingLogger from "../components/BoxingLogger";

const mockCreateBoxing = vi.fn().mockResolvedValue({ id: 1 });

vi.mock("../api", () => ({
  api: {
    createBoxing: (...args: unknown[]) => mockCreateBoxing(...args),
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

  it("renders date input", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} />);
    fireEvent.click(screen.getByText("Boxing"));
    const dateInput = screen.getByDisplayValue(
      new Date().toISOString().slice(0, 10),
    );
    expect(dateInput).toBeInTheDocument();
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
        screen.getByText("Failed to log boxing workout"),
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
});
