interface ChartPointProps {
  x: number;
  y: number;
  value: string;
  label: string;
  color: string;
  selected: boolean;
  onSelect: () => void;
  chartWidth?: number;
  radius?: number;
}

export default function ChartPoint({
  x,
  y,
  value,
  label,
  color,
  selected,
  onSelect,
  chartWidth = 300,
  radius = 3,
}: ChartPointProps) {
  const tooltipText = label ? `${label}: ${value}` : value;
  const textLength = Array.from(tooltipText).length;
  const tooltipWidth = Math.max(42, textLength * 5 + 12);
  const tooltipX = Math.max(0, Math.min(x - tooltipWidth / 2, chartWidth - tooltipWidth));
  const tooltipY = y < 22 ? y + 9 : y - 21;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${value}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      style={{ cursor: "pointer", touchAction: "manipulation" }}
    >
      <title>{`${label}: ${value}`}</title>
      <circle cx={x} cy={y} r={selected ? radius + 1 : radius} fill={color} pointerEvents="none" />
      <circle cx={x} cy={y} r={Math.max(radius, 10)} fill="transparent" pointerEvents="all" />
      {selected && (
        <g pointerEvents="none">
          <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={16} rx={4} fill="var(--surface)" stroke="var(--border)" />
          <text x={tooltipX + tooltipWidth / 2} y={tooltipY + 11} textAnchor="middle" className="fill-fg" fontSize="9" fontWeight="bold">
            {tooltipText}
          </text>
        </g>
      )}
    </g>
  );
}
