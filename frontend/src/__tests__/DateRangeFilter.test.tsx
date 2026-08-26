import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateRangeFilter from "../components/history/DateRangeFilter";

describe("DateRangeFilter", () => {
  it("renders the three range pills and the calendar toggle", () => {
    render(
      <DateRangeFilter
        range="7d"
        calendar={false}
        onRangeChange={vi.fn()}
        onToggleCalendar={vi.fn()}
      />,
    );
    expect(screen.getByText("7 Days")).toBeInTheDocument();
    expect(screen.getByText("30 Days")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
  });

  it("calls onRangeChange with the matching key", () => {
    const onRangeChange = vi.fn();
    render(
      <DateRangeFilter
        range="7d"
        calendar={false}
        onRangeChange={onRangeChange}
        onToggleCalendar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("30 Days"));
    expect(onRangeChange).toHaveBeenCalledWith("30d");
    fireEvent.click(screen.getByText("This week"));
    expect(onRangeChange).toHaveBeenCalledWith("week");
  });

  it("calls onToggleCalendar when the calendar pill is clicked", () => {
    const onToggleCalendar = vi.fn();
    render(
      <DateRangeFilter
        range="7d"
        calendar={false}
        onRangeChange={vi.fn()}
        onToggleCalendar={onToggleCalendar}
      />,
    );
    fireEvent.click(screen.getByText("Calendar"));
    expect(onToggleCalendar).toHaveBeenCalled();
  });

  it("applies accent styling to the selected range when not in calendar mode", () => {
    render(
      <DateRangeFilter
        range="7d"
        calendar={false}
        onRangeChange={vi.fn()}
        onToggleCalendar={vi.fn()}
      />,
    );
    expect(screen.getByText("7 Days").className).toContain("bg-accent");
    expect(screen.getByText("30 Days").className).not.toContain("bg-accent");
  });

  it("applies accent styling to the calendar pill when active", () => {
    render(
      <DateRangeFilter
        range="7d"
        calendar
        onRangeChange={vi.fn()}
        onToggleCalendar={vi.fn()}
      />,
    );
    expect(screen.getByText("Calendar").className).toContain("bg-accent");
  });
});
