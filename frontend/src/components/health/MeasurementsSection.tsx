import { useEffect, useState } from "react";
import {
  api,
  type BodyMeasurementCreate,
  type BodyMeasurementResponse,
  type MeasurementChangesResponse,
} from "../../api";
import { shortDate } from "./utils";

/** The measurement fields we track, in display order. */
type MeasKey =
  | "waist_cm"
  | "hips_cm"
  | "chest_cm"
  | "left_arm_cm"
  | "right_arm_cm"
  | "left_thigh_cm"
  | "right_thigh_cm"
  | "neck_cm";

const MEAS_FIELDS: { key: MeasKey; label: string }[] = [
  { key: "waist_cm", label: "Waist" },
  { key: "hips_cm", label: "Hips" },
  { key: "chest_cm", label: "Chest" },
  { key: "left_arm_cm", label: "Left Arm" },
  { key: "right_arm_cm", label: "Right Arm" },
  { key: "left_thigh_cm", label: "Left Thigh" },
  { key: "right_thigh_cm", label: "Right Thigh" },
  { key: "neck_cm", label: "Neck" },
];

type MeasRange = "30d" | "90d" | "all";

export default function MeasurementsSection() {
  const [measurements, setMeasurements] = useState<BodyMeasurementResponse[]>([]);
  const [changes, setChanges] = useState<MeasurementChangesResponse | null>(null);
  const [form, setForm] = useState<Partial<Record<MeasKey, string>>>({});
  const [showForm, setShowForm] = useState(false);
  const [selectedMeas, setSelectedMeas] = useState<Set<MeasKey>>(new Set(["waist_cm"]));
  const [measRange, setMeasRange] = useState<MeasRange>("90d");

  useEffect(() => {
    api.getMeasurements().then(setMeasurements).catch(() => {});
    api.getMeasurementChanges().then(setChanges).catch(() => {});
  }, []);

  const submit = async () => {
    const data: BodyMeasurementCreate = {};
    MEAS_FIELDS.forEach((f) => {
      const raw = form[f.key];
      data[f.key] = raw ? parseFloat(raw) : null;
    });
    await api.createMeasurement(data);
    setShowForm(false);
    setForm({});
    api.getMeasurements().then(setMeasurements);
    api.getMeasurementChanges().then(setChanges);
  };

  const latest = measurements[0];

  return (
    <div className="bg-surface rounded-xl p-4 border border-fg/5 space-y-3">
      {latest && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {MEAS_FIELDS.map((f) => {
            const val = latest[f.key];
            const delta = changes?.deltas[f.key];
            return (
              <div key={f.key} className="flex justify-between items-center py-0.5">
                <span className="text-fg/50">{f.label}</span>
                <span className="text-fg font-medium">
                  {val != null ? `${val} cm` : "—"}
                  {delta != null && (
                    <span className={delta >= 0 ? "text-orange-400 ml-1" : "text-green-400 ml-1"}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Measurement Trend Chart */}
      {measurements.length >= 2 && (
        <MeasurementTrendChart
          measurements={measurements}
          selected={selectedMeas}
          range={measRange}
        />
      )}

      {/* Measurement toggle buttons */}
      {measurements.length >= 2 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-fg/40">Show on chart</span>
            <div className="flex gap-1">
              {(["30d", "90d", "all"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setMeasRange(r)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    measRange === r
                      ? "bg-accent/20 text-accent"
                      : "text-fg/30 hover:text-fg/60"
                  }`}
                >
                  {r === "all" ? "All" : r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MEAS_FIELDS.map((f) => {
              const active = selectedMeas.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    const next = new Set(selectedMeas);
                    if (active && next.size > 1) next.delete(f.key);
                    else if (!active) next.add(f.key);
                    setSelectedMeas(next);
                  }}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-accent/15 border-accent/30 text-accent"
                      : "border-fg/10 text-fg/40 hover:text-fg/70"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-bg rounded-lg py-2 text-sm text-accent font-medium hover:bg-bg/80 transition-colors">
          + Add Measurements
        </button>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {MEAS_FIELDS.map((f) => (
              <input key={f.key} type="number" step="0.1" placeholder={`${f.label} (cm)`} value={form[f.key] ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="bg-bg border border-fg/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-accent/50" />
            ))}
          </div>
          <button onClick={submit}
            className="w-full bg-accent text-bg rounded-lg py-2 text-sm font-semibold">
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Measurement Trend Chart ──────────────────────────────

const MEAS_COLORS = [
  "#4cb782", "#facc15", "#f97316", "#a78bfa",
  "#f472b6", "#38bdf8", "#fb923c", "#34d399",
];

function MeasurementTrendChart({
  measurements,
  selected,
  range,
}: {
  measurements: BodyMeasurementResponse[];
  selected: Set<MeasKey>;
  range: MeasRange;
}) {
  // Wall-clock cutoff for the range filter: stable within a render pass, and
  // staleness across re-renders is immaterial for a day-granularity window.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const cutoff = range === "all" ? 0 : range === "90d" ? 90 : 30;
  const filtered = cutoff > 0
    ? sorted.filter((m) => new Date(m.date).getTime() >= now - cutoff * 86400000)
    : sorted;
  if (filtered.length < 2) return null;

  const selectedFields = [...selected];
  const w = 300;
  const h = 100;

  // Collect all non-null values for the selected fields
  const allValues: number[] = [];
  const series: { key: MeasKey; points: { x: number; y: number }[]; color: string }[] = [];
  selectedFields.forEach((field, fi) => {
    const pts: { x: number; y: number }[] = [];
    filtered.forEach((m, i) => {
      const val = m[field];
      if (val != null) {
        const x = (i / (filtered.length - 1)) * w;
        pts.push({ x, y: val });
        allValues.push(val);
      }
    });
    if (pts.length >= 2) {
      series.push({ key: field, points: pts, color: MEAS_COLORS[fi % MEAS_COLORS.length] });
    }
  });

  if (series.length === 0) return null;

  const min = Math.min(...allValues) - 1;
  const max = Math.max(...allValues) + 1;
  const range_val = max - min || 1;

  const labels = [filtered[0], filtered[Math.floor(filtered.length / 2)], filtered[filtered.length - 1]];

  return (
    <div>
      <p className="text-[10px] text-fg/40 mb-2">Trends</p>
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-28">
        {series.map((s) => (
          <polyline
            key={s.key}
            points={s.points.map((p) => `${p.x},${h - ((p.y - min) / range_val) * h}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {series.map((s) =>
          s.points.map((p, i) => (
            <circle
              key={`${s.key}-${i}`}
              cx={p.x}
              cy={h - ((p.y - min) / range_val) * h}
              r="2"
              fill={s.color}
            />
          )),
        )}
        {labels.map((e, i) => {
          const idx = filtered.indexOf(e);
          if (idx < 0) return null;
          const x = (idx / (filtered.length - 1)) * w;
          return (
            <text key={i} x={x} y={h + 14} textAnchor="middle" className="fill-fg/40" fontSize="9">
              {shortDate(e.date)}
            </text>
          );
        })}
        <text x="0" y="10" className="fill-fg/30" fontSize="9">{max.toFixed(1)}</text>
        <text x="0" y={h - 4} className="fill-fg/30" fontSize="9">{min.toFixed(1)}</text>
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1">
        {series.map((s) => {
          const label = MEAS_FIELDS.find((f) => f.key === s.key)?.label ?? s.key;
          return (
            <span key={s.key} className="flex items-center gap-1 text-[10px] text-fg/50">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
