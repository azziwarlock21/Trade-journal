import { useMemo } from "react";
import { computeDayMap, computeWeeklyPnLSeries } from "../utils/analytics.js";

// ─── TradingCalendar ──────────────────────────────────────────────────────
// Monthly calendar view: green/red/gray days by net P&L, trade count per
// day, prev/next navigation, click-to-filter, and a weekly net-P&L summary
// row after each trading week. Renders against the FULL trade history (not
// the analytics-filtered set) so every month is browsable regardless of
// the current Mode/Month filter.
//
// Shows Monday-Friday only (GC doesn't trade Saturday, and while there's a
// real Sunday overnight session, folding it into "Monday" for calendar
// display purposes keeps a standard trading-week grid rather than adding a
// 6th/7th column for one edge case).
//
// Props:
//   trades          - full trade array
//   date            - { year, month } (month is 0-indexed)
//   onDateChange     - (nextDate) => void
//   selectedDay      - "YYYY-MM-DD" | null
//   onDayClick       - (dateStr | null) => void — called with null to clear

const WEEKDAY_COLS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function TradingCalendar({ trades = [], date, onDateChange, selectedDay, onDayClick }) {
  if (!date) return null;

  const { year, month } = date;

  const dayMap = useMemo(() => computeDayMap(trades), [trades]);
  const weeklySeries = useMemo(() => computeWeeklyPnLSeries(trades), [trades]);
  const weeklyByStart = useMemo(() => {
    const m = {};
    weeklySeries.forEach(w => { m[w.weekStart] = w; });
    return m;
  }, [weeklySeries]);

  const monthLabel = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthDays = Object.entries(dayMap).filter(([d]) => d.startsWith(monthKey));
  const monthPnL = monthDays.reduce((s, [, v]) => s + v.pnl, 0);
  const monthTrades = monthDays.reduce((s, [, v]) => s + v.trades, 0);
  const monthWins = monthDays.reduce((s, [, v]) => s + v.wins, 0);

  const bestDayThisMonth = monthDays.length
    ? monthDays.reduce((a, b) => (b[1].pnl > a[1].pnl ? b : a))
    : null;
  const worstDayThisMonth = monthDays.length
    ? monthDays.reduce((a, b) => (b[1].pnl < a[1].pnl ? b : a))
    : null;

  const prevMonth = () => onDateChange(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => onDateChange(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const navBtn = {
    width: 32, height: 32, borderRadius: 7, border: "1px solid #2a2f3a",
    background: "transparent", color: "#e6edf3", fontSize: 16, cursor: "pointer",
    fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
  };

  // Build a Mon-Fri grid, one row per week, with a trailing summary cell.
  // dow: 0=Sun ... 6=Sat. We only place cells for dow 1-5 (Mon-Fri).
  // Each row starts a "week" whose weekStart key matches computeWeeklyPnLSeries
  // (Monday date), so the row summary always corresponds exactly to the
  // days actually shown in that row.
  const weeks = useMemo(() => {
    const rows = [];
    let currentWeek = null;
    let currentWeekStart = null;

    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(year, month, day).getDay(); // integers only, no tz risk
      if (dow === 0 || dow === 6) continue; // skip Sat/Sun entirely

      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      if (dow === 1 || currentWeek === null) {
        // New week starts on Monday, OR this is the first Mon-Fri day of
        // the month and it isn't a Monday (partial first week).
        if (currentWeek) rows.push({ weekStart: currentWeekStart, days: currentWeek });
        currentWeek = [];
        currentWeekStart = dateStr; // may be corrected below if not actually Monday
        if (dow !== 1) {
          // Back-compute the real Monday of this partial week so it matches
          // computeWeeklyPnLSeries's key exactly, even though that Monday
          // falls in the previous month and isn't rendered.
          const mondayOffset = dow - 1; // Tue=1, Wed=2, etc.
          const mondayDate = new Date(year, month, day - mondayOffset);
          currentWeekStart = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, "0")}-${String(mondayDate.getDate()).padStart(2, "0")}`;
        }
      }
      currentWeek.push({ day, dateStr, dow });
    }
    if (currentWeek && currentWeek.length) rows.push({ weekStart: currentWeekStart, days: currentWeek });
    return rows;
  }, [year, month, daysInMonth]);

  return (
    <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 20, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c842", letterSpacing: 2 }}>{monthLabel.toUpperCase()}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 4, justifyContent: "center" }}>
            <span style={{ fontSize: 10, color: monthPnL >= 0 ? "#00e5a0" : "#ff4d6d", fontWeight: 700 }}>
              {monthPnL >= 0 ? "+" : ""}${monthPnL.toFixed(0)} net
            </span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{monthTrades} trades</span>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{monthWins}W / {monthTrades - monthWins}L</span>
          </div>
        </div>
        <button onClick={nextMonth} style={navBtn}>›</button>
      </div>

      {/* Best/worst day this month */}
      {(bestDayThisMonth || worstDayThisMonth) && (
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
          {bestDayThisMonth && (
            <div style={{ fontSize: 10, color: "#4b5563" }}>
              Best day: <span style={{ color: "#00e5a0", fontWeight: 700 }}>
                {new Date(bestDayThisMonth[0] + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} (+${bestDayThisMonth[1].pnl.toFixed(0)})
              </span>
            </div>
          )}
          {worstDayThisMonth && worstDayThisMonth[1].pnl < 0 && (
            <div style={{ fontSize: 10, color: "#4b5563" }}>
              Worst day: <span style={{ color: "#ff4d6d", fontWeight: 700 }}>
                {new Date(worstDayThisMonth[0] + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${worstDayThisMonth[1].pnl.toFixed(0)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Day-of-week headers (Mon-Fri only, + Week summary column) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) 110px", gap: 3, marginBottom: 3 }}>
        {WEEKDAY_COLS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, color: "#4b5563", fontWeight: 700, letterSpacing: 1, padding: "4px 0" }}>{d}</div>
        ))}
        <div style={{ textAlign: "center", fontSize: 9, color: "#4b5563", fontWeight: 700, letterSpacing: 1, padding: "4px 0" }}>Week</div>
      </div>

      {/* Calendar grid, one row per week + trailing weekly summary cell */}
      {weeks.map((week, wi) => {
        const weekData = weeklyByStart[week.weekStart];
        const weekPnL = weekData?.pnl ?? 0;
        const weekTrades = weekData?.trades ?? 0;
        const weekWins = weekData?.wins ?? 0;
        // Leading blanks so the row still aligns Mon-Fri if the week is partial
        const leadingBlanks = week.days.length ? week.days[0].dow - 1 : 0;

        return (
          <div key={week.weekStart} style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) 110px", gap: 3, marginBottom: 3 }}>
            {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${wi}-${i}`} style={{ minHeight: 64 }} />)}

            {week.days.map(({ day, dateStr }) => {
              const data = dayMap[dateStr];
              const isToday = dateStr === today;
              const isSelected = selectedDay === dateStr;

              let bg = "#070b12", border = "#1f2937", pnlColor = "#4b5563";
              if (data) {
                if (data.pnl > 0)       { bg = "rgba(0,229,160,0.10)";  border = "rgba(0,229,160,0.3)";  pnlColor = "#00e5a0"; }
                else if (data.pnl < 0)  { bg = "rgba(255,77,109,0.10)"; border = "rgba(255,77,109,0.3)"; pnlColor = "#ff4d6d"; }
                else                    { bg = "rgba(139,148,158,0.08)"; border = "#2a2f3a";              pnlColor = "#8b949e"; }
              }
              if (isSelected) { bg = "rgba(245,200,66,0.12)"; border = "#f5c842"; }
              if (isToday) border = "#3b82f6";

              return (
                <div
                  key={day}
                  onClick={() => onDayClick(isSelected ? null : dateStr)}
                  style={{
                    minHeight: 64, borderRadius: 8, border: `1px solid ${border}`, background: bg,
                    padding: "6px 7px", cursor: data ? "pointer" : "default",
                    transition: "all 0.15s", position: "relative",
                  }}>
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#3b82f6" : "#6b7280", marginBottom: 2 }}>
                    {day}
                  </div>
                  {data && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: pnlColor, lineHeight: 1.2 }}>
                        {data.pnl >= 0 ? "+" : ""}${Math.round(data.pnl)}
                      </div>
                      <div style={{ fontSize: 9, color: "#4b5563", marginTop: 3 }}>
                        {data.trades}t · {data.wins}W
                      </div>
                    </>
                  )}
                  {isToday && (
                    <div style={{ position: "absolute", top: 4, right: 4, width: 5, height: 5, borderRadius: "50%", background: "#3b82f6" }} />
                  )}
                </div>
              );
            })}

            {/* Weekly summary cell */}
            <div style={{
              minHeight: 64, borderRadius: 8, padding: "6px 8px",
              background: weekTrades ? (weekPnL >= 0 ? "rgba(0,229,160,0.06)" : "rgba(255,77,109,0.06)") : "#070b12",
              border: `1px solid ${weekTrades ? (weekPnL >= 0 ? "rgba(0,229,160,0.25)" : "rgba(255,77,109,0.25)") : "#1f2937"}`,
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ fontSize: 8, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Week net</div>
              {weekTrades ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: weekPnL >= 0 ? "#00e5a0" : "#ff4d6d" }}>
                    {weekPnL >= 0 ? "+" : ""}${weekPnL.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{weekTrades}t · {weekWins}W</div>
                </>
              ) : (
                <div style={{ fontSize: 10, color: "#2a2f3a" }}>—</div>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        {[["#00e5a0", "Profit day"], ["#ff4d6d", "Loss day"], ["#8b949e", "Breakeven"], ["#3b82f6", "Today"]].map(([color, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color + "40", border: `1px solid ${color}80` }} />
            <span style={{ fontSize: 9, color: "#4b5563" }}>{label}</span>
          </div>
        ))}
        {selectedDay && (
          <button
            onClick={() => onDayClick(null)}
            style={{ marginLeft: "auto", fontSize: 9, color: "#f5c842", background: "transparent", border: "1px solid #f5c84244", borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>
            Clear filter ✕
          </button>
        )}
      </div>
    </div>
  );
}
