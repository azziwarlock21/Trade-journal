// ─── chartBars.js ───────────────────────────────────────────────────────
// Fetches the historical bars needed to reconstruct a trade's chart at a
// given timeframe, centered on the trade's exact fill timestamps (never
// estimated). Bars are native to whatever timeframe is requested — the
// gateway is asked for real 5m/15m/1H/4H/1D/1m bars directly (see
// utils/timeframes.js), nothing is resampled from 1-minute data here.

import { TIMEFRAMES, barPaddingMinutes } from "./timeframes.js";

export async function fetchTradeBars(trade, { timeframe = "1H" } = {}) {
  const tf = TIMEFRAMES[timeframe];
  if (!tf) throw new Error(`Unknown timeframe "${timeframe}"`);

  if (!trade.contractId) {
    throw new Error("This trade has no contract_id (synced before chart reconstruction was added — run a Full Resync from TopstepX to backfill it).");
  }
  if (!trade.entryDatetimeUtc || !trade.exitDatetimeUtc) {
    throw new Error("This trade has no UTC fill timestamps (synced before chart reconstruction was added — run a Full Resync from TopstepX to backfill them).");
  }

  const padMinutes = barPaddingMinutes(tf);
  const startTime = new Date(new Date(trade.entryDatetimeUtc).getTime() - padMinutes * 60000).toISOString();
  const endTime = new Date(new Date(trade.exitDatetimeUtc).getTime() + padMinutes * 60000).toISOString();

  const secret = import.meta.env.VITE_CRON_SECRET || "";
  const base = window.location.origin;

  const res = await fetch(`${base}/api/get-trade-bars`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({
      contractId: trade.contractId,
      startTime,
      endTime,
      unit: tf.unit,
      unitNumber: tf.unitNumber,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `Failed to fetch ${timeframe} historical bars`);
  if (!data.bars?.length) throw new Error(`TopstepX returned no ${timeframe} bars for this window — check the contract_id and time range.`);

  return data.bars;
}
