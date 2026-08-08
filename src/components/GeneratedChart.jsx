import { useState } from "react";
import { fetchTradeBars } from "../utils/chartBars.js";
import { renderTradeChart } from "../utils/chartRender.js";
import { dbUploadChart, dbUpdate } from "../api/db.js";

// ─── GeneratedChart ─────────────────────────────────────────────────────
// Phase 1: manual, single-trade, 1-minute-only chart reconstruction.
//
// Deliberately a two-step "Preview → Save" flow rather than auto-generating
// on import: the goal right now is to generate ONE real chart, visually
// confirm the entry/exit markers line up with the actual TopstepX fills,
// and only then consider wiring this into the import pipeline or adding
// 5m/15m. Saving is a separate explicit action so nothing gets written to
// Supabase Storage/the trades table until you've actually looked at it.

export default function GeneratedChart({ trade, onUpdate, openLightbox }) {
  const [status, setStatus] = useState("idle"); // idle | loading | previewed | saving | saved | error
  const [error, setError] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [meta, setMeta] = useState(null);

  const existing = (trade.generatedCharts || []).find(c => c.timeframe === "1m");
  const canGenerate = !!trade.contractId && !!trade.entryDatetimeUtc && !!trade.exitDatetimeUtc;

  const handleGeneratePreview = async () => {
    setStatus("loading");
    setError("");
    setPreviewDataUrl(null);
    try {
      const bars = await fetchTradeBars(trade, { unitNumber: 1 });
      const { dataUrl, entryIndex, exitIndex, barCount } = renderTradeChart({ bars, trade, timeframe: "1m" });
      setPreviewDataUrl(dataUrl);
      setMeta({
        barCount,
        entryFound: entryIndex >= 0,
        exitFound: exitIndex >= 0,
      });
      setStatus("previewed");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const handleSave = async () => {
    if (!previewDataUrl) return;
    setStatus("saving");
    setError("");
    try {
      const url = await dbUploadChart(trade.id, "1m", previewDataUrl);
      const newEntry = { type: "generated", timeframe: "1m", url, name: `trade-${trade.id}-1m.png` };
      const generatedCharts = [
        ...(trade.generatedCharts || []).filter(c => c.timeframe !== "1m"),
        newEntry,
      ];
      const updated = { ...trade, generatedCharts, chartStatus: "ok" };
      await dbUpdate(updated);
      onUpdate?.(updated);
      setStatus("saved");
      setPreviewDataUrl(null);
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const handleDiscard = () => {
    setPreviewDataUrl(null);
    setMeta(null);
    setStatus("idle");
  };

  return (
    <div style={{ gridColumn: "1/-1", borderTop: "1px solid #1f2937", marginTop: 6, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase" }}>
          Reconstructed Chart (1m)
        </div>
        {!canGenerate && (
          <span style={{ fontSize: 10, color: "#f5c842" }}>
            Missing contract_id / UTC timestamps — run a Full Resync to backfill this trade.
          </span>
        )}
      </div>

      {existing && status === "idle" && (
        <div style={{ marginBottom: 10 }}>
          <img
            src={existing.url}
            alt="Generated 1m chart"
            onClick={() => openLightbox?.(existing.url)}
            style={{ width: "100%", maxWidth: 520, borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block" }}
          />
        </div>
      )}

      {canGenerate && (status === "idle" || status === "saved") && (
        <button onClick={handleGeneratePreview} style={btnStyle("#3b82f6")}>
          {existing ? "Regenerate Preview" : "Generate 1-Minute Chart"}
        </button>
      )}

      {status === "loading" && (
        <div style={{ fontSize: 11, color: "#8b949e" }}>Fetching historical bars & rendering…</div>
      )}

      {status === "error" && (
        <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 8 }}>{error}</div>
      )}
      {status === "error" && (
        <button onClick={handleGeneratePreview} style={btnStyle("#3b82f6")}>Try Again</button>
      )}

      {(status === "previewed" || status === "saving") && previewDataUrl && (
        <div>
          <div style={{ fontSize: 11, color: meta?.entryFound && meta?.exitFound ? "#00e5a0" : "#f5c842", marginBottom: 6 }}>
            {meta?.entryFound && meta?.exitFound
              ? `✓ Entry and exit both matched to a bar (${meta.barCount} bars loaded). Check the markers below against the actual entry/exit price + time before saving.`
              : `⚠ Entry or exit fell outside the fetched bar range (${meta?.barCount ?? 0} bars) — don't save until this looks right.`}
          </div>
          <img
            src={previewDataUrl}
            alt="Chart preview"
            style={{ width: "100%", maxWidth: 700, borderRadius: 8, border: "1px solid #2a2f3a", display: "block", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={status === "saving"} style={btnStyle("#00e5a0", "#0d1117")}>
              {status === "saving" ? "Saving…" : "Looks correct — Save to Trade"}
            </button>
            <button onClick={handleDiscard} disabled={status === "saving"} style={btnStyle("transparent", "#8b949e", true)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg, color = "#0d1117", outline = false) {
  return {
    padding: "7px 14px",
    borderRadius: 7,
    border: outline ? "1px solid #2a2f3a" : "none",
    background: bg,
    color: outline ? color : color,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
