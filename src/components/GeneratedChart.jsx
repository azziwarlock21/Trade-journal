import { useState } from "react";
import { fetchTradeBars } from "../utils/chartBars.js";
import { renderTradeChart } from "../utils/chartRender.js";
import { dbUploadChart, dbUpdate } from "../api/db.js";
import { TIMEFRAMES, PRIMARY_TIMEFRAMES, DEFAULT_TIMEFRAME } from "../utils/timeframes.js";

// ─── GeneratedChart ─────────────────────────────────────────────────────
// Multi-timeframe chart reconstruction for a single trade: 1D / 4H / 1H /
// 15m / 5m (in strategy-priority order), plus the original 1m view kept
// working but no longer the default. Switching tabs never re-fetches or
// re-renders an already-saved timeframe — it just swaps which stored image
// is shown. Generating a *new* timeframe still goes through an explicit
// Preview → Save step so nothing lands in Storage/the trades table without
// a look first.
//
// Tabs read/write trade.generatedCharts, an array of
// { type: "generated", timeframe, url, name } — one entry per timeframe,
// all on the SAME trade row (no duplicate trade records; see db.js).

const ALL_TABS = [...PRIMARY_TIMEFRAMES, "1m"];

export default function GeneratedChart({ trade, onUpdate, openLightbox }) {
  const [activeTab, setActiveTab] = useState(DEFAULT_TIMEFRAME);
  const [status, setStatus] = useState("idle"); // idle | loading | previewed | saving | error
  const [error, setError] = useState("");
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

  const canGenerate = !!trade.contractId && !!trade.entryDatetimeUtc && !!trade.exitDatetimeUtc;
  const chartsByTf = Object.fromEntries((trade.generatedCharts || []).map(c => [c.timeframe, c]));

  const switchTab = (tf) => {
    setActiveTab(tf);
    setStatus("idle");
    setError("");
    setPreviewDataUrl(null);
    setMeta(null);
  };

  const generateOne = async (timeframe) => {
    const bars = await fetchTradeBars(trade, { timeframe });
    return renderTradeChart({ bars, trade, timeframe });
  };

  const handleGeneratePreview = async () => {
    setStatus("loading");
    setError("");
    setPreviewDataUrl(null);
    try {
      const { dataUrl, entryIndex, exitIndex, barCount } = await generateOne(activeTab);
      setPreviewDataUrl(dataUrl);
      setMeta({ barCount, entryFound: entryIndex >= 0, exitFound: exitIndex >= 0 });
      setStatus("previewed");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const persistChart = async (timeframe, dataUrl, baseTrade) => {
    const url = await dbUploadChart(baseTrade.id, timeframe, dataUrl);
    const entry = { type: "generated", timeframe, url, name: `trade-${baseTrade.id}-${timeframe}.png`, generated_at: new Date().toISOString() };
    const generatedCharts = [
      ...(baseTrade.generatedCharts || []).filter(c => c.timeframe !== timeframe),
      entry,
    ];
    const updated = { ...baseTrade, generatedCharts, chartStatus: "ok" };
    await dbUpdate(updated);
    return updated;
  };

  const handleSave = async () => {
    if (!previewDataUrl) return;
    setStatus("saving");
    setError("");
    try {
      const updated = await persistChart(activeTab, previewDataUrl, trade);
      onUpdate?.(updated);
      setPreviewDataUrl(null);
      setStatus("idle");
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

  // Generates + saves all 5 primary timeframes back-to-back for this trade.
  // Each still goes through the same native-bar fetch + deterministic
  // render as the single-timeframe flow — this just automates the button
  // presses, it doesn't skip the underlying steps.
  const handleGenerateAll = async () => {
    setBulkRunning(true);
    setError("");
    let current = trade;
    for (let i = 0; i < PRIMARY_TIMEFRAMES.length; i++) {
      const tf = PRIMARY_TIMEFRAMES[i];
      setBulkProgress({ tf, i: i + 1, total: PRIMARY_TIMEFRAMES.length });
      try {
        const { dataUrl } = await generateOne(tf);
        current = await persistChart(tf, dataUrl, current);
        onUpdate?.(current);
      } catch (e) {
        setError(`${tf} failed: ${e.message}`);
        break;
      }
    }
    setBulkProgress(null);
    setBulkRunning(false);
  };

  if (!canGenerate) {
    return (
      <div style={{ gridColumn: "1/-1", borderTop: "1px solid #1f2937", marginTop: 6, paddingTop: 12 }}>
        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Reconstructed Chart
        </div>
        <span style={{ fontSize: 10, color: "#f5c842" }}>
          Missing contract_id / UTC timestamps — run a Full Resync to backfill this trade.
        </span>
      </div>
    );
  }

  const activeExisting = chartsByTf[activeTab];

  return (
    <div style={{ gridColumn: "1/-1", borderTop: "1px solid #1f2937", marginTop: 6, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase" }}>
          Reconstructed Chart
        </div>

        {/* Timeframe tabs — switching never re-fetches/regenerates a saved chart */}
        <div style={{ display: "flex", gap: 4 }}>
          {ALL_TABS.map(tf => (
            <button
              key={tf}
              onClick={() => switchTab(tf)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${activeTab === tf ? "#f5c842" : "#2a2f3a"}`,
                background: activeTab === tf ? "rgba(245,200,66,0.12)" : "transparent",
                color: activeTab === tf ? "#f5c842" : "#8b949e",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                position: "relative",
              }}
              title={TIMEFRAMES[tf]?.purpose}
            >
              {tf}
              {chartsByTf[tf] && (
                <span style={{ marginLeft: 5, color: "#00e5a0" }}>●</span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerateAll}
          disabled={bulkRunning}
          style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, border: "1px solid #3b82f655", background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontSize: 10, fontWeight: 700, cursor: bulkRunning ? "default" : "pointer", fontFamily: "inherit" }}
        >
          {bulkRunning ? `Generating ${bulkProgress?.tf || "…"} (${bulkProgress?.i}/${bulkProgress?.total})` : "Generate All 5 (1D→4H→1H→15m→5m)"}
        </button>
      </div>

      {TIMEFRAMES[activeTab]?.purpose && (
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8 }}>{TIMEFRAMES[activeTab].purpose}</div>
      )}

      {activeExisting && status === "idle" && (
        <div style={{ marginBottom: 10 }}>
          <img
            src={activeExisting.url}
            alt={`Generated ${activeTab} chart`}
            onClick={() => openLightbox?.(activeExisting.url)}
            style={{ width: "100%", maxWidth: 640, borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block" }}
          />
        </div>
      )}

      {status === "idle" && (
        <button onClick={handleGeneratePreview} disabled={bulkRunning} style={btnStyle("#3b82f6")}>
          {activeExisting ? `Regenerate ${activeTab} Preview` : `Generate ${activeTab} Chart`}
        </button>
      )}

      {status === "loading" && (
        <div style={{ fontSize: 11, color: "#8b949e" }}>Fetching native {activeTab} bars & rendering…</div>
      )}

      {status === "error" && (
        <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 8 }}>{error}</div>
      )}
      {status === "error" && (
        <button onClick={handleGeneratePreview} style={btnStyle("#3b82f6")}>Try Again</button>
      )}
      {bulkRunning === false && error && status !== "error" && (
        <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 8 }}>{error}</div>
      )}

      {(status === "previewed" || status === "saving") && previewDataUrl && (
        <div>
          <div style={{ fontSize: 11, color: meta?.entryFound && meta?.exitFound ? "#00e5a0" : "#f5c842", marginBottom: 6 }}>
            {meta?.entryFound && meta?.exitFound
              ? `✓ Entry and exit both matched to a ${activeTab} bar (${meta.barCount} bars loaded). Check the markers against the actual entry/exit before saving.`
              : `⚠ Entry or exit fell outside the fetched bar range (${meta?.barCount ?? 0} bars) — don't save until this looks right.`}
          </div>
          <img
            src={previewDataUrl}
            alt="Chart preview"
            style={{ width: "100%", maxWidth: 700, borderRadius: 8, border: "1px solid #2a2f3a", display: "block", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={status === "saving"} style={btnStyle("#00e5a0", "#0d1117")}>
              {status === "saving" ? "Saving…" : `Looks correct — Save ${activeTab}`}
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
    color,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
