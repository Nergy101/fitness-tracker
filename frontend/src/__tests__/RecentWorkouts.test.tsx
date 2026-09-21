import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import RecentWorkouts from "../components/RecentWorkouts";
import { dayKey } from "../dateKey";

const mockGetRuns = vi.fn();
const mockGetCycling = vi.fn();
const mockGetBoxing = vi.fn();
const mockDeleteRun = vi.fn();
const mockDeleteCycling = vi.fn();
const mockDeleteBoxing = vi.fn();

vi.mock("../api", () => {
  class OfflineError extends Error {
    readonly offline = true;
    constructor(message = "Offline") {
      super(message);
      this.name = "OfflineError";
    }
  }
  return {
    api: {
      getRuns: (...args: unknown[]) => mockGetRuns(...args),
      getCycling: (...args: unknown[]) => mockGetCycling(...args),
      getBoxing: (...args: unknown[]) => mockGetBoxing(...args),
      deleteRun: (...args: unknown[]) => mockDeleteRun(...args),
      deleteCycling: (...args: unknown[]) => mockDeleteCycling(...args),
      deleteBoxing: (...args: unknown[]) => mockDeleteBoxing(...args),
    },
    OfflineError,
  };
});

vi.mock("../useFocusTrap", () => ({ useFocusTrap: vi.fn() }));

/** Clock-relative days: hardcoded dates drop out of "today" a week later. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

const runEntry = {
  id: 11,
  duration_seconds: 1800,
  distance_km: 5,
  pace_per_km: 360,
  run_type: "run",
  date: daysAgo(0),
  notes: "easy",
  created_at: `${daysAgo(0)}T08:00:00`,
};

const walkEntry = {
  id: 12,
  duration_seconds: 3600,
  distance_km: 3,
  pace_per_km: 1200,
  run_type: "walk",
  date: daysAgo(0),
  notes: "",
  created_at: `${daysAgo(0)}T09:00:00`,
};

const cyclingEntry = {
  id: 13,
  duration_seconds: 2700,
  distance_km: 24,
  date: daysAgo(2),
  notes: "",
  created_at: `${daysAgo(2)}T09:00:00`,
};

const boxingEntry = {
  id: 14,
  duration_seconds: 3600,
  kcal_per_min: 10,
  rounds: 12,
  date: daysAgo(3),
  notes: "",
  created_at: `${daysAgo(3)}T09:00:00`,
};

const runTag = () => screen.getByLabelText("Runs Today: edit or delete");
const walkTag = () => screen.getByLabelText("Walks Today: edit or delete");
const cyclingTag = () => screen.getByLabelText(/^Cycling .*: edit or delete$/);
const boxingTag = () => screen.getByLabelText(/^Boxing .*: edit or delete$/);

function renderHub(onEdit = vi.fn(), onChanged = vi.fn()) {
  return render(<RecentWorkouts onEdit={onEdit} onChanged={onChanged} />);
}

describe("RecentWorkouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuns.mockResolvedValue([runEntry, walkEntry]);
    mockGetCycling.mockResolvedValue([cyclingEntry]);
    mockGetBoxing.mockResolvedValue([boxingEntry]);
    mockDeleteRun.mockResolvedValue(undefined);
    mockDeleteCycling.mockResolvedValue(undefined);
    mockDeleteBoxing.mockResolvedValue(undefined);
  });

  it("merges every activity type into one tag row", async () => {
    renderHub();
    expect(await screen.findByText("Recent workouts")).toBeInTheDocument();

    // A single combined list, not one heading per activity type.
    expect(screen.getAllByText("Recent workouts")).toHaveLength(1);
    expect(runTag()).toBeInTheDocument();
    expect(walkTag()).toBeInTheDocument();
    expect(cyclingTag()).toBeInTheDocument();
    expect(boxingTag()).toBeInTheDocument();

    // Tags stay compact: one primary value each.
    expect(screen.getByText("5.0 km")).toBeInTheDocument();
    expect(screen.getByText("24.0 km")).toBeInTheDocument();
    expect(screen.getByText("1h")).toBeInTheDocument();
    // Newest first, with created_at breaking ties inside the same day:
    // walk (today 09:00) before run (today 08:00), then cycling, then boxing.
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "");
    expect(labels[0]).toBe("Walks Today: edit or delete");
    expect(labels[1]).toBe("Runs Today: edit or delete");
    expect(labels[2]).toMatch(/^Cycling /);
    expect(labels[3]).toMatch(/^Boxing /);
  });

  it("renders nothing when no activities are logged", async () => {
    mockGetRuns.mockResolvedValue([]);
    mockGetCycling.mockResolvedValue([]);
    mockGetBoxing.mockResolvedValue([]);
    renderHub();
    await waitFor(() => {
      expect(mockGetBoxing).toHaveBeenCalled();
    });
    expect(screen.queryByText("Recent workouts")).not.toBeInTheDocument();
  });

  it("opens the actions sheet for the tapped tag", async () => {
    renderHub();
    fireEvent.click(await screen.findByLabelText("Runs Today: edit or delete"));

    expect(screen.getByRole("dialog", { name: "Run actions" })).toBeInTheDocument();
    expect(screen.getByText("30m · 5.0 km")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hands the entry to onEdit when Edit is tapped", async () => {
    const onEdit = vi.fn();
    renderHub(onEdit);
    fireEvent.click(await screen.findByLabelText(/^Cycling .*: edit or delete$/));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith({ kind: "cycling", entry: cyclingEntry });
    // Sheet closes so the logger's own form is the only overlay left.
    expect(
      screen.queryByRole("dialog", { name: "Cycling ride actions" }),
    ).not.toBeInTheDocument();
  });

  it("routes walk tags to the walk kind", async () => {
    const onEdit = vi.fn();
    renderHub(onEdit);
    fireEvent.click(await screen.findByLabelText("Walks Today: edit or delete"));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith({ kind: "walk", entry: walkEntry });
  });

  it("routes boxing tags to the boxing kind", async () => {
    const onEdit = vi.fn();
    renderHub(onEdit);
    fireEvent.click(await screen.findByLabelText(/^Boxing .*: edit or delete$/));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledWith({ kind: "boxing", entry: boxingEntry });
  });

  it("asks for confirmation before deleting, then drops the tag", async () => {
    const onChanged = vi.fn();
    renderHub(vi.fn(), onChanged);
    fireEvent.click(await screen.findByLabelText("Runs Today: edit or delete"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // First Delete only opens the confirmation step.
    expect(mockDeleteRun).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockDeleteRun).toHaveBeenCalledWith(11);
    });
    expect(await screen.findByText("Run deleted")).toBeInTheDocument();
    expect(screen.queryByLabelText("Runs Today: edit or delete")).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it("can cancel the delete confirmation", async () => {
    renderHub();
    fireEvent.click(await screen.findByLabelText(/^Boxing .*: edit or delete$/));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(mockDeleteBoxing).not.toHaveBeenCalled();
  });

  it("queues the delete for sync when offline", async () => {
    const { OfflineError } = await import("../api");
    mockDeleteCycling.mockRejectedValue(new OfflineError());
    renderHub();
    fireEvent.click(await screen.findByLabelText(/^Cycling .*: edit or delete$/));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Cycling ride delete queued for sync"),
    ).toBeInTheDocument();
  });

  it("refetches when refreshKey changes", async () => {
    const { rerender } = render(<RecentWorkouts onEdit={vi.fn()} refreshKey={0} />);
    await screen.findByText("Recent workouts");
    expect(mockGetRuns).toHaveBeenCalledTimes(1);

    rerender(<RecentWorkouts onEdit={vi.fn()} refreshKey={1} />);
    await waitFor(() => {
      expect(mockGetRuns).toHaveBeenCalledTimes(2);
    });
  });
});
