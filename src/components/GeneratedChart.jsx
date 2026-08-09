import { useState } from "react";
import { fetchTradeBars } from "../utils/chartBars.js";
import { renderTradeChart } from "../utils/chartRender.js";
import { dbUploadChart, dbUpdate } from "../api/db.js";
import { TIMEFRAMES, PRIMARY_TIMEFRAMES, DEFAULT_TIMEFRAME } from "../utils/timeframes.js";

// ─── GeneratedChart ─────────────────────────────────────────────────────
// Multi-timeframe chart reconstruction for a single trade: 1D / 4H / 1H /
// 15m / 5m (in strategy-priority order), plus the original 1m view kept
// working but no longer the default.
//
// Generation itself now runs automatically in the background (see
// useAutoGeneration.js) — nothing to click for the normal case. This
// component just displays whatever's already been generated per timeframe
// tab, shows a lightweight "generating…" state while the background hook
// is working on this trade, and keeps a small de-emphasized "Regenerate"
// link per tab as a manual override/retry (still goes through the same
// Preview → Save flow so a manual regenerate is still verified before
// overwriting a saved chart).
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

  const canGenerate = !!trade.contractId && !!trade.entryDatetimeUtc && !!trade.exitDatetimeUtc;
  const chartsByTf = Object.fromEntries((trade.generatedCharts || []).map(c => [c.timeframe, c]));
  const autoGenerating = trade.chartStatus === "generating";

  const switchTab = (tf) => {
    setActiveTab(tf);
    setStatus("idle");
    setError("");
    setPreviewDataUrl(null);
    setMeta(null);
  };

  const handleGeneratePreview = async () => {
    setStatus("loading");
    setError("");
    setPreviewDataUrl(null);
    try {
      const bars = await fetchTradeBars(trade, { timeframe: activeTab });
      const { dataUrl, entryIndex, exitIndex, barCount } = renderTradeChart({ bars, trade, timeframe: activeTab });
      setPreviewDataUrl(dataUrl);
      setMeta({ barCount, entryFound: entryIndex >= 0, exitFound: exitIndex >= 0 });
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
      const url = await dbUploadChart(trade.id, activeTab, previewDataUrl);
      const entry = { type: "generated", timeframe: activeTab, url, name: `trade-${trade.id}-${activeTab}.png`, generated_at: new Date().toISOString() };
      const generatedCharts = [...(trade.generatedCharts || []).filter(c => c.timeframe !== activeTab), entry];
      const updated = { ...trade, generatedCharts, chartStatus: "ok" };
      await dbUpdate(updated);
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

        {autoGenerating && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#3b82f6" }}>
            Auto-generating charts…
          </span>
        )}
      </div>

      {TIMEFRAMES[activeTab]?.purpose && (
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 8 }}>{TIMEFRAMES[activeTab].purpose}</div>
      )}

      {activeExisting && status === "idle" && (
        <div style={{ marginBottom: 6 }}>
          <img
            src={activeExisting.url}
            alt={`Generated ${activeTab} chart`}
            onClick={() => openLightbox?.(activeExisting.url)}
            style={{ width: "100%", maxWidth: 640, borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block" }}
          />
        </div>
      )}

      {/* Not generated yet — background hook (useAutoGeneration) will pick
          this up automatically, no click needed. Manual trigger stays
          available as a small link in case someone wants it sooner. */}
      {!activeExisting && status === "idle" && (
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {autoGenerating ? "Generating…" : "Queued for automatic generation."}{" "}
          <button onClick={handleGeneratePreview} style={linkStyle}>Generate now</button>
          {trade._autoChartError && trade._autoChartError.startsWith(activeTab) && (
            <div style={{ fontSize: 10, color: "#ff4d6d", marginTop: 6 }}>
              Background auto-generate failed: {trade._autoChartError}
            </div>
          )}
        </div>
      )}

      {activeExisting && status === "idle" && (
        <button onClick={handleGeneratePreview} style={linkStyle}>Regenerate {activeTab}</button>
      )}

      {status === "loading" && (
        <div style={{ fontSize: 11, color: "#8b949e" }}>Fetching native {activeTab} bars & rendering…</div>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 8 }}>{error}</div>
          <button onClick={handleGeneratePreview} style={btnStyle("#3b82f6")}>Try Again</button>
        </>
      )}

      {(status === "previewed" || status === "saving") && previewDataUrl && (
        <div>
          <div style={{ fontSize: 11, color: meta?.entryFound && meta?.exitFound ? "#00e5a0" : "#f5c842", marginBottom: 6 }}>
            {meta?.entryFound && meta?.exitFound
              ? `✓ Entry and exit both matched to a ${activeTab} bar (${meta.barCount} bars loaded).`
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

const linkStyle = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#6b7280",
  fontSize: 10,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
};

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
