// ─── LineChart ────────────────────────────────────────────────────────────
// Generic hand-rolled SVG line chart. Built for the Win Rate Trend
// (rolling win % over trade sequence) but generic enough for any
// single-series line with a horizontal reference line (e.g. 50% win rate,
// breakeven, a target threshold).
//
// data: [{ value }] — plotted in sequence order.
// referenceLine: optional Y value to draw a dashed reference line at.

export default function LineChart({ data, height = 140, referenceLine, color = "#3b82f6", yMin = 0, yMax = 100 }) {
  if (!data || data.length < 2) {
    return <div style={{ color: "#4b5563", fontSize: 12, padding: 20 }}>Not enough data to render trend.</div>;
  }

  const W = 600, H = height, PAD = 12;
  const range = yMax - yMin || 1;

  const x = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - yMin) / range) * (H - PAD * 2);

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const refY = referenceLine !== undefined ? y(referenceLine) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      {refY !== null && (
        <>
          <line x1={PAD} y1={refY} x2={W - PAD} y2={refY} stroke="#f5c842" strokeWidth="1" strokeDasharray="4,4" opacity={0.5} />
          <text x={W - PAD} y={refY - 4} fill="#f5c842" fontSize="9" textAnchor="end" opacity={0.7}>{referenceLine}%</text>
        </>
      )}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
