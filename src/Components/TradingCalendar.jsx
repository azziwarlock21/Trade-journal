import { useMemo } from "react";
import { computeDayMap } from "../utils/analytics.js";

// ─── TradingCalendar ──────────────────────────────────────────────────────
// Monthly calendar view: green/red/gray days by net P&L, trade count per
// day, prev/next navigation, and click-to-filter. Renders against the FULL
// trade history (not the analytics-filtered set) so every month is browsable
// regardless of the current Mode/Month filter.
//
// Props:
//   trades          - full trade array
//   date            - { year, month } (month is 0-indexed)
//   onDateChange     - (nextDate) => void
//   selectedDay      - "YYYY-MM-DD" | null
//   onDayClick       - (dateStr | null) => void — called with null to clear

export default function TradingCalendar({ trades, date, onDateChange, selectedDay, onDayClick }) {
  const { year, month } = date;

  const dayMap = useMemo(() => computeDayMap(trades), [trades]);

  const monthLabel = new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthDays = Object.entries(dayMap).filter(([d]) => d.startsWith(monthKey));
  const monthPnL = monthDays.reduce((s, [, v]) => s + v.pnl, 0);
  const monthTrades = monthDays.reduce((s, [, v]) => s + v.trades, 0);
  const monthWins = monthDays.reduce((s, [, v]) => s + v.wins, 0);

  const prevMonth = () => onDateChange(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => onDateChange(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const navBtn = {
    width: 32, height: 32, borderRadius: 7, border: "1px solid #2a2f3a",
    background: "transparent", color: "#e6edf3", fontSize: 16, cursor: "pointer",
    fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
  };

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

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, color: "#4b5563", fontWeight: 700, letterSpacing: 1, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ minHeight: 64 }} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const data = dayMap[dateStr];
          const isToday = dateStr === today;
          const isSelected = selectedDay === dateStr;
          const dow = new Date(year, month, day).getDay();
          const isWeekend = dow === 0 || dow === 6;

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
                minHeight: 64,
                borderRadius: 8,
                border: `1px solid ${border}`,
                background: bg,
                padding: "6px 7px",
                cursor: data ? "pointer" : "default",
                opacity: isWeekend && !data ? 0.4 : 1,
                transition: "all 0.15s",
                position: "relative",
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
      </div>

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
