// ─── Shared Form Styles ───────────────────────────────────────────────────
// Reused across TradeForm, BulkEditModal, PositionCalculator, and other
// tabs with input fields. Kept as plain style objects (no CSS-in-JS lib)
// to match the existing inline-style approach throughout the app.

export const inputStyle = {
  width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8,
  padding: "8px 12px", color: "#e6edf3", fontSize: 13, boxSizing: "border-box",
  fontFamily: "inherit",
};

export const autoInputStyle = {
  ...inputStyle, background: "#111827", border: "1px solid #00e5a044",
  color: "#f5c842", fontWeight: 700,
};

export const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600, color: "#8b949e",
  textTransform: "uppercase", letterSpacing: 2, marginBottom: 4,
};

export const AutoBadge = () => (
  <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(0,229,160,0.12)", padding: "1px 6px", borderRadius: 4, color: "#00e5a0", fontWeight: 700 }}>
    AUTO
  </span>
);
