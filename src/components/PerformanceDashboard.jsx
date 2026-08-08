import { useMemo } from "react";
import {
  computeProfitFactor, computeWinLossExtremes, computeWinRateTrend, computeWeeklyPnLSeries,
  computeDailyPnLSeries,
} from "../utils/analytics.js";
import BarChart from "./BarChart.jsx";
import LineChart from "./LineChart.jsx";

const fmtDollar = (n) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(0)}`;

// ─── PerformanceDashboard ─────────────────────────────────────────────────
// Phase 2: Profit Factor, Average Winner/Loser, Largest Win/Loss, Win Rate
// Trend (rolling 20-trade window), Daily P&L bar chart, Weekly P&L bar
// chart. Renders below the existing KPI cards / equity curve / drawdown
// tracker in the Analytics tab — additive, doesn't replace anything.

export default function PerformanceDashboard({ trades }) {
  const profitFactor = useMemo(() => computeProfitFactor(trades), [trades]);
  const extremes = useMemo(() => computeWinLossExtremes(trades), [trades]);
  const winRateTrend = useMemo(() => computeWinRateTrend(trades, 20), [trades]);
  const dailyPnL = useMemo(() => computeDailyPnLSeries(trades), [trades]);
  const weeklyPnL = useMemo(() => computeWeeklyPnLSeries(trades), [trades]);

  if (!trades.length) return null;

  const pfDisplay = profitFactor === null ? "∞" : profitFactor.toFixed(2);
  const pfColor = profitFactor === null || profitFactor >= 2 ? "#00e5a0" : profitFactor >= 1 ? "#f5c842" : "#ff4d6d";

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Extended KPI row: Profit Factor, Avg Winner, Avg Loser, Largest Win, Largest Loss */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 14 }}>
        {[
          ["Profit Factor", pfDisplay, pfColor, "gross profit ÷ gross loss"],
          ["Avg Winner", fmtDollar(extremes.avgWinner), "#00e5a0", null],
          ["Avg Loser", fmtDollar(extremes.avgLoser), "#ff4d6d", null],
          ["Largest Win", fmtDollar(extremes.largestWin), "#00e5a0", null],
          ["Largest Loss", fmtDollar(extremes.largestLoss), "#ff4d6d", null],
        ].map(([label, val, color, sub]) => (
          <div key={label} style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
            {sub && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Win Rate Trend */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Win Rate Trend</div>
        <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 10 }}>Rolling win rate over the last 20 trades. Dashed line = 50%.</div>
        <LineChart data={winRateTrend.map(p => ({ value: p.winRate }))} referenceLine={50} color="#3b82f6" />
      </div>

      {/* Daily P&L */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Daily P&amp;L</div>
        <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 10 }}>Net dollars per trading day, in sequence.</div>
        <BarChart
          data={dailyPnL.map(d => ({ label: d.date, value: d.pnl }))}
          valueFormatter={(v) => `$${v.toFixed(0)}`}
        />
      </div>

      {/* Weekly P&L */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Weekly P&amp;L</div>
        <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 10 }}>Net dollars per trading week (Monday start — same week boundary as the stop-week rule).</div>
        <BarChart
          data={weeklyPnL.map(w => ({ label: `Week of ${w.weekStart}`, value: w.pnl }))}
          valueFormatter={(v) => `$${v.toFixed(0)}`}
        />
      </div>
    </div>
  );
}
