import { useEffect, useRef } from "react";
import { fetchTradeBars } from "../utils/chartBars.js";
import { renderTradeChart } from "../utils/chartRender.js";
import { fetchExecutionBars, computeMaeMfe } from "../utils/maeMfe.js";
import { dbUploadChart, dbUpdate } from "../api/db.js";
import { PRIMARY_TIMEFRAMES } from "../utils/timeframes.js";

// ─── useAutoGeneration ───────────────────────────────────────────────────
// Runs entirely in the background, no button required — same idea as
// points/RRR being computed automatically the moment a trade exists.
//
// For every TopstepX-imported trade (has contract_id + UTC fill times)
// that's missing MAE/MFE and/or any of the 5 primary chart timeframes,
// this fills them in: MAE/MFE first (cheap, one bar fetch), then each
// missing chart (1D → 4H → 1H → 15m → 5m), persisting each result to
// Supabase as it completes. Runs one trade at a time — each save updates
// `trades` via onUpdateTrade, which re-triggers this effect to pick up the
// next candidate, so it self-paces instead of firing everything at once
// and hammering the TopstepX API.
//
// Never throws into the app and never blocks anything else — a failure on
// one trade just gets marked "attempted" for this session (so it isn't
// retried in a hot loop) and the small "Recalculate"/"Regenerate" controls
// in the UI stay available for a manual retry.

function hasMaeMfe(t) {
  return t.mae !== null && t.mae !== undefined && t.mae !== ""
    && t.mfe !== null && t.mfe !== undefined && t.mfe !== "";
}

function missingTimeframes(t) {
  const have = new Set((t.generatedCharts || []).map(c => c.timeframe));
  return PRIMARY_TIMEFRAMES.filter(tf => !have.has(tf));
}

export function useAutoGeneration(trades, onUpdateTrade) {
  const runningRef = useRef(false);
  const attemptedRef = useRef(new Set());

  useEffect(() => {
    if (runningRef.current) return;
    if (!Array.isArray(trades) || !trades.length) return;

    const candidate = trades.find(t =>
      t.tradeMode === "Live" &&
      !!t.contractId && !!t.entryDatetimeUtc && !!t.exitDatetimeUtc &&
      !attemptedRef.current.has(t.id) &&
      (!hasMaeMfe(t) || missingTimeframes(t).length > 0)
    );
    if (!candidate) return;

    runningRef.current = true;

    (async () => {
      let working = candidate;

      // Local-only "generating" flag so the UI can show something's
      // happening — not persisted, just lets GeneratedChart/MaeMfeCalculator
      // reflect in-progress state without a dedicated DB column.
      onUpdateTrade({ ...working, chartStatus: "generating" });

      if (!hasMaeMfe(working)) {
        try {
          const bars = await fetchExecutionBars(working);
          const r = computeMaeMfe(bars, working);
          working = { ...working, mae: r.mae, mfe: r.mfe };
          await dbUpdate(working);
          onUpdateTrade(working);
        } catch (e) {
          console.error(`Auto MAE/MFE failed for trade ${working.id}: ${e.message}`);
        }
      }

      for (const tf of missingTimeframes(working)) {
        try {
          const bars = await fetchTradeBars(working, { timeframe: tf });
          const { dataUrl } = renderTradeChart({ bars, trade: working, timeframe: tf });
          const url = await dbUploadChart(working.id, tf, dataUrl);
          const entry = { type: "generated", timeframe: tf, url, name: `trade-${working.id}-${tf}.png`, generated_at: new Date().toISOString() };
          const generatedCharts = [...(working.generatedCharts || []).filter(c => c.timeframe !== tf), entry];
          working = { ...working, generatedCharts, chartStatus: "ok" };
          await dbUpdate(working);
          onUpdateTrade(working);
        } catch (e) {
          console.error(`Auto chart generation failed for trade ${working.id} [${tf}]: ${e.message}`);
        }
      }

      onUpdateTrade({ ...working, chartStatus: working.chartStatus === "generating" ? "pending" : working.chartStatus });
      attemptedRef.current.add(candidate.id);
      runningRef.current = false;
    })();
  }, [trades, onUpdateTrade]);
}
