import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import HistoryTab from "../components/HistoryTab";
import type { WorkoutSession } from "../api";

// Hoist mutable references so vi.mock factories can access them.
let mockGetAllSessionsImpl: () => Promise<WorkoutSession[]> = async () => [];
let mockDeleteSessionImpl = vi.fn();

// Mock the api module — data must be inlined since vi.mock factories are hoisted
vi.mock("../api", () => ({
  api: {
    getAllSessions: vi.fn().mockImplementation(() => mockGetAllSessionsImpl()),
    deleteSession: vi.fn().mockImplementation((...args: unknown[]) => mockDeleteSessionImpl(...args)),
  },
}));

// Mock all subcomponents used by HistoryTab
vi.mock("../components/CalendarView", () => ({
  default: () => <div data-testid="calendar-view">CalendarView</div>,
}));

vi.mock("../components/skeletons/HistorySkeleton", () => ({
  default: () => <div data-testid="history-skeleton">Loading...</div>,
}));

vi.mock("../components/history/DateRangeFilter", () => ({
  default: ({
    onRangeChange,
    onToggleCalendar,
    range,
  }: {
    onRangeChange: (key: string) => void;
    onToggleCalendar: () => void;
    range: string;
  }) => (
    <div data-testid="date-range-filter">
      <button data-testid="range-7d" onClick={() => onRangeChange("7d")}>
        7 Days
      </button>
      <button data-testid="range-30d" onClick={() => onRangeChange("30d")}>
        30 Days
      </button>
      <button data-testid="range-week" onClick={() => onRangeChange("week")}>
        This week
      </button>
      <button data-testid="toggle-calendar" onClick={onToggleCalendar}>
        Calendar
      </button>
      <span data-testid="current-range">{range}</span>
    </div>
  ),
}));

vi.mock("../components/history/DayBars", () => ({
  default: () => <div data-testid="day-bars">DayBars</div>,
}));

vi.mock("../components/history/HeatmapChart", () => ({
  default: () => <div data-testid="heatmap-chart">HeatmapChart</div>,
}));

vi.mock("../components/history/ImportExport", () => ({
  default: () => <div data-testid="import-export">ImportExport</div>,
}));

vi.mock("../components/history/SessionDetail", () => ({
  default: ({
    session,
    onClose,
  }: {
    session: WorkoutSession;
    onClose: () => void;
    onUpdate: () => void;
  }) => (
    <div data-testid="session-detail">
      <span>{session.template_name}</span>
      <button data-testid="close-detail" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../components/history/SessionList", () => ({
  default: ({
    sessions,
    onSelect,
    emptyLabel,
  }: {
    sessions: WorkoutSession[];
    onSelect: (s: WorkoutSession) => void;
    onEditDate: () => void;
    onDelete: () => void;
    emptyLabel: string;
  }) => (
    <div data-testid="session-list">
      {sessions.length === 0 ? (
        <span>{emptyLabel}</span>
      ) : (
        sessions.map((s) => (
          <button key={s.id} data-testid={`session-${s.id}`} onClick={() => onSelect(s)}>
            {s.template_name}
          </button>
        ))
      )}
    </div>
  ),
}));

vi.mock("../components/history/StatsGrid", () => ({
  default: () => <div data-testid="stats-grid">StatsGrid</div>,
}));

vi.mock("../components/history/WeekdayBarChart", () => ({
  default: () => <div data-testid="weekday-bar-chart">WeekdayBarChart</div>,
}));

describe("HistoryTab", () => {
  const defaultSessions: WorkoutSession[] = [
    {
      id: 1,
      template_id: 10,
      template_name: "Morning Routine",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      total_duration_seconds: 1800,
      total_kcal_estimated: 250,
      notes: "",
      boxing_entry_id: null,
      run_entry_id: null,
      cycling_entry_id: null,
      exercises: [
        {
          id: 101, session_id: 1, exercise_id: 5, exercise_name: "Push-ups",
          duration_seconds: 120, kcal_burned: 25, order_index: 0, completed: true,
          image_url: null, logs: [],
        },
      ],
    },
    {
      id: 2,
      template_id: 11,
      template_name: "Run: 5.0km",
      started_at: new Date(Date.now() - 86400000).toISOString(),
      finished_at: new Date(Date.now() - 86400000).toISOString(),
      total_duration_seconds: 1500,
      total_kcal_estimated: 350,
      notes: "",
      boxing_entry_id: null,
      run_entry_id: null,
      cycling_entry_id: null,
      exercises: [],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGetAllSessionsImpl = async () => [...defaultSessions];
    mockDeleteSessionImpl = vi.fn().mockResolvedValue(undefined);
  });

  // ── Smoke tests ──────────────────────────────────────────

  it("shows loading skeleton initially", () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    expect(screen.getByTestId("history-skeleton")).toBeInTheDocument();
  });

  it("renders the range view after sessions load", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("date-range-filter")).toBeInTheDocument();
    });

    expect(screen.getByTestId("stats-grid")).toBeInTheDocument();
    expect(screen.getByTestId("day-bars")).toBeInTheDocument();
    expect(screen.getByTestId("session-list")).toBeInTheDocument();
    expect(screen.getByTestId("import-export")).toBeInTheDocument();
  });

  it("renders session names in the list after load", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("session-1")).toBeInTheDocument();
    });

    expect(screen.getByTestId("session-1")).toHaveTextContent("Morning Routine");
    expect(screen.getByTestId("session-2")).toHaveTextContent("Run: 5.0km");
  });

  it("shows 'View all' button in range view", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("View all")).toBeInTheDocument();
    });
  });

  // ── Key interactions ─────────────────────────────────────

  it("switches to all-time view when 'View all' is clicked", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("View all")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View all"));

    // Should show All time section and a Back button
    await waitFor(() => {
      expect(screen.getByText("All time")).toBeInTheDocument();
    });
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByTestId("weekday-bar-chart")).toBeInTheDocument();
  });

  it("returns to range view when 'Back' is clicked from all-time view", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("View all")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View all"));

    await waitFor(() => {
      expect(screen.getByText("Back")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Back"));

    await waitFor(() => {
      expect(screen.getByText("View all")).toBeInTheDocument();
    });
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("toggles calendar view when calendar button is clicked", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("toggle-calendar")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("toggle-calendar"));

    await waitFor(() => {
      expect(screen.getByTestId("calendar-view")).toBeInTheDocument();
    });
  });

  it("opens session detail when a session is selected", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("session-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("session-1"));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail")).toBeInTheDocument();
    });
    const detail = screen.getByTestId("session-detail");
    expect(detail).toHaveTextContent("Morning Routine");
  });

  it("closes session detail when close is clicked", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("session-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("session-1"));

    await waitFor(() => {
      expect(screen.getByTestId("session-detail")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("close-detail"));

    await waitFor(() => {
      expect(screen.queryByTestId("session-detail")).not.toBeInTheDocument();
    });
  });

  // ── Error & empty states ──────────────────────────────────

  it("shows error state when API fails", async () => {
    mockGetAllSessionsImpl = async () => {
      throw new Error("Network error");
    };

    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load sessions")).toBeInTheDocument();
    });
  });

  it("shows empty state when no sessions", async () => {
    mockGetAllSessionsImpl = async () => [];

    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    });
  });

  // ── Range changes ────────────────────────────────────────

  it("switches to 30d range and shows heatmap", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("range-30d")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("range-30d"));

    await waitFor(() => {
      expect(screen.getByTestId("heatmap-chart")).toBeInTheDocument();
    });
  });

  it("switches to 'This week' range", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("range-week")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("range-week"));

    await waitFor(() => {
      expect(screen.getByTestId("day-bars")).toBeInTheDocument();
    });
  });

  it("filters sessions by exercise name search and clears", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("session-1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("session-2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search sessions by exercise"), {
      target: { value: "push" },
    });
    await waitFor(() => {
      expect(screen.queryByTestId("session-2")).toBeNull();
      expect(screen.getByTestId("session-1")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 session with/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search"));
    await waitFor(() => {
      expect(screen.getByTestId("session-2")).toBeInTheDocument();
    });
  });

  it("groups sessions by template and expands a group", async () => {
    render(<HistoryTab refreshKey={0} onStartWorkout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("session-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Group by template"));
    // Both template names appear as group headers; toggle label flips.
    expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    expect(screen.getByText("Run: 5.0km")).toBeInTheDocument();
    expect(screen.getByText("Show flat list")).toBeInTheDocument();
    // Expand the Morning Routine group → its session renders inside.
    fireEvent.click(screen.getByText("Morning Routine"));
    expect(screen.getAllByText("Morning Routine").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/1 session ·/).length).toBeGreaterThanOrEqual(1);
    // Toggle back to flat list restores both session buttons.
    fireEvent.click(screen.getByText("Show flat list"));
    await waitFor(() => {
      expect(screen.getByTestId("session-2")).toBeInTheDocument();
    });
  });
});