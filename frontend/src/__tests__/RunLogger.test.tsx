import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RunLogger from "../components/RunLogger";
import { todayKey } from "../dateKey";

const mockCreateRun = vi.fn();

vi.mock("../api", () => {
  class OfflineError extends Error {
    constructor() {
      super("offline");
      this.name = "OfflineError";
    }
  }
  return {
    api: {
      createRun: (...args: unknown[]) => mockCreateRun(...args),
      getRuns: vi.fn().mockResolvedValue([]),
      updateRun: vi.fn().mockResolvedValue({ id: 1 }),
      deleteRun: vi.fn().mockResolvedValue(undefined),
    },
    OfflineError,
  };
});

describe("RunLogger", () => {
  beforeEach(() => {
    mockCreateRun.mockClear();
  });

  it("renders the collapsed Run button initially", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("renders the collapsed Walk button initially", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="walk" />);
    expect(screen.getByText("Walk")).toBeInTheDocument();
  });

  it("expands the form when clicked", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));
    expect(screen.getByText("Save Run")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 5.0")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  });

  it("expands the walk form when clicked", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="walk" />);
    fireEvent.click(screen.getByText("Walk"));
    expect(screen.getByText("Save Walk")).toBeInTheDocument();
    expect(screen.getByText("Log a Walk")).toBeInTheDocument();
  });

  it("collapses the form when Close is clicked", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("shows custom duration input when Custom is selected", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getByPlaceholderText("Minutes")).toBeInTheDocument();
  });

  it("sets custom duration minutes convert to seconds", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));
    fireEvent.click(screen.getByText("Custom"));
    const customInput = screen.getByPlaceholderText("Minutes");
    fireEvent.change(customInput, { target: { value: "20" } });
    // Should cause pace calc: 20 min = 1200 sec
    const distanceInput = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(distanceInput, { target: { value: "5" } });
    // Pace should be 1200/5 = 240 sec/km = 4:00/km
    expect(screen.getByText("4:00 /km")).toBeInTheDocument();
  });

  it("shows pace preview when distance and duration are set", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    const distanceInput = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(distanceInput, { target: { value: "5" } });

    // Pace should appear (30min / 5km = 6:00/km)
    expect(screen.getByText("6:00 /km")).toBeInTheDocument();
  });

  it("dismisses form when backdrop is clicked", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));
    expect(screen.getByText("Save Run")).toBeInTheDocument();

    // Click the backdrop (the fixed overlay)
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);

    expect(screen.queryByText("Save Run")).not.toBeInTheDocument();
  });

  it("changes date input value", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    const dateInput = screen.getByDisplayValue(todayKey());
    fireEvent.change(dateInput, { target: { value: "2026-07-15" } });
    expect(dateInput).toHaveValue("2026-07-15");
  });

  it("types notes into the notes field", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    const notesInput = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.change(notesInput, { target: { value: "Felt great!" } });
    expect(notesInput).toHaveValue("Felt great!");
  });

  it("submits run data successfully", async () => {
    mockCreateRun.mockResolvedValue({ id: 1 });
    const onRunLogged = vi.fn();

    render(<RunLogger onRunLogged={onRunLogged} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    fireEvent.change(screen.getByPlaceholderText("e.g. 5.0"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), {
      target: { value: "Good run" },
    });

    fireEvent.click(screen.getByText("Save Run"));

    await waitFor(() => {
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_seconds: 1800,
          distance_km: 5,
          run_type: "run",
          notes: "Good run",
        }),
      );
    });
    expect(onRunLogged).toHaveBeenCalled();
  });

  it("submits walk data successfully", async () => {
    mockCreateRun.mockResolvedValue({ id: 2 });
    const onRunLogged = vi.fn();

    render(<RunLogger onRunLogged={onRunLogged} runType="walk" />);
    fireEvent.click(screen.getByText("Walk"));

    fireEvent.change(screen.getByPlaceholderText("e.g. 5.0"), {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByText("Save Walk"));

    await waitFor(() => {
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          distance_km: 3,
          run_type: "walk",
        }),
      );
    });
    expect(onRunLogged).toHaveBeenCalled();
  });

  it("handles OfflineError on submit", async () => {
    const { OfflineError } = await import("../api");
    mockCreateRun.mockRejectedValue(new OfflineError());
    const onRunLogged = vi.fn();

    render(<RunLogger onRunLogged={onRunLogged} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    fireEvent.change(screen.getByPlaceholderText("e.g. 5.0"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByText("Save Run"));

    await waitFor(() => {
      expect(screen.getByText(/queued for sync/)).toBeInTheDocument();
    });
    // onRunLogged is NOT called for OfflineError
    expect(onRunLogged).not.toHaveBeenCalled();
  });

  it("handles generic error on submit", async () => {
    mockCreateRun.mockRejectedValue(new Error("Network error"));

    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    fireEvent.change(screen.getByPlaceholderText("e.g. 5.0"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByText("Save Run"));

    await waitFor(() => {
      expect(screen.getByText(/Failed to log run/)).toBeInTheDocument();
    });
  });

  it("does not submit with invalid distance", async () => {
    mockCreateRun.mockResolvedValue({ id: 1 });

    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    // Leave distance empty - save button should be disabled
    const saveBtn = screen.getByText("Save Run");
    expect(saveBtn).toBeDisabled();

    fireEvent.click(saveBtn);
    expect(mockCreateRun).not.toHaveBeenCalled();
  });

  it("selects different duration options", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" />);
    fireEvent.click(screen.getByText("Run"));

    fireEvent.click(screen.getByText("45m"));

    const distanceInput = screen.getByPlaceholderText("e.g. 5.0");
    fireEvent.change(distanceInput, { target: { value: "10" } });

    // 45 min = 2700 sec, pace = 2700/10 = 270 = 4:30/km
    expect(screen.getByText("4:30 /km")).toBeInTheDocument();
  });
});