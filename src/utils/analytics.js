// ─── Analytics Calculation Engine ───────────────────────────────────────────
// Pure functions that take a trade array and return derived statistics.
// No React, no state — safe to unit test and reuse (e.g. in AI Coach, PDF
// reports, or a future backend).

import { GRADES } from "./constants.js";
import { getETHour } from "./helpers.js";

/**
 * Returns the Monday (ISO week start) date string "YYYY-MM-DD" for a given
 * entryDatetime, using pure string/integer arithmetic — never `new
 * Date(entryDatetime)` on the raw string, since that applies local-browser-
 * timezone interpretation to a timestamp with no timezone suffix (the same
 * class of bug documented in helpers.js). Date.UTC is used only as a
 * calendar-math tool on already-parsed Y/M/D integers, which is safe: it
 * doesn't reinterpret anything, it just computes day-of-week and offsets.
 */
function getWeekStartKey(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return "";
  const [datePart] = entryDatetime.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const dow = new Date(utcMidnight).getUTCDay() || 7; // Mon=1 ... Sun=7
  const mondayMs = utcMidnight - (dow - 1) * 24 * 3600 * 1000;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

/**
 * Computes the full analytics bundle for the Analytics tab.
 * @param {Array} src - filtered trade array (by mode/month)
 * @returns {Object|null} stats bundle, or null if src is empty
 */
function getTradeOutcome(trade) {
  const points = parseFloat(trade.points) || 0;

  if (points > 0) return "Win";
  if (points < 0) return "Loss";

  return trade.outcome || "Breakeven";
}

export function computeStats(src) {
  
  if (!src.length) return null;

  // Keep both datasets available.
  // fills = every TopstepX fill
  // logicalTrades = one completed position regardless of fills
  const fills = src;
  const logicalTrades = groupIntoLogicalTrades(src);

  const wins = logicalTrades.filter(t => t.outcome === "Win");
  const losses = logicalTrades.filter(t => t.outcome === "Loss");

const winRate = (
  (wins.length / logicalTrades.length) * 100
).toFixed(1);

  const avgRRR = wins.length
    ? (wins.reduce((a, t) => a + (parseFloat(t.rrr) || 0), 0) / wins.length).toFixed(2)
    : "0.00";

  const winRate01 = wins.length / logicalTrades.length;
  const expectancy =
logicalTrades.length
  ? ((winRate01 * 2) - ((1 - winRate01) * 1)).toFixed(2)
  : "0.00";

  const avgPoints = (src.reduce((a, t) => a + (parseFloat(t.points) || 0), 0) / src.length).toFixed(1);
  const totalPoints = src.reduce((a, t) => a + (parseFloat(t.points) || 0), 0).toFixed(1);

  const tradesWithMAE = src.filter(t => t.mae);
  const avgMAE = tradesWithMAE.length
    ? (tradesWithMAE.reduce((a, t) => a + parseFloat(t.mae), 0) / tradesWithMAE.length).toFixed(1)
    : null;

  // ── Grade breakdowns ─────────────────────────────────────────────────────
  const byGrade = {};
  GRADES.forEach(g => {
    const gt = src.filter(t => t.grade === g);
    byGrade[g] = { total: gt.length, wins: gt.filter(t => getTradeOutcome(t) === "Win").length };
  });

  const byExecGrade = {};
  GRADES.forEach(g => {
    const gt = src.filter(t => t.executionGrade === g);
    byExecGrade[g] = { total: gt.length, wins: gt.filter(t => getTradeOutcome(t) === "Win").length };
  });

  // ── Category breakdowns (candle pattern, session, type, HTF bias, structure) ─
  const byCandle = {}, bySession = {}, byType = {}, byHtf = {}, byStructure = {};
  src.forEach(t => {
    const add = (obj, key) => {
      if (!key) return;
      if (!obj[key]) obj[key] = { total: 0, wins: 0 };
      obj[key].total++;
      if (getTradeOutcome(t) === "Win") obj[key].wins++;
    };
    add(byCandle, t.candlePattern);
    add(bySession, t.session);
    add(byType, t.tradeType);
    add(byHtf, t.htfBias);
    add(byStructure, t.marketStructure);
  });

  // ── Time-of-day x direction heatmap ───────────────────────────────────────
  const heatmap = {};
  for (let h = 0; h < 24; h++) heatmap[h] = { Long: { total: 0, wins: 0 }, Short: { total: 0, wins: 0 } };
  src.forEach(t => {
    const hr = getETHour(t.entryDatetime);
    if (hr === null || !t.direction) return;
    if (!heatmap[hr][t.direction]) heatmap[hr][t.direction] = { total: 0, wins: 0 };
    heatmap[hr][t.direction].total++;
    if (getTradeOutcome(t) === "Win") heatmap[hr][t.direction].wins++;
  });

  // ── Equity curve (cumulative points over time) ────────────────────────────
  const sorted = [...logicalTrades].sort(
 (a,b)=>a.entryDatetime<b.entryDatetime?-1:1
);
  let cum = 0;
  const equity = sorted.map(t => {
    cum += parseFloat(t.points) || 0;
    return { pts: parseFloat(cum.toFixed(1)), outcome: t.outcome };
  });

  // ── Gain % — Actual account growth ────────────────────────────────────────
// Calculates ROI from realized P/L instead of assuming fixed win/loss %

const STARTING_BALANCE = 50000; // TopstepX 50K account

const totalPnL = src.reduce((sum, t) => {
  return sum + ((parseFloat(t.points) || 0) * 10);
}, 0);

const gainPct = ((totalPnL / STARTING_BALANCE) * 100).toFixed(2);

  // ── Monthly breakdown ──────────────────────────────────────────────────────
  const byMonth = {};
  logicalTrades.forEach(t => {
    const mo = t.entryDatetime?.slice(0, 7);
    if (!mo) return;
    if (!byMonth[mo]) byMonth[mo] = { wins: 0, losses: 0, points: 0 };
    if (getTradeOutcome(t) === "Win") byMonth[mo].wins++;
    else if (getTradeOutcome(t) === "Loss") byMonth[mo].losses++;
    byMonth[mo].points += parseFloat(t.points) || 0;
  });
  const monthlyData = Object.entries(byMonth)
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([mo, d]) => {
    const monthlyPnL = d.points * 10; // Convert points to dollars
    const monthlyGainPct = ((monthlyPnL / STARTING_BALANCE) * 100).toFixed(2);

    return {
      mo,
      ...d,
      total: d.wins + d.losses,
      wr: d.wins + d.losses
        ? ((d.wins / (d.wins + d.losses)) * 100).toFixed(0)
        : 0,
      gainPct: monthlyGainPct,
      points: d.points.toFixed(1),
    };
  });

  // ── Setup grade vs execution grade matrix ──────────────────────────────────
  const setupVsExec = { AA: 0, AB: 0, BA: 0, BB: 0, other: 0 };
  src.forEach(t => {
    const key = (t.grade || "U") + (t.executionGrade || "U");
    if (key === "AA") setupVsExec.AA++;
    else if (key === "AB" || key === "AC") setupVsExec.AB++;
    else if (key === "BA" || key === "CA") setupVsExec.BA++;
    else if (key === "BB") setupVsExec.BB++;
    else setupVsExec.other++;
  });

return {
  wins: wins.length, losses: losses.length, winRate, avgRRR, avgPoints, totalPoints, totalPnL: totalPnL.toFixed(2), gainPct, expectancy, avgMAE,
    byGrade, byExecGrade, byCandle, bySession, byType, byHtf, byStructure,
    heatmap, equity, setupVsExec, monthlyData,
  };
}

/**
 * Computes win/loss streaks with weekly reset (stop-week rule).
 * curLoss resets every Monday. curWin never resets on week boundary.
 * maxLoss/maxWin track all-time consecutive streaks ignoring week resets.
 * @param {Array} trades - full (unfiltered) trade array
 */
/**
 * Collapses scaled-in positions (multiple trade rows opened/closed
 * together — e.g. from Multi-Position batch entry, or TopstepX fills that
 * pair one open+close per contract even when several contracts were
 * bought/sold in the same order) into single "logical trades" for streak
 * counting. Two trade rows are considered the same logical trade only if
 * BOTH their entry times and exit times fall within GROUP_WINDOW_MIN of
 * each other — a trade taken hours later or on a different day always
 * starts a new group, which is what actually defines a separate trading
 * decision versus one decision executed across multiple fills.
 *
 * The combined outcome is Win if the summed points are positive, Loss if
 * negative, Breakeven if exactly zero — this matches how a trader would
 * describe "that trade" when they scaled into 2-3 contracts at once.
 */
const GROUP_WINDOW_MIN = 5;

function parseTradeDateTime(dt) {
  if (!dt || !dt.includes("T")) return null;

  const [datePart, timePart] = dt.split("T");

  const [y, m, d] = datePart.split("-").map(Number);

  const [h, min, sec = 0] = timePart.split(":").map(Number);

  return Date.UTC(y, m - 1, d, h, min, sec);
}

export function groupIntoLogicalTrades(trades) {
  const withTimes = trades.filter(t => t.entryDatetime && t.exitDatetime);
  const sorted = [...withTimes].sort((a, b) => (a.entryDatetime < b.entryDatetime ? -1 : 1));

  const toMinutes = (dt) => {
    // Pure string parse, no Date-object timezone risk — see helpers.js header.
    if (!dt || !dt.includes("T")) return null;
    const [datePart, timePart] = dt.split("T");
    const [y, mo, d] = datePart.split("-").map(Number);
    const [h, mi] = timePart.split(":").map(Number);
    // Days since epoch * 1440 + minutes — good enough for a proximity window,
    // doesn't need to be a real timestamp, just monotonic and comparable.
    const daysSinceEpoch = Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
    return daysSinceEpoch * 1440 + h * 60 + mi;
  };

  const groups = [];
  for (const t of sorted) {
    const entryMin = toMinutes(t.entryDatetime);
    const exitMin = toMinutes(t.exitDatetime);
    const last = groups[groups.length - 1];

    const sameGroup = last &&
      entryMin !== null && exitMin !== null &&
      last.entryMin !== null && last.exitMin !== null &&
      Math.abs(entryMin - last.entryMin) <= GROUP_WINDOW_MIN &&
      Math.abs(exitMin - last.exitMin) <= GROUP_WINDOW_MIN;

    if (sameGroup) {
      last.trades.push(t);
      last.totalPoints += parseFloat(t.points) || 0;
      // Keep group's representative entry/exit as the earliest/latest so a
      // 3rd fill still compares against the group's original window, not
      // just the previous fill (prevents window "creep" across many fills).
      last.entryMin = Math.min(last.entryMin, entryMin);
      last.exitMin = Math.max(last.exitMin, exitMin);
    } else {
      groups.push({
        trades: [t],
        totalPoints: parseFloat(t.points) || 0,
        entryMin, exitMin,
        entryDatetime: t.entryDatetime,
      });
    }
  }

  return groups.map(g => ({
    entryDatetime: g.entryDatetime,
    outcome: g.totalPoints > 0 ? "Win" : g.totalPoints < 0 ? "Loss" : "Breakeven",
    points: g.totalPoints,
    tradeCount: g.trades.length,
  }));
}

export function computeStreaks(trades) {
  // Streaks are counted per logical trade, not per fill/row — a scaled
  // position closed all at once is one win or one loss, not several.
  const sorted = groupIntoLogicalTrades(trades);

  // Pass 1: curLoss / curWin with weekly reset — current streak + stop-week warning
  let curWin = 0, curLoss = 0, prevWeek = null;
  sorted.forEach(t => {
    const week = getWeekStartKey(t.entryDatetime);
    if (week && week !== prevWeek) { curLoss = 0; prevWeek = week; }
    if (getTradeOutcome(t) === "Win") { curWin++; curLoss = 0; }
    else if (getTradeOutcome(t) === "Loss") { curLoss++; curWin = 0; }
    else { curWin = 0; curLoss = 0; }
  });

  // Pass 2: maxWin / maxLoss — purely consecutive, no week resets
  let maxWin = 0, maxLoss = 0, rawWin = 0, rawLoss = 0;
  sorted.forEach(t => {
    if (getTradeOutcome(t) === "Win") { rawWin++; rawLoss = 0; maxWin = Math.max(maxWin, rawWin); }
    else if (getTradeOutcome(t) === "Loss") { rawLoss++; rawWin = 0; maxLoss = Math.max(maxLoss, rawLoss); }
    else { rawWin = 0; rawLoss = 0; }
  });

  return { curWin, curLoss, maxWin, maxLoss };
}

/**
 * Computes drawdown from peak equity (in dollars, using points * $10 for MGC).
 */
export function computeDrawdown(trades) {
  const logicalTrades = groupIntoLogicalTrades(trades);

  const sorted = [...logicalTrades].sort((a, b) =>
    a.entryDatetime < b.entryDatetime ? -1 : 1
  );

  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  let curDD = 0;

  sorted.forEach(t => {
    cum += (parseFloat(t.points) || 0) * 10;

    peak = Math.max(peak, cum);
    curDD = peak - cum;
    maxDD = Math.max(maxDD, curDD);
  });

  return {
    current: curDD,
    max: maxDD,
    peak,
  };
}
/**
 * Today's session P&L in dollars.
 */
export function computeTodayPnL(trades) {
  const now = new Date();

  // Convert current time to Eastern Time
  const etToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return trades
    .filter(t => t.entryDatetime?.slice(0, 10) === etToday)
    .reduce((sum, t) => sum + (parseFloat(t.points) || 0) * 10, 0);
}
/**
 * Builds the calendar day -> {pnl, trades, wins} map used by the
 * TradingCalendar component. Works across the full trade history.
 */
export function computeDayMap(trades) {
  const logicalTrades = groupIntoLogicalTrades(trades);
  const dayMap = {};

  logicalTrades.forEach(t => {
    if (!t.entryDatetime) return;

    const day = t.entryDatetime.slice(0, 10);

    if (!dayMap[day]) {
      dayMap[day] = {
        pnl: 0,
        trades: 0,
        wins: 0,
      };
    }

    dayMap[day].pnl += (parseFloat(t.points) || 0) * 10;
    dayMap[day].trades++;

    if (t.outcome === "Win") {
      dayMap[day].wins++;
    }
  });

  return dayMap;
}
  
/**
 * TopstepX payout eligibility: at least MIN_QUALIFYING_DAYS separate
 * trading days each with net P&L >= MIN_DAILY_PROFIT. Uses the same
 * computeDayMap this function is built on, so "a day" always means the
 * same thing as it does on the Trading Calendar — one calendar date's net
 * dollars across all trades logged that day, regardless of how many fills
 * or logical trades made it up.
 *
 * Returns the qualifying days (sorted oldest-first, so the trader can see
 * exactly which days counted), how many more qualifying days are needed,
 * and whether the requirement is currently met.
 */
const MIN_DAILY_PROFIT = 150;
const MIN_QUALIFYING_DAYS = 5;
export function computeMonthlySummary(trades) {
  const months = {};

  trades.forEach(t => {
    if (!t.entryDatetime) return;

    const key = t.entryDatetime.slice(0, 7);

    if (!months[key]) {
      months[key] = {
        pnl: 0,
        wins: 0,
        losses: 0,
        trades: 0,
      };
    }

    const pnl = (parseFloat(t.points) || 0) * 10;

    months[key].pnl += pnl;
    months[key].trades++;

    if (getTradeOutcome(t) === "Win") months[key].wins++;
    else if (getTradeOutcome(t) === "Loss") months[key].losses++;
  });

  return months;
}

export function computePayoutEligibility(
  trades,
  {
    minDailyProfit = MIN_DAILY_PROFIT,
    minQualifyingDays = MIN_QUALIFYING_DAYS,
  } = {}
) {
  const dayMap = computeDayMap(trades);

  const qualifyingDays = Object.entries(dayMap)
    .filter(([, d]) => {
  const pnl = Math.round(d.pnl * 100) / 100;
  return pnl >= minDailyProfit;
})
   .map(([date, d]) => ({
  date,
  pnl: Math.round(d.pnl * 100) / 100,
  trades: d.trades,
}))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    qualifyingDays,
    qualifyingDayCount: qualifyingDays.length,
    minQualifyingDays,
    minDailyProfit,
    daysRemaining: Math.max(
      0,
      minQualifyingDays - qualifyingDays.length
    ),
    eligible: qualifyingDays.length >= minQualifyingDays,
  };
}

// ─── Phase 2 additions ────────────────────────────────────────────────────

/**
 * Profit Factor = gross profit / gross loss. > 1 means profitable overall.
 * A value of 2.0 means you make $2 for every $1 lost. Returns null if
 * there are no losing trades (undefined/infinite ratio).
 */
export function computeProfitFactor(trades) {
  const logicalTrades = groupIntoLogicalTrades(trades);

  const grossProfit = logicalTrades
    .filter(t => (parseFloat(t.points) || 0) > 0)
    .reduce((sum, t) => sum + (parseFloat(t.points) || 0) * 10, 0);

  const grossLoss = Math.abs(
    logicalTrades
      .filter(t => (parseFloat(t.points) || 0) < 0)
      .reduce((sum, t) => sum + (parseFloat(t.points) || 0) * 10, 0)
  );

  if (grossLoss === 0) {
    return grossProfit > 0 ? null : 0;
  }

  return grossProfit / grossLoss;
}

/**
 * Average winner / average loser in dollars, plus largest single win/loss.
 * These are the numbers Tradervue/Edgewonk show on every dashboard.
 */
export function computeWinLossExtremes(trades) {
  const logicalTrades = groupIntoLogicalTrades(trades);

  const wins = logicalTrades
    .filter(t => t.outcome === "Win")
    .map(t => (parseFloat(t.points) || 0) * 10);

  const losses = logicalTrades
    .filter(t => t.outcome === "Loss")
    .map(t => (parseFloat(t.points) || 0) * 10);

  const avgWinner = wins.length
    ? wins.reduce((a, b) => a + b, 0) / wins.length
    : 0;

  const avgLoser = losses.length
    ? losses.reduce((a, b) => a + b, 0) / losses.length
    : 0;

  const largestWin = wins.length ? Math.max(...wins) : 0;
  const largestLoss = losses.length ? Math.min(...losses) : 0;

  return {
    avgWinner,
    avgLoser,
    largestWin,
    largestLoss,
  };
}

/**
 * Rolling win rate over the trailing N trades, computed at every point in
 * the trade sequence. Used for the Win Rate Trend chart — reveals whether
 * the edge is improving, flat, or decaying over time (a single overall
 * win rate number hides this).
 */
export function computeWinRateTrend(trades, windowSize = 20) {
  const sorted = [...trades].sort((a, b) => (a.entryDatetime < b.entryDatetime ? -1 : 1));
  const points = [];
  for (let i = 0; i < sorted.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1);
    const window = sorted.slice(windowStart, i + 1);
    const wins = window.filter(t => getTradeOutcome(t) === "Win").length;
    points.push({
      index: i,
      winRate: (wins / window.length) * 100,
      date: sorted[i].entryDatetime,
    });
  }
  return points;
}

/**
 * Daily P&L series for the Daily P&L bar chart (distinct from the
 * calendar — this is a scrollable/zoomable bar chart of every trading day
 * in sequence, useful for spotting consistency over time).
 */
export function computeWeeklyPnLSeries(trades) {
  const byWeek = {};

  // Count logical trades instead of individual fills
  const logicalTrades = groupIntoLogicalTrades(trades);

  logicalTrades.forEach(t => {
    if (!t.entryDatetime || !t.entryDatetime.includes("T")) return;

    const wk = getWeekStartKey(t.entryDatetime);

    if (!byWeek[wk]) {
      byWeek[wk] = {
        pnl: 0,
        trades: 0,
        wins: 0,
      };
    }

    byWeek[wk].pnl += (parseFloat(t.points) || 0) * 10;
    byWeek[wk].trades += 1;

    if (t.outcome === "Win") {
      byWeek[wk].wins += 1;
    }
  });

  return Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, d]) => ({
      weekStart,
      ...d,
    }));
}
  return Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, d]) => ({ weekStart, ...d }));
}

/**
 * Best and worst single trading day by net P&L. Used in the Trading
 * Calendar header and the Performance Dashboard summary cards.
 */


// ─── Phase 3 additions — Professional Statistics ──────────────────────────
// Weekday, hour-of-day (standalone), long/short, news impact, MAE/MFE
// distributions, and hold-time bucket breakdowns. All follow the same
// { total, wins } accumulator shape as byGrade/bySession/etc. in
// computeStats so they render with the existing BarRow component without
// any new UI plumbing.

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Win rate by day of week. Uses the ET-normalized entry date already
 * stored on the trade (entryDatetime is saved as local ET time, see
 * db.js toET conversion in the sync pipeline) so this lines up with the
 * session/hour logic elsewhere rather than drifting on browser timezone.
 */
export function computeByWeekday(trades) {
  const byDay = {};
  WEEKDAY_NAMES.forEach(d => { byDay[d] = { total: 0, wins: 0 }; });
  trades.forEach(t => {
    if (!t.entryDatetime || !t.entryDatetime.includes("T")) return;
    // Parse Y/M/D as plain integers and compute weekday with Date.UTC —
    // this is deterministic regardless of the browser's local timezone,
    // unlike `new Date(entryDatetime)` which applies local-tz interpretation
    // to timestamp strings with no timezone suffix (see helpers.js header).
    const [datePart] = t.entryDatetime.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const dayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const dayName = WEEKDAY_NAMES[dayIndex];
    byDay[dayName].total++;
    if (getTradeOutcome(t) === "Win") byDay[dayName].wins++;
  });
  // Only return days that actually have trades, Mon-Fri only (GC doesn't
  // trade Saturday — Sunday overnight session is still shown since that's
  // a real trading window even though the calendar date reads "Sunday").
  const orderedDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const result = {};
  orderedDays.forEach(d => { if (byDay[d].total > 0) result[d] = byDay[d]; });
  return result;
}

/**
 * Win rate by entry hour (ET), standalone from direction — a simpler
 * complement to the existing heatmap (which splits by Long/Short). Useful
 * for a single bar-row view of "what hour do I trade best" without having
 * to mentally combine two heatmap rows.
 */
export function computeByHour(trades) {
  const byHour = {};
  trades.forEach(t => {
    const hr = getETHour(t.entryDatetime);
    if (hr === null) return;
    const key = `${hr.toString().padStart(2, "0")}:00`;
    if (!byHour[key]) byHour[key] = { total: 0, wins: 0 };
    byHour[key].total++;
    if (getTradeOutcome(t) === "Win") byHour[key].wins++;
  });
  return byHour;
}

/**
 * Long vs Short win rate — a dedicated summary distinct from the raw
 * `direction` field on each trade. Also includes average points per side,
 * since a direction can have a fine win rate but poor average size (or
 * vice versa) and that's easy to miss with win rate alone.
 */
export function computeByDirection(trades) {
  const result = { Long: { total: 0, wins: 0, points: 0 }, Short: { total: 0, wins: 0, points: 0 } };
  trades.forEach(t => {
    if (!t.direction || !result[t.direction]) return;
    result[t.direction].total++;
    if (getTradeOutcome(t) === "Win") result[t.direction].wins++;
    result[t.direction].points += parseFloat(t.points) || 0;
  });
  return result;
}

/**
 * Win rate broken down by news proximity. `news === "None"` trades are
 * grouped separately from named events; named events are further split by
 * impact level, since a High-impact CPI print and a Low-impact data
 * release are very different risk contexts even though both count as
 * "news was nearby" in the raw trade record.
 */
export function computeByNewsImpact(trades) {
  const result = {};
  trades.forEach(t => {
    const key = (!t.news || t.news === "None") ? "No News Nearby" : `${t.news} (${t.newsImpact || "Low"})`;
    if (!result[key]) result[key] = { total: 0, wins: 0 };
    result[key].total++;
    if (getTradeOutcome(t) === "Win") result[key].wins++;
  });
  return result;
}

/**
 * MAE / MFE distributions, split by outcome (win vs loss), matching the
 * interpretation guide already written into the Rules tab (see
 * rulesData.js "MAE — Max Adverse Excursion" section, rules m3-m6):
 * low MAE-on-wins = precise entries, MAE-on-losses close to stop size =
 * normal, etc. This function just supplies the numbers that guide
 * references — it does not duplicate that explanatory text.
 */
export function computeExcursionStats(trades) {
  const withMAE = trades.filter(t => t.mae !== undefined && t.mae !== null && t.mae !== "");
  const withMFE = trades.filter(t => t.mfe !== undefined && t.mfe !== null && t.mfe !== "");

  const avg = (arr, key) => (arr.length ? arr.reduce((s, t) => s + parseFloat(t[key]), 0) / arr.length : null);

  const maeWins = withMAE.filter(t => getTradeOutcome(t) === "Win");
  const maeLosses = withMAE.filter(t => getTradeOutcome(t) === "Loss");
  const mfeWins = withMFE.filter(t => getTradeOutcome(t) === "Win");
  const mfeLosses = withMFE.filter(t => getTradeOutcome(t) === "Loss");

  return {
    sampleSize: { mae: withMAE.length, mfe: withMFE.length },
    avgMAEWins: avg(maeWins, "mae"),
    avgMAELosses: avg(maeLosses, "mae"),
    avgMFEWins: avg(mfeWins, "mfe"),
    avgMFELosses: avg(mfeLosses, "mfe"),
  };
}

/**
 * Buckets trades by hold time (entry -> exit) and reports win rate per
 * bucket. Mirrors the bucket boundaries TopstepX itself uses in its Trade
 * Duration Analysis widget (see screenshots from the TopstepX dashboard:
 * Under 15s / 15-45s / 45s-1m / 1-2m / 2-5m / 5-10m / 10-30m / 30m-1h /
 * 1-2h / 2-4h / 4h+) so a trader comparing the two views sees the same
 * categories.
 */
const HOLD_TIME_BUCKETS = [
  { label: "Under 15 sec", maxMs: 15 * 1000 },
  { label: "15-45 sec", maxMs: 45 * 1000 },
  { label: "45 sec - 1 min", maxMs: 60 * 1000 },
  { label: "1 min - 2 min", maxMs: 2 * 60 * 1000 },
  { label: "2 min - 5 min", maxMs: 5 * 60 * 1000 },
  { label: "5 min - 10 min", maxMs: 10 * 60 * 1000 },
  { label: "10 min - 30 min", maxMs: 30 * 60 * 1000 },
  { label: "30 min - 1 hour", maxMs: 60 * 60 * 1000 },
  { label: "1 hour - 2 hours", maxMs: 2 * 60 * 60 * 1000 },
  { label: "2 hours - 4 hours", maxMs: 4 * 60 * 60 * 1000 },
  { label: "4 hours and up", maxMs: Infinity },
];

export function computeByHoldTime(trades) {
  const result = {};

  // Initialize all buckets
  HOLD_TIME_BUCKETS.forEach(bucket => {
    result[bucket.label] = {
      total: 0,
      wins: 0,
    };
  });

  trades.forEach(trade => {
    if (!trade.entryDatetime || !trade.exitDatetime) return;

    const entry = parseTradeDateTime(trade.entryDatetime);
    const exit = parseTradeDateTime(trade.exitDatetime);

    if (entry === null || exit === null) return;

    const diffMs = exit - entry;

    // Ignore invalid or negative durations
    if (!Number.isFinite(diffMs) || diffMs <= 0) return;

    const bucket = HOLD_TIME_BUCKETS.find(
      bucket => diffMs <= bucket.maxMs
    );

    if (!bucket) return;

    result[bucket.label].total++;

    if (getTradeOutcome(trade) === "Win") {
      result[bucket.label].wins++;
    }
  });

  // Remove empty buckets while preserving display order
  const filtered = {};

  HOLD_TIME_BUCKETS.forEach(bucket => {
    if (result[bucket.label].total > 0) {
      filtered[bucket.label] = result[bucket.label];
    }
  });

  return filtered;
}