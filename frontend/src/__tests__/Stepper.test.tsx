import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Stepper from "../components/Stepper";

// Mock phosphor icons
vi.mock("@phosphor-icons/react", () => ({
  MinusIcon: ({ size }: { size: number }) => <span data-icon="minus" data-size={size} />,
  PlusIcon: ({ size }: { size: number }) => <span data-icon="plus" data-size={size} />,
}));

describe("Stepper", () => {
  it("renders with default value", () => {
    render(<Stepper value={5} onChange={vi.fn()} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders with unit suffix", () => {
    render(<Stepper value={10} onChange={vi.fn()} unit="s" />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("s")).toBeInTheDocument();
  });

  it("renders with aria label", () => {
    render(<Stepper value={3} onChange={vi.fn()} ariaLabel="Reps" />);
    expect(screen.getByRole("group", { name: "Reps" })).toBeInTheDocument();
  });

  it("calls onChange with incremented value on + click", () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Increase"));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("calls onChange with decremented value on - click", () => {
    const onChange = vi.fn();
    render(<Stepper value={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Decrease"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("respects custom step", () => {
    const onChange = vi.fn();
    render(<Stepper value={10} onChange={onChange} step={5} />);
    fireEvent.click(screen.getByLabelText("Increase"));
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it("clamps at min — Decrease is disabled", () => {
    const onChange = vi.fn();
    render(<Stepper value={0} onChange={onChange} min={0} />);
    const decBtn = screen.getByLabelText("Decrease");
    expect(decBtn).toBeDisabled();
    fireEvent.click(decBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps at max — Increase is disabled", () => {
    const onChange = vi.fn();
    render(<Stepper value={10} onChange={onChange} max={10} />);
    const incBtn = screen.getByLabelText("Increase");
    expect(incBtn).toBeDisabled();
    fireEvent.click(incBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps value when step would exceed max", () => {
    const onChange = vi.fn();
    render(<Stepper value={9} onChange={onChange} max={10} step={3} />);
    fireEvent.click(screen.getByLabelText("Increase"));
    expect(onChange).toHaveBeenCalledWith(10);
  });
});