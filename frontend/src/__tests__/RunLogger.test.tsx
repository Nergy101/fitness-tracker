import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RunLogger from "../components/RunLogger";
import { todayKey } from "../dateKey";

const mockCreateRun = vi.fn();
const mockUpdateRun = vi.fn().mockResolvedValue({ id: 1 });

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
      updateRun: (...args: unknown[]) => mockUpdateRun(...args),
    },
    OfflineError,
  };
});

describe("RunLogger", () => {
  beforeEach(() => {
    mockCreateRun.mockClear();
  });

  it("opens the requested run sheet and renders its accessible controls", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);
    expect(screen.getByRole("dialog", {name:"Log a Run"})).toBeInTheDocument();
     expect(screen.getByText("Save Run")).toBeInTheDocument();
    expect(screen.getByRole("textbox", {name:"Distance in km"})).toHaveValue("5");
     expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
   });
 
  it("only opens the matching run or walk request", () => {
    const { rerender } = render(<RunLogger onRunLogged={vi.fn()} runType="walk" openRequest={{key:1,runType:"run",distanceKm:3}} />);
    expect(screen.queryByRole("dialog", {name:"Log a Walk"})).not.toBeInTheDocument();
    rerender(<RunLogger onRunLogged={vi.fn()} runType="walk" openRequest={{key:2,runType:"walk",distanceKm:3}} />);
    expect(screen.getByRole("dialog", {name:"Log a Walk"})).toBeInTheDocument();
     expect(screen.getByText("Save Walk")).toBeInTheDocument();
  });

  it("has functional steppers, quick picks, and computed pace in the sheet", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);
    fireEvent.change(screen.getByRole("textbox", {name:"Duration in minutes"}), {target:{value:"20"}});
    expect(screen.getByText("4:00 /km")).toBeInTheDocument();
    expect(screen.getByRole("button", {name:"45m"})).toBeInTheDocument();
  });

  it("closes the requested run sheet from the backdrop", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);
    fireEvent.click(document.querySelector(".fixed.inset-0.bg-black\\/60")!);
    expect(screen.queryByRole("dialog", {name:"Log a Run"})).not.toBeInTheDocument();
  });

  it("changes date and notes in the opened run sheet", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);
    const dateInput = screen.getByDisplayValue(todayKey());
    fireEvent.change(dateInput, { target: { value: "2026-07-15" } });
    expect(dateInput).toHaveValue("2026-07-15");
    const notesInput = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.change(notesInput, { target: { value: "Felt great!" } });
    expect(notesInput).toHaveValue("Felt great!");
  });

  it("submits run data successfully", async () => {
    mockCreateRun.mockResolvedValue({ id: 1 });
    const onRunLogged = vi.fn();

    render(<RunLogger onRunLogged={onRunLogged} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);
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

    render(<RunLogger onRunLogged={onRunLogged} runType="walk" openRequest={{key:1,runType:"walk",distanceKm:3}} />);
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

    render(<RunLogger onRunLogged={onRunLogged} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);

    fireEvent.click(screen.getByText("Save Run"));

    await waitFor(() => {
      expect(screen.getByText(/queued for sync/)).toBeInTheDocument();
    });
    // onRunLogged is NOT called for OfflineError
    expect(onRunLogged).not.toHaveBeenCalled();
  });

  it("handles generic error on submit", async () => {
    mockCreateRun.mockRejectedValue(new Error("Network error"));

    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run",distanceKm:5}} />);

    fireEvent.click(screen.getByText("Save Run"));

    await waitFor(() => {
      expect(screen.getByText(/Failed to save run/)).toBeInTheDocument();
    });
  });

  it("does not submit with a missing distance", () => {
    mockCreateRun.mockResolvedValue({ id: 1 });
    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run"}} />);
    expect(screen.getByText("Save Run")).toBeDisabled();
    fireEvent.click(screen.getByText("Save Run"));
    expect(mockCreateRun).not.toHaveBeenCalled();
  });

  it("selecting a duration quick pick updates the pace preview", () => {
    render(<RunLogger onRunLogged={vi.fn()} runType="run" openRequest={{key:1,runType:"run",distanceKm:10}} />);
    fireEvent.click(screen.getByRole("button", {name:"45m"}));
    expect(screen.getByText("4:30 /km")).toBeInTheDocument();
  });

  // ── Edit hand-off from the Recent-workouts tags ──

  it("opens the edit form from an editEntry prop and calls update on submit", async () => {
    const entry = {
      id: 3,
      duration_seconds: 1800,
      distance_km: 3,
      pace_per_km: 600,
      run_type: "run",
      date: "2026-08-01",
      notes: "quick",
      created_at: "2026-08-01T10:00:00",
    };
    const onEditHandled = vi.fn();

    render(
      <RunLogger
        onRunLogged={vi.fn()}
        runType="run"
        editEntry={entry}
        onEditHandled={onEditHandled}
      />,
    );

    expect(screen.getByText("Edit Run")).toBeInTheDocument();
    expect(screen.getByRole("textbox", {name:"Distance in km"})).toHaveValue("3");
    expect(onEditHandled).toHaveBeenCalled();

fireEvent.change(screen.getByRole("textbox", {name:"Distance in km"}), { target: { value: "4" } });
    fireEvent.click(screen.getByText("Update Run"));

    await waitFor(() => {
      expect(mockUpdateRun).toHaveBeenCalledWith(3, {
        duration_seconds: 1800,
        distance_km: 4,
        run_type: "run",
        date: "2026-08-01",
        notes: "quick",
      });
    });
  });

  it("keeps run_type=walk when a walk entry is edited", async () => {
    const entry = {
      id: 7,
      duration_seconds: 3600,
      distance_km: 2,
      pace_per_km: 1800,
      run_type: "walk",
      date: "2026-08-02",
      notes: "",
      created_at: "2026-08-02T09:00:00",
    };

    render(<RunLogger onRunLogged={vi.fn()} runType="walk" editEntry={entry} />);

    expect(screen.getByText("Edit Walk")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Update Walk"));

    await waitFor(() => {
      expect(mockUpdateRun).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ run_type: "walk", distance_km: 2 }),
      );
    });
  });
});