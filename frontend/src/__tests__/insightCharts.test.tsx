import { describe, it, expect } from "vitest";
import {
  BarChart,
  DailyStackedBarChart,
  ScatterChart,
  BandChart,
  DualAxisChart,
  ACCENT,
  type BPt,
  type SPt,
  type BandPt,
  type DualPt,
  type StkPt,
} from "../components/health/insightCharts";
import { render } from "@testing-library/react";

describe("insightCharts", () => {
  describe("BarChart", () => {
    it("returns null with fewer than 2 points", () => {
      const { container } = render(<BarChart points={[{ x: 0, y: 10 }]} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders bars for multiple points", () => {
      const points: BPt[] = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 15 },
      ];
      const { container } = render(<BarChart points={points} />);
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBe(3);
    });

    it("renders goal line when goalValue is set", () => {
      const points: BPt[] = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
      ];
      const { container } = render(
        <BarChart points={points} goalValue={25} goalLabel="Target" />,
      );
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    it("renders overlay polyline", () => {
      const points: BPt[] = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 15 },
      ];
      const overlay = [
        { x: 0, y: 12 },
        { x: 1, y: 18 },
        { x: 2, y: 16 },
      ];
      const { container } = render(
        <BarChart points={points} overlay={overlay} />,
      );
      const polylines = container.querySelectorAll("polyline");
      expect(polylines.length).toBe(1);
    });

    it("renders xLabels", () => {
      const points: BPt[] = [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 15 },
      ];
      const { container } = render(
        <BarChart
          points={points}
          xLabels={["A", "B", "C"]}
        />,
      );
      const texts = container.querySelectorAll("text");
      // xLabels add 3 text nodes
      const labels = Array.from(texts).filter(
        (t) => t.textContent === "A" || t.textContent === "B" || t.textContent === "C",
      );
      expect(labels.length).toBe(3);
    });

    it("uses per-point colors", () => {
      const points: BPt[] = [
        { x: 0, y: 10, color: "#ff0000" },
        { x: 1, y: 20, color: "#00ff00" },
      ];
      const { container } = render(<BarChart points={points} />);
      const rects = container.querySelectorAll("rect");
      expect(rects[0].getAttribute("fill")).toBe("#ff0000");
      expect(rects[1].getAttribute("fill")).toBe("#00ff00");
    });
  });

  describe("DailyStackedBarChart", () => {
    it("returns null with fewer than 2 points", () => {
      const points: StkPt[] = [
        { x: 0, segments: [{ value: 5, color: "#aaa" }] },
      ];
      const { container } = render(
        <DailyStackedBarChart points={points} />,
      );
      expect(container.innerHTML).toBe("");
    });

    it("renders stacked bars", () => {
      const points: StkPt[] = [
        { x: 0, segments: [{ value: 5, color: "#aaa" }] },
        { x: 1, segments: [{ value: 3, color: "#bbb" }] },
      ];
      const { container } = render(
        <DailyStackedBarChart points={points} />,
      );
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBe(2);
    });

    it("renders multiple segments per bar", () => {
      const points: StkPt[] = [
        {
          x: 0,
          segments: [
            { value: 2, color: "#111" },
            { value: 3, color: "#222" },
          ],
        },
        {
          x: 1,
          segments: [
            { value: 4, color: "#333" },
            { value: 1, color: "#444" },
          ],
        },
      ];
      const { container } = render(
        <DailyStackedBarChart points={points} />,
      );
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBe(4);
    });

    it("renders goal line", () => {
      const points: StkPt[] = [
        { x: 0, segments: [{ value: 5, color: "#aaa" }] },
        { x: 1, segments: [{ value: 3, color: "#bbb" }] },
      ];
      const { container } = render(
        <DailyStackedBarChart points={points} goalValue={8} goalLabel="8h" />,
      );
      const lines = container.querySelectorAll("line");
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    it("renders xLabels", () => {
      const points: StkPt[] = [
        { x: 0, segments: [{ value: 5, color: "#aaa" }] },
        { x: 1, segments: [{ value: 3, color: "#bbb" }] },
        { x: 2, segments: [{ value: 7, color: "#ccc" }] },
      ];
      const { container } = render(
        <DailyStackedBarChart
          points={points}
          xLabels={["Mon", "Tue", "Wed"]}
        />,
      );
      expect(container.textContent).toContain("Mon");
      expect(container.textContent).toContain("Tue");
      expect(container.textContent).toContain("Wed");
    });
  });

  describe("ScatterChart", () => {
    it("returns null with fewer than 3 points", () => {
      const points: SPt[] = [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      const { container } = render(<ScatterChart points={points} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders scatter points", () => {
      const points: SPt[] = [
        { x: 10, y: 50 },
        { x: 20, y: 70 },
        { x: 30, y: 60 },
      ];
      const { container } = render(<ScatterChart points={points} />);
      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBe(3);
    });

    it("renders x label", () => {
      const points: SPt[] = [
        { x: 10, y: 50 },
        { x: 20, y: 70 },
        { x: 30, y: 60 },
      ];
      const { container } = render(
        <ScatterChart points={points} xLabel="Duration (min)" />,
      );
      expect(container.textContent).toContain("Duration (min)");
    });

    it("uses xStep for ticks", () => {
      const points: SPt[] = [
        { x: 0, y: 10 },
        { x: 30, y: 20 },
        { x: 60, y: 30 },
      ];
      const { container } = render(
        <ScatterChart points={points} xStep={30} />,
      );
      // Should render with tick labels (0, 30, 60)
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("uses per-point colors", () => {
      const points: SPt[] = [
        { x: 10, y: 50, color: "#ff0000" },
        { x: 20, y: 70, color: "#00ff00" },
        { x: 30, y: 60, color: "#0000ff" },
      ];
      const { container } = render(<ScatterChart points={points} />);
      const circles = container.querySelectorAll("circle");
      expect(circles[0].getAttribute("fill")).toBe("#ff0000");
      expect(circles[1].getAttribute("fill")).toBe("#00ff00");
      expect(circles[2].getAttribute("fill")).toBe("#0000ff");
    });
  });

  describe("BandChart", () => {
    it("returns null with fewer than 2 points", () => {
      const points: BandPt[] = [
        { x: 0, avg: 10, min: 5, max: 15 },
      ];
      const { container } = render(<BandChart points={points} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders band polygon and avg line", () => {
      const points: BandPt[] = [
        { x: 0, avg: 10, min: 5, max: 15 },
        { x: 1, avg: 12, min: 8, max: 18 },
      ];
      const { container } = render(<BandChart points={points} />);
      const polygons = container.querySelectorAll("polygon");
      const polylines = container.querySelectorAll("polyline");
      expect(polygons.length).toBe(1); // band fill
      expect(polylines.length).toBe(1); // avg line
    });

    it("renders xLabels", () => {
      const points: BandPt[] = [
        { x: 0, avg: 10, min: 5, max: 15 },
        { x: 1, avg: 12, min: 8, max: 18 },
        { x: 2, avg: 11, min: 6, max: 16 },
      ];
      const { container } = render(
        <BandChart points={points} xLabels={["Jan", "Feb", "Mar"]} />,
      );
      expect(container.textContent).toContain("Jan");
      expect(container.textContent).toContain("Feb");
      expect(container.textContent).toContain("Mar");
    });
  });

  describe("DualAxisChart", () => {
    it("returns null with fewer than 2 points", () => {
      const points: DualPt[] = [{ x: 0, bar: 10, line: 20 }];
      const { container } = render(<DualAxisChart points={points} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders bars and line", () => {
      const points: DualPt[] = [
        { x: 0, bar: 10, line: 20 },
        { x: 1, bar: 15, line: 25 },
      ];
      const { container } = render(<DualAxisChart points={points} />);
      const rects = container.querySelectorAll("rect");
      expect(rects.length).toBe(2);
      // Should have bar labels on right side
    });

    it("renders legend when labels provided", () => {
      const points: DualPt[] = [
        { x: 0, bar: 10, line: 20 },
        { x: 1, bar: 15, line: 25 },
      ];
      const { container } = render(
        <DualAxisChart
          points={points}
          barLabel="Energy"
          lineLabel="Weight"
        />,
      );
      expect(container.textContent).toContain("Energy");
      expect(container.textContent).toContain("Weight");
    });

    it("handles null line values (gaps)", () => {
      const points: DualPt[] = [
        { x: 0, bar: 10, line: 20 },
        { x: 1, bar: 15, line: null },
        { x: 2, bar: 12, line: 22 },
      ];
      const { container } = render(<DualAxisChart points={points} />);
      // Should render without crashing
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("handles all null line values", () => {
      const points: DualPt[] = [
        { x: 0, bar: 10, line: null },
        { x: 1, bar: 15, line: null },
      ];
      const { container } = render(<DualAxisChart points={points} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders xLabels", () => {
      const points: DualPt[] = [
        { x: 0, bar: 10, line: 20 },
        { x: 1, bar: 15, line: 25 },
        { x: 2, bar: 12, line: 22 },
      ];
      const { container } = render(
        <DualAxisChart
          points={points}
          xLabels={["Mon", "Wed", "Fri"]}
        />,
      );
      expect(container.textContent).toContain("Mon");
      expect(container.textContent).toContain("Wed");
      expect(container.textContent).toContain("Fri");
    });
  });

  describe("ACCENT", () => {
    it("is a string", () => {
      expect(typeof ACCENT).toBe("string");
    });
  });
});