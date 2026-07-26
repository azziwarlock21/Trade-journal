// ─── BarRow ───────────────────────────────────────────────────────────────
// Horizontal win-rate bar used in Analytics category breakdowns
// (grade, session, candle pattern, trade type, HTF bias, market structure).

export default function BarRow({ label, wins, total, color }) {
  const wr = total ? (wins / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#e6edf3" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#8b949e" }}>{wins}/{total} · {wr.toFixed(0)}% WR</span>
      </div>
      <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${wr}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}
