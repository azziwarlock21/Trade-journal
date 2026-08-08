// ─── api/_lib/maeMfeServer.js ───────────────────────────────────────────
// Server-side MAE/MFE computation, used during the TopstepX sync itself so
// every imported trade already has mae/mfe filled in — no manual
// "Auto-Calculate" click needed per trade going forward.
//
// Same definitions/formulas as src/utils/maeMfe.js (the client-side
// backfill tool for trades imported before this existed):
//   Long:  MAE extreme = lowest low reached while in the trade  (adverse)
//          MFE extreme = highest high reached while in the trade (favorable)
//   Short: MAE extreme = highest high reached while in the trade (adverse)
//          MFE extreme = lowest low reached while in the trade  (favorable)
//
// Underscore-prefixed folder so Vercel treats this as a shared module, not
// its own API route.

const TOPSTEPX_API = "https://api.topstepx.com";
const UNIT_MINUTE = 2;

export async function fetchExecutionBars(token, contractId, startTime, endTime) {
  const response = await fetch(`${TOPSTEPX_API}/api/History/retrieveBars`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      contractId,
      live: false,
      startTime,
      endTime,
      unit: UNIT_MINUTE,
      unitNumber: 1,
      limit: 20000,
      includePartialBar: false,
    }),
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Execution bars response was not JSON: ${text.slice(0, 200)}`); }
  if (!response.ok || data.success === false) throw new Error(`Execution bars failed: ${JSON.stringify(data)}`);

  return (data.bars || []).map(b => ({ high: b.h, low: b.l }));
}

export function computeMaeMfe(bars, entryPrice, direction) {
  let lowestLow = Infinity;
  let highestHigh = -Infinity;
  for (const b of bars) {
    if (b.low < lowestLow) lowestLow = b.low;
    if (b.high > highestHigh) highestHigh = b.high;
  }
  if (!isFinite(lowestLow) || !isFinite(highestHigh)) return null;

  const isLong = direction === "Long";
  const maePrice = isLong ? lowestLow : highestHigh;
  const mfePrice = isLong ? highestHigh : lowestLow;

  const maeRaw = isLong ? entryPrice - maePrice : maePrice - entryPrice;
  const mfeRaw = isLong ? mfePrice - entryPrice : entryPrice - mfePrice;

  return {
    mae: (maeRaw > 0 ? maeRaw : 0).toFixed(1),
    mfe: (mfeRaw > 0 ? mfeRaw : 0).toFixed(1),
  };
}

// Best-effort: fetches bars + computes MAE/MFE for one trade, never throws
// (import must never be blocked by this — same rule as chart generation).
export async function tryComputeMaeMfe(token, contractId, entryUtc, exitUtc, entryPrice, direction) {
  try {
    const bars = await fetchExecutionBars(token, contractId, entryUtc, exitUtc);
    if (!bars.length) return null;
    return computeMaeMfe(bars, entryPrice, direction);
  } catch (e) {
    console.error(`MAE/MFE calc failed for ${contractId} ${entryUtc}: ${e.message}`);
    return null;
  }
}
