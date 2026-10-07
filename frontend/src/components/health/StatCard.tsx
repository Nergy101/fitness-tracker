export function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-2xl p-3.5 border border-fg/[0.06] shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-1.5 mb-1.5 text-fg/45">
        {icon}
        <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-extrabold text-fg tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-fg/35 mt-0.5">{sub}</p>}
    </div>
  );
}
