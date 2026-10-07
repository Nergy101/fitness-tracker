/** Shared card chrome for chart blocks: icon + title on the left, an optional
 *  small stat line on the right, chart below. */
export default function ChartCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-fg/[0.06] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-xs font-semibold tracking-wide text-fg/45">{title}</p>
        </div>
        {sub && <p className="text-[10px] text-fg/35">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
