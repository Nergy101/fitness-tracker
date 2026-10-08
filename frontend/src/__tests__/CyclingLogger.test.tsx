import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CyclingLogger from "../components/CyclingLogger";
import { todayKey } from "../dateKey";

const { mockCreateCycling, mockUpdateCycling, MockOfflineError } = vi.hoisted(() => ({
  mockCreateCycling: vi.fn(),
  mockUpdateCycling: vi.fn().mockResolvedValue({ id: 1 }),
  MockOfflineError: class extends Error { readonly offline = true; },
}));

vi.mock("../api", () => ({
  api: {
    createCycling: (...args: unknown[]) => mockCreateCycling(...args),
    updateCycling: (...args: unknown[]) => mockUpdateCycling(...args),
    getWeightEntries: vi.fn().mockResolvedValue([]),
  },
  OfflineError: MockOfflineError,
}));

describe("CyclingLogger", () => {
  const onWorkoutLogged = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  it("opens the requested ride sheet with editable inputs and a live preview", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,durationSeconds:2700,distanceKm:24}} />);
    expect(screen.getByRole("dialog", {name:"Log a Cycling Ride"})).toBeInTheDocument();
    expect(screen.getByRole("textbox", {name:"Distance in km"})).toHaveValue("24");
    expect(screen.getByRole("textbox", {name:"Duration in minutes"})).toHaveValue("45");
    expect(screen.getByText("Avg speed")).toBeInTheDocument();
    expect(screen.getByText("Active energy")).toBeInTheDocument();
    expect(screen.getByDisplayValue(todayKey())).toBeInTheDocument();
  });

  it("selects duration quick picks and custom minutes", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,distanceKm:10}} />);
    fireEvent.click(screen.getByRole("button", {name:"45m"}));
    expect(screen.getByRole("textbox", {name:"Duration in minutes"})).toHaveValue("45");
    fireEvent.click(screen.getByRole("button", {name:"Custom"}));
    fireEvent.change(screen.getByRole("spinbutton", {name:"Custom duration in minutes"}), {target:{value:"75"}});
    expect(screen.getByRole("textbox", {name:"Duration in minutes"})).toHaveValue("75");
  });

  it("requires a positive distance before saving", () => {
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1}} />);
    const save = screen.getByRole("button", {name:"Save Cycling Ride"});
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", {name:"Distance in km"}), {target:{value:"10"}});
    expect(save).toBeEnabled();
  });

  it("closes on close button and backdrop", () => {
    const {rerender} = render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1}} />);
    fireEvent.click(screen.getByRole("button", {name:"Close"}));
    expect(screen.queryByRole("dialog", {name:"Log a Cycling Ride"})).not.toBeInTheDocument();
    rerender(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:2}} />);
    fireEvent.click(document.querySelector(".fixed.inset-0.bg-black\\/60")!);
    expect(screen.queryByRole("dialog", {name:"Log a Cycling Ride"})).not.toBeInTheDocument();
  });

  it("submits the entered activity and notifies the parent", async () => {
    mockCreateCycling.mockResolvedValue({id:2});
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,durationSeconds:1800,distanceKm:20}} />);
    fireEvent.click(screen.getByRole("button", {name:"Save Cycling Ride"}));
    await vi.waitFor(() => expect(mockCreateCycling).toHaveBeenCalledWith({duration_seconds:1800,distance_km:20,date:expect.any(String),notes:""}));
    expect(onWorkoutLogged).toHaveBeenCalled();
  });

  it("submits custom duration and distance values", async () => {
    mockCreateCycling.mockResolvedValue({id:3});
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,distanceKm:30}} />);
    fireEvent.click(screen.getByRole("button", {name:"Custom"}));
    fireEvent.change(screen.getByRole("spinbutton", {name:"Custom duration in minutes"}), {target:{value:"75"}});
    fireEvent.click(screen.getByRole("button", {name:"Save Cycling Ride"}));
    await vi.waitFor(() => expect(mockCreateCycling).toHaveBeenCalledWith(expect.objectContaining({duration_seconds:4500,distance_km:30})));
  });

  it("shows save errors and queued-offline feedback", async () => {
    mockCreateCycling.mockRejectedValueOnce(new Error("Server error"));
    const {rerender} = render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:1,durationSeconds:1800,distanceKm:20}} />);
    fireEvent.click(screen.getByRole("button", {name:"Save Cycling Ride"}));
    expect(await screen.findByText("Failed to save cycling ride")).toBeInTheDocument();
    mockCreateCycling.mockRejectedValueOnce(new MockOfflineError());
    rerender(<CyclingLogger onWorkoutLogged={onWorkoutLogged} openRequest={{key:2,durationSeconds:1800,distanceKm:20}} />);
    fireEvent.click(screen.getByRole("button", {name:"Save Cycling Ride"}));
    expect(await screen.findByText("Cycling ride queued for sync")).toBeInTheDocument();
  });

  it("edits an existing ride through the original entry id", async () => {
    const entry = {id:5,duration_seconds:2700,distance_km:24,date:"2026-08-01",notes:"fast",created_at:"2026-08-01T10:00:00"};
    mockUpdateCycling.mockResolvedValue({id:5});
    render(<CyclingLogger onWorkoutLogged={onWorkoutLogged} editEntry={entry} />);
    fireEvent.change(screen.getByRole("textbox", {name:"Distance in km"}), {target:{value:"30"}});
    fireEvent.click(screen.getByRole("button", {name:"Update Cycling Ride"}));
    await vi.waitFor(() => expect(mockUpdateCycling).toHaveBeenCalledWith(5,{duration_seconds:2700,distance_km:30,date:"2026-08-01",notes:"fast"}));
  });
});
