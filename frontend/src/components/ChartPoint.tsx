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

const TOOLTIP_H = 19;

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
  const tooltipWidth = Math.max(50, textLength * 5.3 + 16);
  const tooltipX = Math.max(0, Math.min(x - tooltipWidth / 2, chartWidth - tooltipWidth));
  const above = y >= 24;
  const tooltipY = above ? y - TOOLTIP_H - 8 : y + 10;
  const dotR = selected ? radius + 1.5 : radius;

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
      {selected && <circle cx={x} cy={y} r={dotR + 5} fill={color} opacity="0.16" pointerEvents="none" />}
      <circle
        cx={x}
        cy={y}
        r={dotR}
        fill={color}
        stroke="var(--surface)"
        strokeWidth={selected ? 1.5 : 0}
        pointerEvents="none"
      />
      <circle cx={x} cy={y} r={Math.max(radius, 11)} fill="transparent" pointerEvents="all" />
      {selected && (
        <g pointerEvents="none" style={{ filter: "drop-shadow(0 3px 8px color-mix(in srgb, var(--fg) 28%, transparent))" }}>
          <rect
            x={tooltipX}
            y={tooltipY}
            width={tooltipWidth}
            height={TOOLTIP_H}
            rx={5}
            fill="var(--surface)"
            stroke="var(--border)"
          />
          <text
            x={tooltipX + tooltipWidth / 2}
            y={tooltipY + TOOLTIP_H / 2 + 3}
            textAnchor="middle"
            className="fill-fg"
            fontSize="9.5"
            fontWeight="700"
          >
            {tooltipText}
          </text>
        </g>
      )}
    </g>
  );
}
