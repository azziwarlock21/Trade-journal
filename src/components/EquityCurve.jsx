// ─── EquityCurve ──────────────────────────────────────────────────────────
// SVG line chart of cumulative points over trade sequence, with win/loss
// dots. Used in the Analytics tab. No external chart library — hand-rolled
// SVG keeps the bundle small and gives full styling control.

export default function EquityCurve({ data }) {
  if (!data || data.length < 2) {
    return <div style={{ color: "#4b5563", fontSize: 12, padding: 20 }}>Not enough trades to render curve.</div>;
  }

  const pts = data.map(d => d.pts);
  const min = Math.min(...pts, 0), max = Math.max(...pts, 0);
  const range = max - min || 1;
  const W = 600, H = 120, PAD = 12;

  const x = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const zeroY = y(0);

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.pts).toFixed(1)}`).join(" ");
  const fillD = `${pathD} L${x(data.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const lineColor = data[data.length - 1].pts >= 0 ? "#00e5a0" : "#ff4d6d";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#2a2f3a" strokeWidth="1" strokeDasharray="4,4" />
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#eqGrad)" />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(d.pts)}
          r={3}
          fill={d.outcome === "Win" ? "#00e5a0" : d.outcome === "Loss" ? "#ff4d6d" : "#aaa"}
        />
      ))}
    </svg>
  );
}
