// ─── maeMfe.js ──────────────────────────────────────────────────────────
// Determines MAE (Max Adverse Excursion) / MFE (Max Favorable Excursion)
// "extreme price" fields from actual historical market data instead of
// requiring them to be typed in by hand.
//
// Definitions (matching the existing manual-entry math in useTrades.js):
//   Long:  MAE extreme = lowest low reached while in the trade  (adverse)
//          MFE extreme = highest high reached while in the trade (favorable)
//   Short: MAE extreme = highest high reached while in the trade (adverse)
//          MFE extreme = lowest low reached while in the trade  (favorable)
//
// Uses native 1-minute bars (the finest resolution the data provider
// gives us) over the EXACT entry→exit window — no padding, since anything
// outside the trade's own duration isn't part of its excursion by
// definition, and no resampling from a coarser timeframe.

const UNIT_MINUTE = 2;

export async function fetchExecutionBars(trade) {
  if (!trade.contractId) {
    throw new Error("This trade has no contract_id — run a Full Resync from TopstepX to backfill it.");
  }
  if (!trade.entryDatetimeUtc || !trade.exitDatetimeUtc) {
    throw new Error("This trade has no UTC fill timestamps — run a Full Resync from TopstepX to backfill them.");
  }

  const secret = import.meta.env.VITE_CRON_SECRET || "";
  const base = window.location.origin;

  const res = await fetch(`${base}/api/get-trade-bars`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({
      contractId: trade.contractId,
      startTime: trade.entryDatetimeUtc,
      endTime: trade.exitDatetimeUtc,
      unit: UNIT_MINUTE,
      unitNumber: 1,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch execution-window bars");
  if (!data.bars?.length) throw new Error("TopstepX returned no bars for the entry→exit window.");

  return data.bars;
}

export function computeMaeMfe(bars, trade) {
  const entry = parseFloat(trade.entryPrice);
  if (isNaN(entry) || !trade.direction) throw new Error("Trade is missing entry price / direction");

  let lowestLow = Infinity;
  let highestHigh = -Infinity;
  for (const b of bars) {
    if (b.low < lowestLow) lowestLow = b.low;
    if (b.high > highestHigh) highestHigh = b.high;
  }
  if (!isFinite(lowestLow) || !isFinite(highestHigh)) throw new Error("No usable price data in the bars returned");

  const isLong = trade.direction === "Long";
  const maePrice = isLong ? lowestLow : highestHigh;
  const mfePrice = isLong ? highestHigh : lowestLow;

  const maeRaw = isLong ? entry - maePrice : maePrice - entry;
  const mfeRaw = isLong ? mfePrice - entry : entry - mfePrice;

  return {
    maePrice,
    mfePrice,
    mae: (maeRaw > 0 ? maeRaw : 0).toFixed(1),
    mfe: (mfeRaw > 0 ? mfeRaw : 0).toFixed(1),
    barCount: bars.length,
  };
}
