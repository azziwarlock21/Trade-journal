// ─── AI Coach — Per-Trade Review (OpenAI) ────────────────────────────────
// Sends a single trade's data (+ screenshots, if present) to OpenAI, via
// api/analyze-trade-review.js, for a structured coaching review. Separate
// from coachAnalysis.js since this one costs API tokens and requires
// network access.

function buildTradeContext(trade) {
  return [
    `Direction: ${trade.direction || "—"}`,
    `Trade Type: ${trade.tradeType || "—"}`,
    `HTF Bias: ${trade.htfBias || "—"}`,
    `Market Structure: ${trade.marketStructure || "—"}`,
    `Session: ${trade.session || "—"}`,
    `Candle Pattern: ${trade.candlePattern || "—"}`,
    `Wick Direction: ${trade.wickDirection || "—"}`,
    `Entry: ${trade.entryPrice || "—"} | SL: ${trade.stopLoss || "—"} | TP: ${trade.takeProfit || "—"}`,
    `Points: ${trade.points || "—"} | RRR: ${trade.rrr || "—"} | MAE: ${trade.mae || "not logged"}`,
    `News: ${trade.news || "None"} (${trade.newsImpact || "Low"})`,
    `Outcome: ${trade.outcome} | Setup Grade: ${trade.grade} | Exec Grade: ${trade.executionGrade || "—"}`,
    `Notes: ${trade.notes || "none"}`,
  ].join("\n");
}

function buildPrompt(tradeContext, hasScreenshots) {
  return hasScreenshots
    ? `You are a GC (gold futures) trading coach reviewing a student's trade. Analyse the chart screenshot(s) and trade data below. Be direct, specific, and reference actual chart structure and prices where visible.\n\nTrade data:\n${tradeContext}\n\nRespond in exactly these 6 sections with no preamble:\n1. Setup Quality\n2. Entry Timing\n3. Risk Management\n4. What Was Done Well\n5. What To Improve\n6. Overall Verdict (one sentence)`
    : `You are a GC (gold futures) trading coach reviewing a student's trade. No chart screenshot provided — analyse data only. Be direct and specific.\n\nTrade data:\n${tradeContext}\n\nRespond in exactly these 5 sections:\n1. Setup Quality\n2. Risk Management\n3. What Was Done Well\n4. What To Improve\n5. Overall Verdict (one sentence)`;
}

/**
 * Sends a trade to OpenAI (api/analyze-trade-review.js) for review.
 * `trade.screenshots` should already be loaded (call dbFetchScreenshots
 * first if trade.screenshotsLoaded is false) — this function does not
 * lazy-load them itself.
 */
export async function reviewTradeWithAI(trade) {
  const tradeContext = buildTradeContext(trade);
  const hasScreenshots = trade.screenshots && trade.screenshots.length > 0;
  const prompt = buildPrompt(tradeContext, hasScreenshots);

  // Screenshots are already stored as data URLs (see db.js) — OpenAI's
  // Responses API takes those directly as input_image, no reformatting
  // needed (Anthropic's format required splitting into base64 + media_type
  // separately; OpenAI just wants the data URL as-is).
  const images = hasScreenshots ? trade.screenshots.map(ss => ss.data) : [];

  const secret = import.meta.env.VITE_CRON_SECRET || "";
  const res = await fetch(`${window.location.origin}/api/analyze-trade-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({ prompt, images }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "AI review failed");
  return data.text;
}
