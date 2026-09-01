import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../components/ErrorBoundary";

/** Throws when a prop enables it, so we can trigger the boundary. */
function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error("boom");
  return <div>safe content</div>;
}

// Silence React's expected console.error when a boundary catches.
const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("ErrorBoundary", () => {
  beforeEach(() => {
    errSpy.mockClear();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders the fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("An unexpected error occurred. Try reloading the app.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("shows the thrown error message", () => {
    render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("recovers to children after Reload resets the error", () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the child, then click Reload — boundary resets and shows children.
    rerender(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getByText("safe content")).toBeInTheDocument();
  });
});
