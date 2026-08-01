import { useMemo } from "react";
import { GRADES, TRADE_MODES } from "../utils/constants.js";
import { computeStats, computeStreaks, computeDrawdown, computeMonthlySummary } from "../utils/analytics.js";
import { gradeColor } from "../utils/helpers.js";
import TradingCalendar from "./TradingCalendar.jsx";
import EquityCurve from "./EquityCurve.jsx";
import PerformanceDashboard from "./PerformanceDashboard.jsx";
import ProfessionalStats from "./ProfessionalStats.jsx";
import BarRow from "./BarRow.jsx";
import HeatmapCell from "./HeatmapCell.jsx";

const TSX_TRAILING_LIMIT = 2500; // $2,500 trailing drawdown limit for 50k account

// ─── Analytics ────────────────────────────────────────────────────────────
// The main Analytics tab: mode/month filters, trading calendar, KPI cards,
// monthly breakdown table, equity curve, drawdown tracker, category
// breakdown charts, time-of-day heatmap, and the auto setup ranker.
//
// Computes stats/streaks/drawdown internally from the full `trades` array
// so it stays in sync with any filter changes without prop drilling
// derived state from the parent.

export default function Analytics({
  trades = [],
  analyticsMode, setAnalyticsMode,
  analyticsMonth, setAnalyticsMonth,
  calendarDate, setCalendarDate,
  calendarDayFilter, setCalendarDayFilter,
}) {
  const availableMonths = useMemo(() => {
    return [...new Set(trades.map(t => t.entryDatetime?.slice(0, 7)).filter(Boolean))].sort().reverse();
  }, [trades]);

  const analyticsTrades = useMemo(() => {
    let src = trades;
    if (analyticsMode !== "All") src = src.filter(t => (t.tradeMode || "Backtest") === analyticsMode);
    if (analyticsMonth !== "All") src = src.filter(t => t.entryDatetime && t.entryDatetime.slice(0, 7) === analyticsMonth);
    return src;
  }, [trades, analyticsMode, analyticsMonth]);

  const stats = useMemo(() => computeStats(analyticsTrades), [analyticsTrades]);
  const streaks = useMemo(() => computeStreaks(trades), [trades]);
  const drawdown = useMemo(() => computeDrawdown(trades), [trades]);

  const activeHours = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.heatmap).map(Number)
      .filter(h => stats.heatmap[h].Long.total > 0 || stats.heatmap[h].Short.total > 0);
  }, [stats]);

  const handleDayClick = (dateStr) => {
    setCalendarDayFilter(dateStr);
    if (dateStr) {
      const monthKey = dateStr.slice(0, 7);
      setAnalyticsMonth(monthKey);
    }
  };

  const clearCalendarFilter = () => {
    setCalendarDayFilter(null);
    setAnalyticsMonth("All");
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>

      {/* ── Mode filter ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>MODE:</span>
        {["All", ...TRADE_MODES].map(m => (
          <button key={m} onClick={() => setAnalyticsMode(m)} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMode === m ? "#f5c842" : "#2a2f3a"}`, background: analyticsMode === m ? "rgba(245,200,66,0.1)" : "transparent", color: analyticsMode === m ? "#f5c842" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
            {m}
          </button>
        ))}
      </div>

      {/* ── Month filter ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>MONTH:</span>
        <button onClick={() => setAnalyticsMonth("All")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMonth === "All" ? "#a78bfa" : "#2a2f3a"}`, background: analyticsMonth === "All" ? "rgba(167,139,250,0.1)" : "transparent", color: analyticsMonth === "All" ? "#a78bfa" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          All
        </button>
        {availableMonths.map(m => {
          const label = new Date(m + "-02").toLocaleString("en-US", { month: "short", year: "2-digit" });
          return (
            <button key={m} onClick={() => setAnalyticsMonth(m)} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMonth === m ? "#a78bfa" : "#2a2f3a"}`, background: analyticsMonth === m ? "rgba(167,139,250,0.1)" : "transparent", color: analyticsMonth === m ? "#a78bfa" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          );
        })}
        <span style={{ fontSize: 10, color: "#4b5563" }}>{analyticsTrades.length} trades</span>
      </div>

      {/* ── Trading calendar ── */}
      <TradingCalendar
        trades={trades}
        date={calendarDate}
        onDateChange={setCalendarDate}
        selectedDay={calendarDayFilter}
        onDayClick={(d) => (d ? handleDayClick(d) : clearCalendarFilter())}
      />

      {!stats ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563", fontSize: 13 }}>No trade data yet. Log some trades first.</div>
      ) : (
        <>
          <KPICards stats={stats} streaks={streaks} drawdown={drawdown} analyticsTrades={analyticsTrades} />

          {analyticsMonth === "All" && stats.monthlyData.length > 0 && (
            <MonthlyBreakdownTable monthlyData={stats.monthlyData} />
          )}

          <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Equity Curve — Cumulative Points</div>
            <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 10 }}>Dots: green=win red=loss</div>
            <EquityCurve data={stats.equity} />
          </div>

          <DrawdownTracker drawdown={drawdown} />

          <PerformanceDashboard completedTrades={analyticsTrades} />

          <ProfessionalStats trades={analyticsTrades} />

          <CategoryChartsGrid stats={stats} />

          <TimeOfDayHeatmap stats={stats} activeHours={activeHours} />

          <AutoSetupRanker analyticsTrades={analyticsTrades} />
        </>
      )}
    </div>
  );
}

// ─── KPICards ─────────────────────────────────────────────────────────────
function KPICards({ stats, streaks, drawdown, analyticsTrades }) {
  const cards = [
    ["Total Trades", analyticsTrades.length, "#e6edf3"],
    ["Win Rate", `${stats.winRate}%`, "#00e5a0"],
    ["Total Points", stats.totalPoints, parseFloat(stats.totalPoints) >= 0 ? "#00e5a0" : "#ff4d6d"],
    ["Overall Gain", `${parseFloat(stats.gainPct) >= 0 ? "+" : ""}${stats.gainPct}%`, parseFloat(stats.gainPct) >= 0 ? "#00e5a0" : "#ff4d6d"],
    ["Avg Pts/Trade", stats.avgPoints, "#e6edf3"],
    ["Avg RRR (wins)", stats.avgRRR, "#f5c842"],
    ["Expectancy", `${parseFloat(stats.expectancy) >= 0 ? "+" : ""}${stats.expectancy}R`, parseFloat(stats.expectancy) >= 0 ? "#00e5a0" : "#ff4d6d"],
    ["W / L", `${stats.wins} / ${stats.losses}`, "#e6edf3"],
    ["Win Streak", `${streaks.curWin}W cur / ${streaks.maxWin}W best`, "#00e5a0"],
    ["Loss Streak", `${streaks.curLoss}L cur / ${streaks.maxLoss}L worst`, streaks.curLoss >= 3 ? "#ff4d6d" : "#e6edf3"],
    ["Current DD", drawdown.current > 0 ? `-$${drawdown.current.toFixed(0)}` : "$0", drawdown.current > 1500 ? "#ff4d6d" : drawdown.current > 500 ? "#f5c842" : "#00e5a0"],
    ["Max Drawdown", `-$${drawdown.max.toFixed(0)}`, drawdown.max > 2000 ? "#ff4d6d" : "#e6edf3"],
    ...(stats.avgMAE ? [["Avg MAE", `${stats.avgMAE} pts`, "#a78bfa"]] : []),
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 16 }}>
      {cards.map(([label, val, color]) => (
        <div key={label} style={{ background: "#0d1117", border: label === "Overall Gain" ? `1px solid ${parseFloat(stats.gainPct) >= 0 ? "#00e5a044" : "#ff4d6d44"}` : "1px solid #1f2937", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: label.includes("Streak") ? 14 : 22, fontWeight: 700, color }}>{val}</div>
          {label === "Overall Gain" && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>+2% per win · −1% per loss</div>}
          {label === "Avg RRR (wins)" && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>losses excluded</div>}
          {label === "Expectancy" && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>R earned per trade avg</div>}
        </div>
      ))}
    </div>
  );
}

// ─── MonthlyBreakdownTable ────────────────────────────────────────────────
function MonthlyBreakdownTable({ monthlyData }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Monthly Breakdown</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              {["Month", "Trades", "W", "L", "Win Rate", "Points", "Gain %"].map(h => (
                <td key={h} style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", paddingBottom: 10, paddingRight: 16, whiteSpace: "nowrap" }}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthlyData.map(m => {
              const gain = parseFloat(m.gainPct);
              const pts = parseFloat(m.points);
              return (
                <tr key={m.mo} style={{ borderTop: "1px solid #1f2937" }}>
                  <td style={{ padding: "10px 16px 10px 0", color: "#e6edf3", fontWeight: 700 }}>
                    {new Date(m.mo + "-02").toLocaleString("en-US", { month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "10px 16px 10px 0", color: "#9ca3af" }}>{m.total}</td>
                  <td style={{ padding: "10px 16px 10px 0", color: "#00e5a0" }}>{m.wins}</td>
                  <td style={{ padding: "10px 16px 10px 0", color: "#ff4d6d" }}>{m.losses}</td>
                  <td style={{ padding: "10px 16px 10px 0", color: parseInt(m.wr) >= 55 ? "#00e5a0" : parseInt(m.wr) >= 40 ? "#f5c842" : "#ff4d6d", fontWeight: 700 }}>{m.wr}%</td>
                  <td style={{ padding: "10px 16px 10px 0", color: pts >= 0 ? "#00e5a0" : "#ff4d6d", fontWeight: 700 }}>{pts >= 0 ? "+" : ""}{m.points}</td>
                  <td style={{ padding: "10px 16px 10px 0", fontWeight: 700 }}>
                    <span style={{ color: gain >= 0 ? "#00e5a0" : "#ff4d6d", background: gain >= 0 ? "rgba(0,229,160,0.08)" : "rgba(255,77,109,0.08)", padding: "2px 10px", borderRadius: 20 }}>
                      {gain >= 0 ? "+" : ""}{m.gainPct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DrawdownTracker ──────────────────────────────────────────────────────
function DrawdownTracker({ drawdown }) {
  const ddPct = (drawdown.current / TSX_TRAILING_LIMIT) * 100;
  return (
    <div style={{ background: "#0d1117", border: `1px solid ${drawdown.current > 1500 ? "#ff4d6d44" : "#1f2937"}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Drawdown Tracker</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Current DD", `$${drawdown.current.toFixed(0)}`, drawdown.current > 1500 ? "#ff4d6d" : drawdown.current > 500 ? "#f5c842" : "#00e5a0"],
          ["Max Drawdown", `$${drawdown.max.toFixed(0)}`, drawdown.max > 2000 ? "#ff4d6d" : "#e6edf3"],
          ["Peak Profit", `$${drawdown.peak.toFixed(0)}`, "#00e5a0"],
          ["TSX Limit (50k)", `$${TSX_TRAILING_LIMIT.toLocaleString()}`, "#6b7280"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: "#070b12", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#6b7280" }}>Drawdown used vs ${TSX_TRAILING_LIMIT.toLocaleString()} TopstepX trailing limit</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: ddPct > 70 ? "#ff4d6d" : "#f5c842" }}>{ddPct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 10, background: "#1f2937", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(ddPct, 100)}%`, background: ddPct > 70 ? "#ff4d6d" : ddPct > 40 ? "#f5c842" : "#00e5a0", borderRadius: 5, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ fontSize: 10, color: "#4b5563", marginTop: 8 }}>
        ${(TSX_TRAILING_LIMIT - drawdown.current).toFixed(0)} remaining before trailing drawdown breach
      </div>
    </div>
  );
}

// ─── CategoryChartsGrid ───────────────────────────────────────────────────
function CategoryChartsGrid({ stats }) {
  const sortByWR = (obj) => Object.entries(obj).sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Setup Grade</div>
        {GRADES.map(g => <BarRow key={g} label={`Grade ${g}`} wins={stats.byGrade[g].wins} total={stats.byGrade[g].total} color={gradeColor(g)} />)}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Execution Grade</div>
        {GRADES.map(g => <BarRow key={g} label={`Exec ${g}`} wins={stats.byExecGrade[g].wins} total={stats.byExecGrade[g].total} color={gradeColor(g)} />)}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Session Performance</div>
        {sortByWR(stats.bySession).map(([s, d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color="#3b82f6" />)}
        {!Object.keys(stats.bySession).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>HTF Bias Win Rate</div>
        {sortByWR(stats.byHtf).map(([s, d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color={s === "Bullish" ? "#00e5a0" : s === "Bearish" ? "#ff4d6d" : "#f5c842"} />)}
        {!Object.keys(stats.byHtf).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No HTF data yet</div>}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Market Structure</div>
        {sortByWR(stats.byStructure).map(([s, d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color="#a78bfa" />)}
        {!Object.keys(stats.byStructure).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Candle Pattern</div>
        {sortByWR(stats.byCandle).slice(0, 8).map(([c, d]) => <BarRow key={c} label={c} wins={d.wins} total={d.total} color="#8b5cf6" />)}
        {!Object.keys(stats.byCandle).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Trade Type</div>
        {sortByWR(stats.byType).map(([s, d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color="#f97316" />)}
        {!Object.keys(stats.byType).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
      </div>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Setup vs Execution</div>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 12 }}>Are you executing A setups well?</div>
        {[
          ["A setup, A execution", stats.setupVsExec.AA, "#00e5a0"],
          ["A setup, poor execution", stats.setupVsExec.AB, "#f5c842"],
          ["B/C setup, good execution", stats.setupVsExec.BA, "#3b82f6"],
          ["B setup, B execution", stats.setupVsExec.BB, "#8b949e"],
          ["Other combos", stats.setupVsExec.other, "#4b5563"],
        ].map(([label, count, color]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TimeOfDayHeatmap ─────────────────────────────────────────────────────
function TimeOfDayHeatmap({ stats, activeHours }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Time of Day Heatmap (ET Hours)</div>
      <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 14 }}>Win rate by hour × direction. Only hours with trades shown.</div>
      {activeHours.length === 0 ? (
        <div style={{ color: "#4b5563", fontSize: 11 }}>No trades with timestamps yet.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${activeHours.length}, minmax(52px, 1fr))`, gap: 4, minWidth: activeHours.length * 56 + 84 }}>
            <div style={{ fontSize: 9, color: "#6b7280", display: "flex", alignItems: "center" }}>Direction</div>
            {activeHours.map(h => <div key={h} style={{ fontSize: 9, color: "#6b7280", textAlign: "center", paddingBottom: 4 }}>{h.toString().padStart(2, "0")}:00</div>)}
            {["Long", "Short"].map(dir => (
              <>
                <div key={dir + "lbl"} style={{ fontSize: 10, color: dir === "Long" ? "#00e5a0" : "#ff4d6d", display: "flex", alignItems: "center", fontWeight: 700 }}>{dir}</div>
                {activeHours.map(h => <HeatmapCell key={dir + h} wins={stats.heatmap[h][dir]?.wins || 0} total={stats.heatmap[h][dir]?.total || 0} />)}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AutoSetupRanker ──────────────────────────────────────────────────────
function AutoSetupRanker({ analyticsTrades }) {
  const ranked = useMemo(() => {
    const combos = {};
    analyticsTrades.forEach(t => {
      const key = [t.tradeType, t.candlePattern, t.session, t.direction, t.htfBias].filter(Boolean).join(" | ");
      if (!key) return;
      if (!combos[key]) combos[key] = { total: 0, wins: 0, pts: 0 };
      combos[key].total++;
      if (t.outcome === "Win") combos[key].wins++;
      combos[key].pts += parseFloat(t.points) || 0;
    });
    return Object.entries(combos)
      .map(([k, d]) => ({ key: k, ...d, wr: d.wins / d.total, score: (d.wins / d.total) * 100 + d.pts / d.total }))
      .sort((a, b) => b.score - a.score);
  }, [analyticsTrades]);

  return (
    <div style={{ background: "#0d1117", border: "1px solid #f5c84233", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Auto Setup Ranker</div>
      {!ranked.length ? (
        <div style={{ color: "#4b5563", fontSize: 11 }}>Log more trades to see ranked setups.</div>
      ) : (
        ranked.slice(0, 10).map((r, i) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #1f2937", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? "#f5c842" : "#374151", minWidth: 24 }}>#{i + 1}</span>
            <span style={{ fontSize: 10, color: "#e6edf3", flex: 1, minWidth: 160 }}>{r.key}</span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{r.total} trades</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: r.wr >= 0.6 ? "#00e5a0" : r.wr >= 0.4 ? "#f5c842" : "#ff4d6d" }}>{(r.wr * 100).toFixed(0)}% WR</span>
            <span style={{ fontSize: 11, color: r.pts >= 0 ? "#00e5a0" : "#ff4d6d" }}>{(r.pts / r.total).toFixed(1)} pts/trade</span>
            <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: r.wr >= 0.65 ? "rgba(0,229,160,0.1)" : r.wr >= 0.45 ? "rgba(245,200,66,0.1)" : "rgba(255,77,109,0.1)", color: r.wr >= 0.65 ? "#00e5a0" : r.wr >= 0.45 ? "#f5c842" : "#ff4d6d" }}>
              {r.wr >= 0.65 ? "A" : r.wr >= 0.45 ? "B" : "C"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
