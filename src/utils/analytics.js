// ─── Analytics Calculation Engine ───────────────────────────────────────────
// Pure functions that take a trade array and return derived statistics.
// No React, no state — safe to unit test and reuse (e.g. in AI Coach, PDF
// reports, or a future backend).

import { GRADES } from "./constants.js";
import { getETHour } from "./helpers.js";

/**
 * Computes the full analytics bundle for the Analytics tab.
 * @param {Array} src - filtered trade array (by mode/month)
 * @returns {Object|null} stats bundle, or null if src is empty
 */
export function computeStats(src) {
  if (!src.length) return null;

  const wins = src.filter(t => t.outcome === "Win");
  const losses = src.filter(t => t.outcome === "Loss");
  const winRate = ((wins.length / src.length) * 100).toFixed(1);

  const avgRRR = wins.length
    ? (wins.reduce((a, t) => a + (parseFloat(t.rrr) || 0), 0) / wins.length).toFixed(2)
    : "0.00";

  const winRate01 = wins.length / src.length;
  const expectancy = ((winRate01 * 2) - ((1 - winRate01) * 1)).toFixed(2); // R per trade

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
    byGrade[g] = { total: gt.length, wins: gt.filter(t => t.outcome === "Win").length };
  });

  const byExecGrade = {};
  GRADES.forEach(g => {
    const gt = src.filter(t => t.executionGrade === g);
    byExecGrade[g] = { total: gt.length, wins: gt.filter(t => t.outcome === "Win").length };
  });

  // ── Category breakdowns (candle pattern, session, type, HTF bias, structure) ─
  const byCandle = {}, bySession = {}, byType = {}, byHtf = {}, byStructure = {};
  src.forEach(t => {
    const add = (obj, key) => {
      if (!key) return;
      if (!obj[key]) obj[key] = { total: 0, wins: 0 };
      obj[key].total++;
      if (t.outcome === "Win") obj[key].wins++;
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
    if (t.outcome === "Win") heatmap[hr][t.direction].wins++;
  });

  // ── Equity curve (cumulative points over time) ────────────────────────────
  const sorted = [...src].sort((a, b) => (a.entryDatetime < b.entryDatetime ? -1 : 1));
  let cum = 0;
  const equity = sorted.map(t => {
    cum += parseFloat(t.points) || 0;
    return { pts: parseFloat(cum.toFixed(1)), outcome: t.outcome };
  });

  // ── Gain % — fixed 1% risk system: +2% per win, -1% per loss ──────────────
  const gainPct = (wins.length * 2 - losses.length * 1).toFixed(1);

  // ── Monthly breakdown ──────────────────────────────────────────────────────
  const byMonth = {};
  src.forEach(t => {
    const mo = t.entryDatetime?.slice(0, 7);
    if (!mo) return;
    if (!byMonth[mo]) byMonth[mo] = { wins: 0, losses: 0, points: 0 };
    if (t.outcome === "Win") byMonth[mo].wins++;
    else if (t.outcome === "Loss") byMonth[mo].losses++;
    byMonth[mo].points += parseFloat(t.points) || 0;
  });
  const monthlyData = Object.entries(byMonth)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([mo, d]) => ({
      mo, ...d,
      total: d.wins + d.losses,
      wr: d.wins + d.losses ? ((d.wins / (d.wins + d.losses)) * 100).toFixed(0) : 0,
      gainPct: (d.wins * 2 - d.losses * 1).toFixed(1),
      points: d.points.toFixed(1),
    }));

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
    wins: wins.length, losses: losses.length, winRate, avgRRR, avgPoints,
    totalPoints, gainPct, expectancy, avgMAE,
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
export function computeStreaks(trades) {
  const getWeekKey = (dt) => {
    if (!dt) return "";
    const d = new Date(dt);
    const day = d.getUTCDay() || 7; // Mon=1 ... Sun=7
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  };

  const sorted = [...trades].sort((a, b) => (a.entryDatetime < b.entryDatetime ? -1 : 1));

  // Pass 1: curLoss / curWin with weekly reset — current streak + stop-week warning
  let curWin = 0, curLoss = 0, prevWeek = null;
  sorted.forEach(t => {
    const week = getWeekKey(t.entryDatetime);
    if (week && week !== prevWeek) { curLoss = 0; prevWeek = week; }
    if (t.outcome === "Win") { curWin++; curLoss = 0; }
    else if (t.outcome === "Loss") { curLoss++; curWin = 0; }
    else { curWin = 0; curLoss = 0; }
  });

  // Pass 2: maxWin / maxLoss — purely consecutive, no week resets
  let maxWin = 0, maxLoss = 0, rawWin = 0, rawLoss = 0;
  sorted.forEach(t => {
    if (t.outcome === "Win") { rawWin++; rawLoss = 0; maxWin = Math.max(maxWin, rawWin); }
    else if (t.outcome === "Loss") { rawLoss++; rawWin = 0; maxLoss = Math.max(maxLoss, rawLoss); }
    else { rawWin = 0; rawLoss = 0; }
  });

  return { curWin, curLoss, maxWin, maxLoss };
}

/**
 * Computes drawdown from peak equity (in dollars, using points * $10 for MGC).
 */
export function computeDrawdown(trades) {
  const sorted = [...trades].sort((a, b) => (a.entryDatetime < b.entryDatetime ? -1 : 1));
  let cum = 0, peak = 0, maxDD = 0, curDD = 0;
  sorted.forEach(t => {
    cum += (parseFloat(t.points) || 0) * 10;
    peak = Math.max(peak, cum);
    curDD = peak - cum;
    maxDD = Math.max(maxDD, curDD);
  });
  return { current: curDD, max: maxDD, peak };
}

/**
 * Today's session P&L in dollars.
 */
export function computeTodayPnL(trades) {
  const today = new Date().toISOString().slice(0, 10);
  return trades
    .filter(t => t.entryDatetime?.slice(0, 10) === today)
    .reduce((s, t) => s + (parseFloat(t.points) || 0) * 10, 0);
}

/**
 * Builds the calendar day -> {pnl, trades, wins} map used by the
 * TradingCalendar component. Works across the full trade history.
 */
export function computeDayMap(trades) {
  const dayMap = {};
  trades.forEach(t => {
    if (!t.entryDatetime) return;
    const d = t.entryDatetime.slice(0, 10);
    if (!dayMap[d]) dayMap[d] = { pnl: 0, trades: 0, wins: 0 };
    dayMap[d].pnl += (parseFloat(t.points) || 0) * 10;
    dayMap[d].trades += 1;
    if (t.outcome === "Win") dayMap[d].wins += 1;
  });
  return dayMap;
}

// ─── Phase 2 additions ────────────────────────────────────────────────────

/**
 * Profit Factor = gross profit / gross loss. > 1 means profitable overall.
 * A value of 2.0 means you make $2 for every $1 lost. Returns null if
 * there are no losing trades (undefined/infinite ratio).
 */
export function computeProfitFactor(trades) {
  const grossProfit = trades
    .filter(t => parseFloat(t.points) > 0)
    .reduce((s, t) => s + parseFloat(t.points) * 10, 0);
  const grossLoss = Math.abs(
    trades.filter(t => parseFloat(t.points) < 0).reduce((s, t) => s + parseFloat(t.points) * 10, 0)
  );
  if (grossLoss === 0) return grossProfit > 0 ? null : 0; // null = undefined (no losses yet)
  return grossProfit / grossLoss;
}

/**
 * Average winner / average loser in dollars, plus largest single win/loss.
 * These are the numbers Tradervue/Edgewonk show on every dashboard.
 */
export function computeWinLossExtremes(trades) {
  const wins = trades.filter(t => t.outcome === "Win").map(t => (parseFloat(t.points) || 0) * 10);
  const losses = trades.filter(t => t.outcome === "Loss").map(t => (parseFloat(t.points) || 0) * 10);

  const avgWinner = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoser = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const largestWin = wins.length ? Math.max(...wins) : 0;
  const largestLoss = losses.length ? Math.min(...losses) : 0; // most negative

  return { avgWinner, avgLoser, largestWin, largestLoss };
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
    const wins = window.filter(t => t.outcome === "Win").length;
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
export function computeDailyPnLSeries(trades) {
  const dayMap = computeDayMap(trades);
  return Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({ date, pnl: d.pnl, trades: d.trades, wins: d.wins }));
}

/**
 * Weekly P&L series — groups trades by ISO week (Monday start), matching
 * the same week-boundary logic used by computeStreaks for the stop-week
 * rule, so "this week" means the same thing everywhere in the app.
 */
export function computeWeeklyPnLSeries(trades) {
  const getWeekKey = (dt) => {
    const d = new Date(dt);
    const day = d.getUTCDay() || 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  };

  const byWeek = {};
  trades.forEach(t => {
    if (!t.entryDatetime) return;
    const wk = getWeekKey(t.entryDatetime);
    if (!byWeek[wk]) byWeek[wk] = { pnl: 0, trades: 0, wins: 0 };
    byWeek[wk].pnl += (parseFloat(t.points) || 0) * 10;
    byWeek[wk].trades += 1;
    if (t.outcome === "Win") byWeek[wk].wins += 1;
  });

  return Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, d]) => ({ weekStart, ...d }));
}

/**
 * Best and worst single trading day by net P&L. Used in the Trading
 * Calendar header and the Performance Dashboard summary cards.
 */
export function computeBestWorstDay(trades) {
  const dayMap = computeDayMap(trades);
  const entries = Object.entries(dayMap);
  if (!entries.length) return { best: null, worst: null };

  const best = entries.reduce((a, b) => (b[1].pnl > a[1].pnl ? b : a));
  const worst = entries.reduce((a, b) => (b[1].pnl < a[1].pnl ? b : a));

  return {
    best: { date: best[0], ...best[1] },
    worst: { date: worst[0], ...worst[1] },
  };
}
