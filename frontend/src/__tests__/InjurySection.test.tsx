import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InjurySection from "../components/health/InjurySection";
import type {
  InjuryMarkerResponse,
  InjuryMarkerCreate,
  InjuryMarkerUpdate,
} from "../api";

const mockGetInjuries = vi.fn();
const mockCreateInjury = vi.fn();
const mockUpdateInjury = vi.fn();
const mockDeleteInjury = vi.fn();

vi.mock("../api", () => ({
  api: {
    getInjuries: (...args: unknown[]) => mockGetInjuries(...args),
    createInjury: (...args: unknown[]) => mockCreateInjury(...args),
    updateInjury: (...args: unknown[]) => mockUpdateInjury(...args),
    deleteInjury: (...args: unknown[]) => mockDeleteInjury(...args),
  },
}));

vi.mock("@phosphor-icons/react", () => ({
  BandaidsIcon: ({ size }: { size?: number }) => <span data-icon="bandaids" data-size={size} />,
  PlusCircleIcon: ({ size }: { size?: number }) => <span data-icon="plus-circle" data-size={size} />,
  XIcon: ({ size }: { size?: number }) => <span data-icon="x" data-size={size} />,
  CaretUpIcon: ({ size }: { size?: number }) => <span data-icon="caret-up" data-size={size} />,
  CaretDownIcon: ({ size }: { size?: number }) => <span data-icon="caret-down" data-size={size} />,
  BarbellIcon: ({ size }: { size?: number }) => <span data-icon="barbell" data-size={size} />,
  PersonSimpleRunIcon: ({ size }: { size?: number }) => <span data-icon="run" data-size={size} />,
  SneakerIcon: ({ size }: { size?: number }) => <span data-icon="sneaker" data-size={size} />,
  BoxingGloveIcon: ({ size }: { size?: number }) => <span data-icon="boxing" data-size={size} />,
  HandFistIcon: ({ size }: { size?: number }) => <span data-icon="fist" data-size={size} />,
}));

const activeInjury: InjuryMarkerResponse = {
  id: 1,
  date: "2026-07-20",
  body_part: "left knee",
  severity: 3,
  notes: "Hurt during squats",
  resolved_date: null,
  created_at: "2026-07-20T00:00:00Z",
};

const resolvedInjury: InjuryMarkerResponse = {
  id: 2,
  date: "2026-06-15",
  body_part: "right ankle",
  severity: 2,
  notes: "",
  resolved_date: "2026-07-01",
  created_at: "2026-06-15T00:00:00Z",
};

describe("InjurySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInjuries.mockResolvedValue([]);
    mockCreateInjury.mockImplementation(async (data: InjuryMarkerCreate) => ({
      id: 99,
      date: "2026-07-29",
      body_part: data.body_part,
      severity: data.severity ?? 3,
      notes: data.notes ?? "",
      resolved_date: data.resolved_date ?? null,
      created_at: "2026-07-29T00:00:00Z",
    }));
    mockUpdateInjury.mockImplementation(async (id: number, data: InjuryMarkerUpdate) => ({
      id,
      date: "2026-06-15",
      body_part: "right ankle",
      severity: 2,
      notes: "",
      resolved_date: data.resolved_date ?? null,
      created_at: "2026-06-15T00:00:00Z",
    }));
    mockDeleteInjury.mockResolvedValue(undefined);
  });

  it("renders loading state initially", () => {
    mockGetInjuries.mockReturnValue(new Promise(() => {})); // never resolves
    render(<InjurySection />);
    // Should show skeleton shimmer
    const skeletonElements = document.querySelectorAll(".skeleton-shimmer");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it("renders empty state when no injuries", async () => {
    mockGetInjuries.mockResolvedValue([]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText(/No injuries logged/)).toBeInTheDocument();
    });
  });

  it("renders active injuries", async () => {
    mockGetInjuries.mockResolvedValue([activeInjury]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText("left knee")).toBeInTheDocument();
    });
    expect(screen.getByText(/1 active/)).toBeInTheDocument();
    expect(screen.getByText("heal")).toBeInTheDocument();
  });

  it("shows injury form when Log button is clicked", async () => {
    mockGetInjuries.mockResolvedValue([activeInjury]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText("left knee")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Log injury"));

    expect(screen.getByLabelText("Injury body part")).toBeInTheDocument();
    expect(screen.getByLabelText("Injury severity")).toBeInTheDocument();
    expect(screen.getByLabelText("Injury notes")).toBeInTheDocument();
  });

  it("submits a new injury", async () => {
    mockGetInjuries.mockResolvedValue([]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText(/No injuries logged/)).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByLabelText("Log injury"));

    // Fill and submit
    fireEvent.change(screen.getByLabelText("Injury body part"), {
      target: { value: "lower back" },
    });
    fireEvent.change(screen.getByLabelText("Injury notes"), {
      target: { value: "Twisted during deadlift" },
    });

    fireEvent.click(screen.getByText("Log Injury"));

    await waitFor(() => {
      expect(mockCreateInjury).toHaveBeenCalledWith({
        body_part: "lower back",
        severity: 3,
        notes: "Twisted during deadlift",
      });
    });
  });

  it("does not submit when body part is empty", async () => {
    mockGetInjuries.mockResolvedValue([]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log injury")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Log injury"));

    const submitBtn = screen.getByText("Log Injury");
    expect(submitBtn).toBeDisabled();

    // Clicking disabled button shouldn't call api
    fireEvent.click(submitBtn);
    expect(mockCreateInjury).not.toHaveBeenCalled();
  });

  it("cancels the form", async () => {
    mockGetInjuries.mockResolvedValue([]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log injury")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Log injury"));
    expect(screen.getByLabelText("Injury body part")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByLabelText("Injury body part")).not.toBeInTheDocument();
  });

  it("resolves an active injury", async () => {
    mockGetInjuries.mockResolvedValue([activeInjury]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText("left knee")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("heal"));

    await waitFor(() => {
      expect(mockUpdateInjury).toHaveBeenCalledWith(1, {
        resolved_date: expect.any(String),
      });
    });
  });

  it("shows resolved injuries expand/collapse", async () => {
    mockGetInjuries.mockResolvedValue([activeInjury, resolvedInjury]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText("left knee")).toBeInTheDocument();
    });

    // Should show "1 healed injury" toggle
    expect(screen.getByText(/1 healed injury/)).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText(/1 healed injury/));

    await waitFor(() => {
      expect(screen.getByText("right ankle")).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(screen.getByText(/1 healed injury/));
    await waitFor(() => {
      expect(screen.queryByText("right ankle")).not.toBeInTheDocument();
    });
  });

  it("deletes a resolved injury", async () => {
    mockGetInjuries.mockResolvedValue([resolvedInjury]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText(/1 healed injury/)).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByText(/1 healed injury/));

    await waitFor(() => {
      expect(screen.getByText("right ankle")).toBeInTheDocument();
    });

    // Click delete (X button)
    fireEvent.click(screen.getByLabelText("Delete injury"));

    await waitFor(() => {
      expect(mockDeleteInjury).toHaveBeenCalledWith(2);
    });
  });

  it("renders severity badge on active injuries", async () => {
    const severe: InjuryMarkerResponse = {
      ...activeInjury,
      severity: 5,
      body_part: "neck",
    };
    mockGetInjuries.mockResolvedValue([severe]);
    render(<InjurySection />);

    await waitFor(() => {
      expect(screen.getByText("neck")).toBeInTheDocument();
    });
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });
});