export function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint?: "workout" | "run" | "walk" | "boxing" | "cycling" | "blue";
}) {
  return (
    <div
      className={`min-h-[84px] rounded-[22px] p-3.5 border border-fg/[0.06] shadow-[var(--shadow-sm)] flex flex-col justify-between ${tint ? "" : "bg-surface text-fg"}`}
      style={tint ? { backgroundColor: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` } : undefined}
    >
      <div className={`flex items-center gap-1.5 mb-1.5 ${tint ? "text-current/75" : "text-fg/55"}`}>
        {icon}
        <span className="text-[11px] font-semibold tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-extrabold tracking-tight tabular-nums ${tint ? "text-current" : "text-fg"}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${tint ? "text-current/70" : "text-fg/35"}`}>{sub}</p>}
    </div>
  );
}
