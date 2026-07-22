// ─── BarChart ─────────────────────────────────────────────────────────────
// Generic hand-rolled SVG bar chart for Daily P&L and Weekly P&L series.
// Bars color by sign (green positive, red negative). No external chart
// library, consistent with EquityCurve's approach — keeps the bundle
// small and styling fully in our control.
//
// data: [{ label, value }]  — label shown on hover via <title>, value
// drives bar height and color.

export default function BarChart({ data, height = 140, valueFormatter }) {
  if (!data || data.length === 0) {
    return <div style={{ color: "#4b5563", fontSize: 12, padding: 20 }}>No data yet.</div>;
  }

  const W = 600, H = height, PAD = 12;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const barW = (W - PAD * 2) / data.length;
  const zeroY = PAD + (max / range) * (H - PAD * 2);

  const fmt = valueFormatter || ((v) => v.toFixed(0));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#2a2f3a" strokeWidth="1" strokeDasharray="4,4" />
      {data.map((d, i) => {
        const x = PAD + i * barW;
        const barHeight = (Math.abs(d.value) / range) * (H - PAD * 2);
        const y = d.value >= 0 ? zeroY - barHeight : zeroY;
        const color = d.value > 0 ? "#00e5a0" : d.value < 0 ? "#ff4d6d" : "#4b5563";
        return (
          <rect
            key={i}
            x={x + barW * 0.15}
            y={y}
            width={Math.max(barW * 0.7, 1)}
            height={Math.max(barHeight, 1)}
            fill={color}
            opacity={0.85}
            rx={1}
          >
            <title>{d.label}: {fmt(d.value)}</title>
          </rect>
        );
      })}
    </svg>
  );
}
