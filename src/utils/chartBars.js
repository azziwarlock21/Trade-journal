// ─── chartBars.js ───────────────────────────────────────────────────────
// Fetches the historical 1-minute bars needed to reconstruct a trade's
// chart: ~30 minutes before entry through ~30 minutes after exit, using
// the trade's exact fill timestamps (never estimated).

const PAD_MINUTES = 30;

export async function fetchTradeBars(trade, { unitNumber = 1 } = {}) {
  if (!trade.contractId) {
    throw new Error("This trade has no contract_id (synced before chart reconstruction was added — run a Full Resync from TopstepX to backfill it).");
  }
  if (!trade.entryDatetimeUtc || !trade.exitDatetimeUtc) {
    throw new Error("This trade has no UTC fill timestamps (synced before chart reconstruction was added — run a Full Resync from TopstepX to backfill them).");
  }

  const startTime = new Date(new Date(trade.entryDatetimeUtc).getTime() - PAD_MINUTES * 60000).toISOString();
  const endTime = new Date(new Date(trade.exitDatetimeUtc).getTime() + PAD_MINUTES * 60000).toISOString();

  const secret = import.meta.env.VITE_CRON_SECRET || "";
  const base = window.location.origin;

  const res = await fetch(`${base}/api/get-trade-bars`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
    body: JSON.stringify({
      contractId: trade.contractId,
      startTime,
      endTime,
      unitNumber,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch historical bars");
  if (!data.bars?.length) throw new Error("TopstepX returned no bars for this window — check the contract_id and time range.");

  return data.bars;
}
