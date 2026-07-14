import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../components/health/StatCard";

describe("StatCard", () => {
  it("renders the label text", () => {
    render(<StatCard icon={<span />} label="Sessions" value="12" />);
    expect(screen.getByText("Sessions")).toBeInTheDocument();
  });

  it("renders the value text", () => {
    render(<StatCard icon={<span />} label="Sessions" value="42" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the sub text when provided", () => {
    render(<StatCard icon={<span />} label="Total kcal" value="500" sub="8.3 kcal/min" />);
    expect(screen.getByText("8.3 kcal/min")).toBeInTheDocument();
  });

  it("omits the sub text when not provided", () => {
    render(<StatCard icon={<span />} label="Total kcal" value="500" />);
    expect(screen.queryByText(/kcal\/min/)).not.toBeInTheDocument();
  });

  it("renders the passed icon node", () => {
    render(<StatCard icon={<span data-testid="test-icon" />} label="Label" value="Val" />);
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });
});
