import { useMemo } from "react";
import {
  computeByWeekday, computeByHour, computeByDirection,
  computeByNewsImpact, computeExcursionStats, computeByHoldTime,
} from "../utils/analytics.js";
import BarRow from "./BarRow.jsx";

// ─── ProfessionalStats ────────────────────────────────────────────────────
// Phase 3: the Tradervue/Edgewonk-style breakdown grid. Weekday, hour-of-day
// (standalone from the existing direction-split heatmap), long vs short,
// news impact, MAE/MFE excursion analysis, and hold-time buckets.
//
// MAE/MFE panel note: these fields are optional on every trade (you only
// see numbers here for trades where you logged an extreme price). Sample
// size is always shown so a stat from 2 trades doesn't get mistaken for a
// stat from 50.

export default function ProfessionalStats({ trades = [] }) {
  const byWeekday = useMemo(() => computeByWeekday(trades), [trades]);
  const byHour = useMemo(() => computeByHour(trades), [trades]);
  const byDirection = useMemo(() => computeByDirection(trades), [trades]);
  const byNews = useMemo(() => computeByNewsImpact(trades), [trades]);
  const excursion = useMemo(() => computeExcursionStats(trades), [trades]);
  const byHoldTime = useMemo(() => computeByHoldTime(trades), [trades]);

  if (!Array.isArray(trades) || trades.length === 0) return null;

  const sortByWR = (obj) => Object.entries(obj).sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total));

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12, marginTop: 4 }}>
        Professional Statistics
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Weekday performance */}
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Weekday Performance</div>
          {Object.keys(byWeekday).length ? (
            Object.entries(byWeekday).map(([day, d]) => <BarRow key={day} label={day} wins={d.wins} total={d.total} color="#3b82f6" />)
          ) : (
            <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>
          )}
        </div>

        {/* Hour of day (standalone) */}
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Hour of Day (ET)</div>
          {Object.keys(byHour).length ? (
            sortByWR(byHour).slice(0, 8).map(([hr, d]) => <BarRow key={hr} label={hr} wins={d.wins} total={d.total} color="#f97316" />)
          ) : (
            <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>
          )}
        </div>

        {/* Long vs Short */}
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Long vs Short</div>
          {["Long", "Short"].map(dir => {
            const d = byDirection[dir];
            if (!d.total) return null;
            const avgPts = (d.points / d.total).toFixed(1);
            return (
              <div key={dir} style={{ marginBottom: 14 }}>
                <BarRow label={dir} wins={d.wins} total={d.total} color={dir === "Long" ? "#00e5a0" : "#ff4d6d"} />
                <div style={{ fontSize: 9, color: "#4b5563", marginTop: -6 }}>{avgPts} pts/trade avg</div>
              </div>
            );
          })}
          {!byDirection.Long.total && !byDirection.Short.total && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
        </div>

        {/* News impact */}
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>News Impact</div>
          {Object.keys(byNews).length ? (
            sortByWR(byNews).map(([label, d]) => (
              <BarRow key={label} label={label} wins={d.wins} total={d.total} color={label === "No News Nearby" ? "#00e5a0" : "#ff4d6d"} />
            ))
          ) : (
            <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>
          )}
        </div>

        {/* Hold Time */}
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18, gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Hold Time Performance</div>
          {Object.keys(byHoldTime).length ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
              {Object.entries(byHoldTime).map(([bucket, d]) => <BarRow key={bucket} label={bucket} wins={d.wins} total={d.total} color="#a78bfa" />)}
            </div>
          ) : (
            <div style={{ color: "#4b5563", fontSize: 11 }}>Log exit time on your trades to see hold-time performance</div>
          )}
        </div>

        {/* MAE / MFE Excursion Analysis */}
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18, gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>MAE / MFE Excursion Analysis</div>
          <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 14 }}>
            See the Rules tab MAE guide for how to interpret these numbers. Sample size: {excursion.sampleSize.mae} trades with MAE logged, {excursion.sampleSize.mfe} with MFE logged.
          </div>
          {excursion.sampleSize.mae === 0 && excursion.sampleSize.mfe === 0 ? (
            <div style={{ color: "#4b5563", fontSize: 11 }}>Log MAE/MFE extreme prices on your trades to see excursion analysis</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {[
                ["Avg MAE — Wins", excursion.avgMAEWins, "#00e5a0", "lower = precise entries"],
                ["Avg MAE — Losses", excursion.avgMAELosses, "#ff4d6d", "near stop size = normal"],
                ["Avg MFE — Wins", excursion.avgMFEWins, "#00e5a0", "how much you left on the table"],
                ["Avg MFE — Losses", excursion.avgMFELosses, "#ff4d6d", "low = setup rarely worked"],
              ].map(([label, val, color, sub]) => (
                <div key={label} style={{ background: "#070b12", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{val !== null ? `${val.toFixed(1)} pts` : "—"}</div>
                  <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
