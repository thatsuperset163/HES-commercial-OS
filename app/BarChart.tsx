"use client";

type BarPoint = {
  label: string;
  value: number;
};

export function BarChart({
  title,
  points,
  max,
  suffix = "",
}: {
  title: string;
  points: BarPoint[];
  max?: number;
  suffix?: string;
}) {
  const peak = Math.max(max ?? 0, ...points.map((p) => p.value), 1);

  return (
    <div className="chart-block">
      <p className="goal-kicker">{title}</p>
      <div className="bar-chart" role="img" aria-label={title}>
        {points.map((p) => (
          <div key={p.label} className="bar-col">
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ height: `${Math.round((p.value / peak) * 100)}%` }}
                title={`${p.value}${suffix}`}
              />
            </div>
            <span className="bar-value">
              {p.value}
              {suffix}
            </span>
            <span className="bar-label">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
