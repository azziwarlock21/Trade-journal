// ─── AI Coach — Trading Edge Report (Gemini) ─────────────────────────────
// Sends completed trades (one entry per paired position, never raw
// TopstepX fills) + deterministic stats to api/analyze-trades.js, which
// calls Gemini server-side. The Gemini key never touches the browser.
//
// Every statistic here comes from the project's existing analytics.js —
// the same functions Analytics/PerformanceDashboard/ProfessionalStats
// already use — so Gemini is reasoning over numbers this app already
// trusts, not being asked to redo the arithmetic itself.

import {
  groupIntoLogicalTrades, computeStats, computeProfitFactor,
  computeWinLossExtremes, computeDrawdown, computeDailyPnLSeries,
  computeWeeklyPnLSeries, computeByDirection, computeByWeekday,
  computeByHour, computeByNewsImpact, computeExcursionStats, computeByHoldTime,
} from "./analytics.js";

function buildCalculatedStats(trades) {
  const logical = groupIntoLogicalTrades(trades);
  const stats = computeStats(trades) || {};
  const pf = computeProfitFactor(trades);
  const extremes = computeWinLossExtremes(trades);
  const dd = computeDrawdown(trades);

  const wins = logical.filter(t => t.outcome === "Win").length;
  const losses = logical.filter(t => t.outcome === "Loss").length;
  const breakevens = logical.filter(t => t.outcome === "Breakeven").length;

  return {
    totalTrades: logical.length,
    wins, losses, breakevens,
    winRate: stats.winRate ? `${stats.winRate}%` : null,
    profitFactor: pf === null ? null : Number(pf.toFixed(2)),
    expectancyR: stats.expectancy ?? null, // fixed-R expectancy (existing app convention, not $ expectancy)
    averageWinner: extremes.avgWinner,
    averageLoser: extremes.avgLoser,
    largestWin: extremes.largestWin,
    largestLoss: extremes.largestLoss,
    maxDrawdown: dd.max,
    totalPnL: stats.totalPnL,
    gainPct: stats.gainPct,
    avgMAE: stats.avgMAE,
    dailyPnL: computeDailyPnLSeries(trades),
    weeklyPnL: computeWeeklyPnLSeries(trades),
    sessionStats: stats.bySession,
    directionStats: computeByDirection(trades),
    tradeTypeStats: stats.byType,
    htfBiasStats: stats.byHtf,
    marketStructureStats: stats.byStructure,
    candlePatternStats: stats.byCandle,
    executionGradeStats: stats.byExecGrade,
    weekdayStats: computeByWeekday(trades),
    hourStats: computeByHour(trades),
    newsImpactStats: computeByNewsImpact(trades),
    holdTimeStats: computeByHoldTime(trades),
    excursionStats: computeExcursionStats(trades),
  };
}

// One completed position = one analytical trade (never raw fills), and
// strips anything that isn't relevant to statistical analysis — screenshot
// data URLs and generated chart URLs would just burn tokens for no
// analytical value and could be large.
function sanitizeTrade(t) {
  const {
    screenshots, generatedCharts, screenshotsLoaded,
    _autoMaeMfeError, _autoChartError,
    ...rest
  } = t;
  return rest;
}

/**
 * Generates a full-history "Trading Edge" report via Gemini
 * (api/analyze-trades.js). `trades` is the raw trade list from state —
 * this groups into completed positions and sanitizes internally.
 */
export async function generateTradingEdgeReport(trades) {
  const completedTrades = groupIntoLogicalTrades(trades).map(sanitizeTrade);
  const calculatedStats = buildCalculatedStats(trades);

  const secret = (import.meta.env.VITE_CRON_SECRET || "").trim();
  const res = await fetch(`${window.location.origin}/api/analyze-trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({ trades: completedTrades, stats: calculatedStats }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI analysis failed");
  return data.analysis;
}
