// ─── HeatmapCell ──────────────────────────────────────────────────────────
// Single cell in the time-of-day x direction win-rate heatmap.

export default function HeatmapCell({ wins, total }) {
  if (total === 0) {
    return (
      <div style={{ background: "#0d1117", borderRadius: 4, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 9, color: "#2a2f3a" }}>-</span>
      </div>
    );
  }
  const wr = wins / total;
  const alpha = Math.min(0.15 + wr * 0.75, 0.9);
  const bg = wr >= 0.55 ? `rgba(0,229,160,${alpha})` : wr >= 0.4 ? `rgba(245,200,66,${alpha})` : `rgba(255,77,109,${alpha})`;
  return (
    <div style={{ background: bg, borderRadius: 4, height: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#e6edf3" }}>{(wr * 100).toFixed(0)}%</span>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{total}t</span>
    </div>
  );
}
