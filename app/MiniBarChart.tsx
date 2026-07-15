type BarChartProps = {
  title: string;
  values: number[];
  labels: string[];
  max?: number;
  unit?: string;
};

export default function MiniBarChart({
  title,
  values,
  labels,
  max,
  unit = "",
}: BarChartProps) {
  const peak = Math.max(max ?? 0, ...values, 1);

  return (
    <div className="mini-chart">
      <p className="goal-kicker">{title}</p>
      <div className="bar-chart" role="img" aria-label={title}>
        {values.map((v, i) => (
          <div className="bar-col" key={`${labels[i]}-${i}`}>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ height: `${Math.round((v / peak) * 100)}%` }}
                title={`${labels[i]}: ${v}${unit}`}
              />
            </div>
            <span className="bar-val">
              {v}
              {unit}
            </span>
            <span className="bar-label">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
