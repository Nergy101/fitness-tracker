import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BoxingLogger from "../components/BoxingLogger";
import { todayKey } from "../dateKey";

const mockCreateBoxing = vi.fn().mockResolvedValue({ id: 1 });
const mockUpdateBoxing = vi.fn().mockResolvedValue({ id: 1 });

vi.mock("../api", () => ({
  api: {
    createBoxing: (...args: unknown[]) => mockCreateBoxing(...args),
    updateBoxing: (...args: unknown[]) => mockUpdateBoxing(...args),
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

  it("opens a requested boxing sheet with the requested duration and rounds", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,durationSeconds:1800,rounds:6}} />);
    expect(screen.getByRole("dialog",{name:"Log Boxing"})).toBeInTheDocument();
    expect(screen.getByRole("textbox",{name:"Rounds"})).toHaveValue("6");
    expect(screen.getByText("Save Boxing Workout")).toBeInTheDocument();
  });

  it("closes an opened boxing sheet by backdrop", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,durationSeconds:1800,rounds:6}} />);
    fireEvent.click(document.querySelector(".fixed.inset-0.bg-black\\/60")!);
    expect(screen.queryByRole("dialog",{name:"Log Boxing"})).not.toBeInTheDocument();
  });

  it("shows duration picks, rounds, date, notes, and energy on a sheet", () => {
    render(<BoxingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,durationSeconds:1800,rounds:6}} />);
    expect(screen.getByRole("button",{name:"15m"})).toBeInTheDocument();
    expect(screen.getByRole("textbox",{name:"Rounds"})).toHaveValue("6");
    expect(screen.getByDisplayValue(todayKey())).toBeInTheDocument();
    expect(screen.getByRole("textbox",{name:"Notes"})).toBeInTheDocument();
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

  // ── Edit hand-off from the Recent-workouts tags ──

  it("opens the edit form from an editEntry prop and calls update on submit", async () => {
    const entry = {
      id: 3,
      duration_seconds: 2700,
      kcal_per_min: 12,
      rounds: 12,
      date: "2026-08-01",
      notes: "hard",
      created_at: "2026-08-01T10:00:00",
    };
    const onEditHandled = vi.fn();
    render(
      <BoxingLogger
        onWorkoutLogged={onWorkoutLogged}
        editEntry={entry}
        onEditHandled={onEditHandled}
      />,
    );

    expect(screen.getByText("Edit Boxing Session")).toBeInTheDocument();
    expect(screen.getByRole("textbox", {name:"Rounds"})).toHaveValue("12");
    expect(onEditHandled).toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", {name:"Rounds"}), {target:{value:"15"}});
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
});
