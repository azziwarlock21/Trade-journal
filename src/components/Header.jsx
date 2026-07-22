// ─── Header ───────────────────────────────────────────────────────────────
// Sticky top bar: logo, trade count, sync indicator, tab navigation,
// CSV import/export, and TopstepX sync buttons.

const NAV_TABS = ["journal", "log", "analytics", "rules", "calc", "coach", "payouts", "tax", "expenses", "review"];
const NAV_LABELS = { calc: "Position", coach: "AI Coach", review: "Weekly" };

export default function Header({
  view, onViewChange, tradeCount,
  syncing, syncError,
  onExportCSV, onImportCSV,
  syncRunning, onSyncNew, onSyncFull,
}) {
  const syncIndicator = syncing
    ? <span style={{ fontSize: 10, color: "#f5c842", letterSpacing: 1 }}>saving...</span>
    : syncError
    ? <span style={{ fontSize: 10, color: "#ff4d6d" }}>{syncError}</span>
    : tradeCount > 0
    ? <span style={{ fontSize: 10, color: "#00e5a0" }}>cloud synced</span>
    : null;

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117, #111827)", borderBottom: "1px solid #1f2937", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #f5c842, #ff9a3c)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#f5c842", letterSpacing: 2 }}>GC FUTURES JOURNAL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3 }}>GOLD · {tradeCount} TRADES</span>
            {syncIndicator}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {NAV_TABS.map(v => (
          <button key={v} onClick={() => onViewChange(v)}
            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${view === v ? "#f5c842" : "#2a2f3a"}`, background: view === v ? "rgba(245,200,66,0.1)" : "transparent", color: view === v ? "#f5c842" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit" }}>
            {NAV_LABELS[v] || v}
          </button>
        ))}

        <button onClick={onExportCSV} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>CSV ↓</button>
        <label style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
          CSV ↑<input type="file" accept=".csv" onChange={onImportCSV} style={{ display: "none" }} />
        </label>

        <button onClick={onSyncNew} disabled={syncRunning} title="Sync new trades from TopstepX"
          style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${syncRunning ? "#2a2f3a" : "#2a2f3a"}`, background: "transparent", color: syncRunning ? "#6b7280" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: syncRunning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {syncRunning ? "Syncing..." : "TSX ↓"}
        </button>
        <button onClick={onSyncFull} disabled={syncRunning} title="Reset and re-import all TopstepX trades"
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #a78bfa44", background: "transparent", color: syncRunning ? "#6b7280" : "#a78bfa", fontSize: 10, fontWeight: 700, cursor: syncRunning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          TSX Full
        </button>
      </div>
    </div>
  );
}
