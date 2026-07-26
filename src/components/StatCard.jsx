// ─── StatCard ─────────────────────────────────────────────────────────────
// Generic KPI display card used throughout Analytics, Payouts, Tax, and
// Expenses tabs. Kept intentionally simple and style-driven.

export default function StatCard({ label, value, color = "#e6edf3", sub, small }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: small ? 14 : 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
