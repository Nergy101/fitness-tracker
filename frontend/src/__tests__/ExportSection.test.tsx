import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExportSection from "../components/ExportSection";

const mockDownloadExport = vi.fn().mockResolvedValue(undefined);

vi.mock("../api", () => ({
  api: { downloadExport: (...args: unknown[]) => mockDownloadExport(...args) },
  OfflineError: class OfflineError extends Error {},
}));

describe("ExportSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadExport.mockResolvedValue(undefined);
  });

  it("renders all export entity buttons", () => {
    render(<ExportSection />);
    expect(screen.getByText("Workout sessions")).toBeInTheDocument();
    expect(screen.getByText("Weight entries")).toBeInTheDocument();
    expect(screen.getByText("Runs & walks")).toBeInTheDocument();
    expect(screen.getByText("Boxing")).toBeInTheDocument();
    expect(screen.getByText("Cycling")).toBeInTheDocument();
    expect(screen.getByText("Body measurements")).toBeInTheDocument();
    expect(screen.getByText("Wellness check-ins")).toBeInTheDocument();
    expect(screen.getByText("Injuries")).toBeInTheDocument();
  });

  it("downloads a CSV on click and shows a success message", async () => {
    render(<ExportSection />);
    fireEvent.click(screen.getByLabelText("Export Weight entries"));
    await screen.findByText("Weight entries exported as CSV.");
    expect(mockDownloadExport).toHaveBeenCalledWith("weights");
  });

  it("shows an error message when export fails", async () => {
    mockDownloadExport.mockRejectedValue(new Error("Export failed (500)"));
    render(<ExportSection />);
    fireEvent.click(screen.getByLabelText("Export Runs & walks"));
    await screen.findByText("Export failed (500)");
    expect(mockDownloadExport).toHaveBeenCalledWith("runs");
  });
});
