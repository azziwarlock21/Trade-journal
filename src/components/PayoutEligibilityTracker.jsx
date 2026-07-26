import { useMemo } from "react";
import { computePayoutEligibility } from "../utils/analytics.js";

// ─── PayoutEligibilityTracker ─────────────────────────────────────────────
// TopstepX payout rule: at least 5 separate trading days with net P&L of
// $150 or more each. This panel counts qualifying days from the full trade
// history and shows exactly which days counted, so there's no ambiguity
// about what's driving the count.
//
// Uses computePayoutEligibility from analytics.js, which is built on the
// same computeDayMap the Trading Calendar uses — "a day" means the same
// thing everywhere in the app.

export default function PayoutEligibilityTracker({ trades }) {
  const eligibility = useMemo(() => computePayoutEligibility(trades), [trades]);
  const { qualifyingDays, qualifyingDayCount, minQualifyingDays, minDailyProfit, daysRemaining, eligible } = eligibility;

  const pct = Math.min((qualifyingDayCount / minQualifyingDays) * 100, 100);

  return (
    <div style={{ background: "#0d1117", border: `1px solid ${eligible ? "#00e5a044" : "#1f2937"}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>
          TopstepX Payout Eligibility
        </div>
        {eligible && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#00e5a0", background: "rgba(0,229,160,0.1)", padding: "3px 10px", borderRadius: 20, border: "1px solid #00e5a044" }}>
            ✓ ELIGIBLE
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 16 }}>
        Requires {minQualifyingDays} separate trading days with at least ${minDailyProfit} net profit each.
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{qualifyingDayCount} of {minQualifyingDays} qualifying days</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: eligible ? "#00e5a0" : "#f5c842" }}>
          {eligible ? "Ready to request payout" : `${daysRemaining} more day${daysRemaining !== 1 ? "s" : ""} needed`}
        </span>
      </div>
      <div style={{ height: 10, background: "#1f2937", borderRadius: 5, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: eligible ? "#00e5a0" : "#f5c842", borderRadius: 5, transition: "width 0.4s ease" }} />
      </div>

      {/* Qualifying days list */}
      {qualifyingDays.length === 0 ? (
        <div style={{ fontSize: 11, color: "#4b5563" }}>No qualifying days yet — log trades to start tracking.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {qualifyingDays.map((d, i) => (
            <div key={d.date} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#070b12", borderRadius: 8, border: "1px solid #1f2937" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#00e5a0", minWidth: 18 }}>#{i + 1}</span>
              <span style={{ fontSize: 11, color: "#e6edf3" }}>
                {new Date(d.date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00e5a0", marginLeft: "auto" }}>+${d.pnl.toFixed(2)}</span>
              <span style={{ fontSize: 9, color: "#4b5563" }}>{d.trades} trade{d.trades !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
