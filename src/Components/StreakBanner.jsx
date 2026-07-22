import { useMemo } from "react";
import { computeStreaks, computeTodayPnL } from "../utils/analytics.js";

// ─── StreakBanner ─────────────────────────────────────────────────────────
// Persistent bar under the header: current win/loss streak, all-time best
// win streak, worst loss streak, today's session P&L, and the stop-week
// warning at 2/3 consecutive losses. Only renders once trades exist.

export default function StreakBanner({ trades }) {
  const streaks = useMemo(() => computeStreaks(trades), [trades]);
  const todayPnL = useMemo(() => computeTodayPnL(trades), [trades]);

  if (!trades.length) return null;

  return (
    <div style={{ background: "#0d1117", borderBottom: "1px solid #1f2937", padding: "8px 24px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3 }}>STREAKS</span>
      <span style={{ fontSize: 11, color: streaks.curWin > 0 ? "#00e5a0" : "#4b5563" }}>
        Current: {streaks.curWin > 0 ? `🔥 ${streaks.curWin}W` : streaks.curLoss > 0 ? `❄️ ${streaks.curLoss}L` : "—"}
      </span>
      <span style={{ fontSize: 11, color: "#6b7280" }}>Best win streak: <span style={{ color: "#00e5a0" }}>{streaks.maxWin}W</span></span>
      <span style={{ fontSize: 11, color: "#6b7280" }}>Worst loss streak: <span style={{ color: "#ff4d6d" }}>{streaks.maxLoss}L</span></span>

      <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3 }}>TODAY</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: todayPnL > 0 ? "#00e5a0" : todayPnL < 0 ? "#ff4d6d" : "#4b5563" }}>
        {todayPnL >= 0 ? "+" : ""}${todayPnL.toFixed(2)}
      </span>

      {streaks.curLoss >= 2 && (
        <span style={{ fontSize: 10, fontWeight: 700, color: "#ff4d6d", background: "rgba(255,77,109,0.1)", padding: "2px 10px", borderRadius: 20, border: "1px solid #ff4d6d44" }}>
          {streaks.curLoss >= 3 ? "⚠ STOP WEEK — 3 consecutive losses reached" : "⚠ Warning: 2 losses — 1 more = stop for the week"}
        </span>
      )}

      <span style={{ marginLeft: "auto", fontSize: 9, color: "#4b5563" }}>Press N for new trade</span>
    </div>
  );
}
