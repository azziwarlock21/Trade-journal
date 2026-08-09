// ─── AI Coach — Trading Edge Report ─────────────────────────────────────
// Full-history AI synthesis: reuses every existing analytics.js
// calculation (win rate, profit factor, weekday/hour/direction/news/
// hold-time breakdowns, MAE/MFE excursion stats) plus the deterministic
// pattern findings from coachAnalysis.js, formats them into a compact
// numeric brief, and asks Claude to synthesize a single actionable
// "trading edge" — not to redo the arithmetic itself (that's already done
// correctly here), but to find the highest-signal combination of
// conditions and turn it into a followable rule set.

import {
  computeProfitFactor, computeWinLossExtremes,
  computeByWeekday, computeByHour, computeByDirection, computeByNewsImpact,
  computeExcursionStats, computeByHoldTime, groupIntoLogicalTrades,
} from "./analytics.js";
import { runDataAnalysis } from "./coachAnalysis.js";

function pct(w, t) { return t > 0 ? `${((w / t) * 100).toFixed(0)}%` : "--"; }
function num(n, d = 1) { return n === null || n === undefined || isNaN(n) ? "--" : n.toFixed(d); }

function rankedLines(map, minSample = 3) {
  return Object.entries(map)
    .filter(([, d]) => d.total >= minSample)
    .sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total))
    .map(([k, d]) => `  ${k}: ${pct(d.wins, d.total)} win rate (${d.total} trades)`)
    .join("\n") || "  (not enough sample size per bucket yet)";
}

function buildStatsBrief(trades) {
  const logical = groupIntoLogicalTrades(trades);
  const pf = computeProfitFactor(trades);
  const extremes = computeWinLossExtremes(trades);
  const byWeekday = computeByWeekday(trades);
  const byHour = computeByHour(trades);
  const byDirection = computeByDirection(trades);
  const byNews = computeByNewsImpact(trades);
  const excursion = computeExcursionStats(trades);
  const byHoldTime = computeByHoldTime(trades);

  const wins = logical.filter(t => t.outcome === "Win").length;
  const losses = logical.filter(t => t.outcome === "Loss").length;
  const total = logical.length;

  return `
OVERALL (${total} trades)
  Win rate: ${pct(wins, total)} (${wins}W / ${losses}L)
  Profit factor: ${pf === null ? "--" : num(pf, 2)}
  Avg winner: ${num(extremes.avgWinner / 10, 1)}pt | Avg loser: ${num(extremes.avgLoser / 10, 1)}pt
  Largest winner: ${num(extremes.largestWin / 10, 1)}pt | Largest loser: ${num(extremes.largestLoss / 10, 1)}pt

BY DIRECTION
  Long: ${pct(byDirection.Long.wins, byDirection.Long.total)} win rate, ${byDirection.Long.total} trades, ${num(byDirection.Long.points, 1)}pt total
  Short: ${pct(byDirection.Short.wins, byDirection.Short.total)} win rate, ${byDirection.Short.total} trades, ${num(byDirection.Short.points, 1)}pt total

BY WEEKDAY (min 3 trades)
${rankedLines(byWeekday)}

BY ENTRY HOUR — ET (min 3 trades)
${rankedLines(byHour)}

BY NEWS PROXIMITY (min 3 trades)
${rankedLines(byNews)}

BY HOLD TIME (min 3 trades)
${rankedLines(byHoldTime)}

EXCURSION (MAE/MFE, sample: ${excursion.sampleSize.mae} MAE / ${excursion.sampleSize.mfe} MFE)
  Avg MAE on winners: ${num(excursion.avgMAEWins)}pt | Avg MAE on losers: ${num(excursion.avgMAELosses)}pt
  Avg MFE on winners: ${num(excursion.avgMFEWins)}pt | Avg MFE on losers: ${num(excursion.avgMFELosses)}pt
`.trim();
}

function buildFindingsBrief(trades) {
  const findings = runDataAnalysis(trades);
  if (!findings || !findings.length) return "(no pattern findings — not enough trades yet)";
  return findings.map(f => `[${f.type.toUpperCase()}] ${f.title}: ${f.body}`).join("\n");
}

const SYSTEM_PROMPT = `You are a professional trading performance analyst reviewing a futures trader's complete logged history (gold futures, GC/MGC). You are given pre-computed, deterministic statistics — do not recompute or second-guess the arithmetic, trust the numbers given. Your job is synthesis: find the highest-signal combination of conditions (day/hour/direction/hold-time/news context) that separates this trader's winners from losers, and turn that into a precise, followable trading edge.

Be specific and numeric wherever the data supports it — cite the actual win rates and sample sizes given. Do not invent statistics that weren't provided. Where sample size is small, say so explicitly rather than treating it as reliable. Be direct about what's working and what's leaking money; do not soften bad news.`;

function buildUserPrompt(statsBrief, findingsBrief) {
  return `Here is a trader's complete performance data.

=== STATISTICAL SUMMARY ===
${statsBrief}

=== PATTERN-ANALYSIS FINDINGS (already computed) ===
${findingsBrief}

Based on this, write a Trading Edge Report with exactly these sections and no preamble:

1. Core Edge — the single highest-confidence combination of conditions (session/hour/day/direction/setup) where this trader has a genuine statistical edge, with the numbers behind it.
2. Biggest Leak — the specific condition or behavior costing the most money, with numbers.
3. Rules To Follow — a short numbered checklist (4-6 items) of concrete, specific rules derived directly from the data above (e.g. "Only take Long setups between 08:00-10:00 ET" rather than generic advice).
4. Rules To Avoid — a short numbered checklist (2-4 items) of specific conditions to stop trading, or stop doing.
5. Confidence Note — one or two sentences on how much to trust these conclusions given the current sample size, and what would strengthen the read (e.g. "needs 15+ more Short trades before treating this as reliable").`;
}

/**
 * Generates a full-history "Trading Edge" report. Sends only aggregated
 * numbers (never raw per-trade data or images) to keep this fast and cheap
 * regardless of how many trades exist.
 */
export async function generateTradingEdgeReport(trades) {
  const statsBrief = buildStatsBrief(trades);
  const findingsBrief = buildFindingsBrief(trades);
  const prompt = buildUserPrompt(statsBrief, findingsBrief);

  const secret = import.meta.env.VITE_CRON_SECRET || "";
  const res = await fetch(`${window.location.origin}/api/ai-coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1800,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Trading edge analysis failed");
  return data.text;
}
