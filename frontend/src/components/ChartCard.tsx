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
    <div className="bg-surface rounded-xl p-4 border border-fg/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-xs text-fg/40">{title}</p>
        </div>
        {sub && <p className="text-[10px] text-fg/30">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
