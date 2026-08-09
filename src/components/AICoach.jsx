import { useState, useCallback } from "react";
import { runDataAnalysis } from "../utils/coachAnalysis.js";
import { reviewTradeWithAI } from "../utils/coachReview.js";
import { generateTradingEdgeReport } from "../utils/coachEdge.js";
import { dbFetchScreenshots } from "../api/db.js";
import { gradeColor, outcomeColor } from "../utils/helpers.js";

const TYPE_COLOR = { positive: "#00e5a0", warning: "#f5c842", critical: "#ff4d6d" };
const TYPE_BG    = { positive: "rgba(0,229,160,0.06)", warning: "rgba(245,200,66,0.06)", critical: "rgba(255,77,109,0.06)" };
const TYPE_ICON  = { positive: "▲", warning: "!", critical: "✕" };

// ─── AICoach ──────────────────────────────────────────────────────────────
// Two independent tools in one tab:
//   A. Pattern Analysis — instant, free, runs entirely client-side against
//      the full trade history (see utils/coachAnalysis.js).
//   B. Per-Trade AI Review — sends one trade + its screenshots to OpenAI
//      for a structured coaching writeup (see utils/coachReview.js).
//
// Owns its own local UI state (loading/results) since neither tool needs
// to persist across tab switches. Only needs `trades` and `setTrades` (to
// cache lazily-loaded screenshots back into the shared trade list) and
// `openLightbox` from the parent.

export default function AICoach({ trades, setTrades, openLightbox }) {
  const [findings, setFindings] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [reviewTrade, setReviewTrade] = useState(null);
  const [reviewResult, setReviewResult] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [edgeReport, setEdgeReport] = useState("");
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [edgeError, setEdgeError] = useState("");

  const handleGenerateEdge = useCallback(async () => {
    if (trades.length < 10) { setEdgeError("Log at least 10 trades before running this — the edge it finds needs a real sample to be trustworthy."); return; }
    setEdgeLoading(true); setEdgeError(""); setEdgeReport("");
    try {
      const report = await generateTradingEdgeReport(trades);
      setEdgeReport(report);
    } catch (e) {
      setEdgeError("Analysis failed: " + e.message);
    } finally {
      setEdgeLoading(false);
    }
  }, [trades]);

  const handleRunAnalysis = useCallback(() => {
    if (trades.length < 5) { setAnalysisError("Log at least 5 trades before running analysis."); return; }
    setAnalysisLoading(true); setAnalysisError("");
    // Synchronous but wrapped for UI consistency with the loading state
    const result = runDataAnalysis(trades);
    setFindings(result);
    setAnalysisLoading(false);
  }, [trades]);

  const handleTradeReview = useCallback(async (trade) => {
    setReviewTrade(trade);
    setReviewResult(""); setReviewError(""); setReviewLoading(true);

    let fullTrade = trade;
    if (!trade.screenshotsLoaded) {
      try {
        const shots = await dbFetchScreenshots(trade.id);
        fullTrade = { ...trade, screenshots: shots, screenshotsLoaded: true };
        setTrades(ts => ts.map(t => (t.id === trade.id ? fullTrade : t)));
        setReviewTrade(fullTrade);
      } catch (e) { /* proceed without screenshots */ }
    }

    try {
      const result = await reviewTradeWithAI(fullTrade);
      setReviewResult(result);
    } catch (e) {
      setReviewError("Review failed: " + e.message);
    } finally {
      setReviewLoading(false);
    }
  }, [setTrades]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>AI Coach</div>
      <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 24 }}>Three tools: an AI-synthesized trading edge from your full history, instant rule-based pattern analysis, and per-trade AI review using your screenshots.</div>

      {/* ── Section A: Trading Edge Report ── */}
      <div style={{ background: "#0d1117", border: "1px solid #f5c84233", borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>Trading Edge Report</div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>OpenAI synthesizes your full history — win rate, session/hour/direction/hold-time breakdowns, MAE/MFE — into one followable edge.</div>
          </div>
          <button onClick={handleGenerateEdge} disabled={edgeLoading || trades.length < 10}
            style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: edgeLoading ? "#2a2f3a" : "linear-gradient(135deg, #f5c842, #ff9a3c)", color: edgeLoading ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 11, cursor: edgeLoading || trades.length < 10 ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
            {edgeLoading ? "Analysing..." : edgeReport ? "Regenerate" : "Generate Edge Report"}
          </button>
        </div>

        {edgeError && <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 12 }}>{edgeError}</div>}
        {trades.length < 10 && !edgeError && <div style={{ fontSize: 11, color: "#4b5563" }}>Log at least 10 trades for a report with a real sample behind it.</div>}

        {edgeLoading && (
          <div style={{ background: "#070b12", border: "1px solid #1f2937", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#f5c842", marginBottom: 8 }}>Analysing {trades.length} trades...</div>
            <div style={{ fontSize: 10, color: "#4b5563" }}>Crunching win rate, session/hour/direction/hold-time, MAE/MFE, and pattern findings</div>
          </div>
        )}

        {edgeReport && !edgeLoading && (
          <div style={{ background: "#070b12", border: "1px solid #f5c84233", borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{edgeReport}</div>
            <div style={{ fontSize: 9, color: "#2a2f3a", textAlign: "right", marginTop: 12, letterSpacing: 2 }}>{trades.length} TRADES ANALYSED</div>
          </div>
        )}
      </div>

      {/* ── Section B: Pattern Analysis ── */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase" }}>Pattern Analysis</div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>Analyses all {trades.length} logged trades — sessions, patterns, grades, MAE, HTF alignment</div>
          </div>
          <button onClick={handleRunAnalysis} disabled={analysisLoading || trades.length < 5}
            style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: analysisLoading ? "#2a2f3a" : "linear-gradient(135deg, #f5c842, #ff9a3c)", color: analysisLoading ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 11, cursor: analysisLoading || trades.length < 5 ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
            {analysisLoading ? "Analysing..." : "Run Analysis"}
          </button>
        </div>

        {analysisError && <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 12 }}>{analysisError}</div>}
        {trades.length < 5 && <div style={{ fontSize: 11, color: "#4b5563" }}>Log at least 5 trades to run analysis.</div>}

        {findings && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {findings.map((f, i) => (
              <div key={i} style={{ background: TYPE_BG[f.type], border: `1px solid ${TYPE_COLOR[f.type]}33`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: TYPE_COLOR[f.type] + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: TYPE_COLOR[f.type] }}>{TYPE_ICON[f.type]}</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[f.type], marginBottom: 4, letterSpacing: 1 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{f.body}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 9, color: "#2a2f3a", textAlign: "right", marginTop: 4, letterSpacing: 2 }}>{trades.length} TRADES ANALYSED</div>
          </div>
        )}
      </div>

      {/* ── Section C: Per-Trade AI Review ── */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Per-Trade AI Review</div>
        <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 16 }}>Select any trade below. OpenAI will analyse the chart screenshots + trade data and give specific coaching feedback.</div>

        {trades.length === 0 ? (
          <div style={{ fontSize: 11, color: "#4b5563" }}>No trades logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {[...trades].sort((a, b) => (b.entryDatetime > a.entryDatetime ? 1 : -1)).slice(0, 30).map(t => (
              <div key={t.id} onClick={() => handleTradeReview(t)}
                style={{ padding: "10px 14px", borderRadius: 9, border: `1px solid ${reviewTrade?.id === t.id ? "#f5c842" : "#1f2937"}`, background: reviewTrade?.id === t.id ? "rgba(245,200,66,0.05)" : "#070b12", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", transition: "all 0.15s" }}>
                <span style={{ fontSize: 10, color: "#6b7280", minWidth: 110 }}>{t.entryDatetime ? t.entryDatetime.replace("T", " ") : "--"}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.direction === "Long" ? "#00e5a0" : "#ff4d6d" }}>{t.direction}</span>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{t.tradeType || "--"}</span>
                <span style={{ fontSize: 10, color: "#6b7280" }}>{t.session || "--"}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: gradeColor(t.grade) }}>{t.grade}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: outcomeColor(t.outcome) }}>{t.outcome}</span>
                <span style={{ fontSize: 10, color: parseFloat(t.points) >= 0 ? "#00e5a0" : "#ff4d6d" }}>{t.points ? t.points + "pts" : "--"}</span>
                {t.screenshotName && <span style={{ fontSize: 9, color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "1px 7px", borderRadius: 10 }}>has chart</span>}
                <span style={{ marginLeft: "auto", fontSize: 9, color: "#4b5563" }}>click to review →</span>
              </div>
            ))}
            {trades.length > 30 && <div style={{ fontSize: 10, color: "#4b5563", textAlign: "center", padding: 8 }}>Showing 30 most recent trades</div>}
          </div>
        )}

        {reviewLoading && (
          <div style={{ background: "#070b12", border: "1px solid #1f2937", borderRadius: 10, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#f5c842", marginBottom: 8 }}>Reviewing trade...</div>
            <div style={{ fontSize: 10, color: "#4b5563" }}>
              OpenAI is analysing {reviewTrade?.screenshots?.length > 0 ? `${reviewTrade.screenshots.length} screenshot(s) and` : ""} trade data
            </div>
          </div>
        )}
        {reviewError && <div style={{ fontSize: 11, color: "#ff4d6d", padding: 12 }}>{reviewError}</div>}
        {reviewResult && reviewTrade && (
          <div style={{ background: "#070b12", border: "1px solid #f5c84233", borderRadius: 12, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#f5c842", letterSpacing: 2 }}>AI REVIEW</span>
              <span style={{ fontSize: 10, color: "#6b7280" }}>{reviewTrade.entryDatetime?.replace("T", " ")}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: reviewTrade.direction === "Long" ? "#00e5a0" : "#ff4d6d" }}>{reviewTrade.direction}</span>
              <span style={{ fontSize: 10, color: outcomeColor(reviewTrade.outcome), fontWeight: 700 }}>{reviewTrade.outcome}</span>
              {reviewTrade.screenshots?.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  {reviewTrade.screenshots.map((ss, i) => (
                    <img key={i} src={ss.data} alt="chart" onClick={() => openLightbox(ss.data)}
                      style={{ height: 36, width: 52, objectFit: "cover", borderRadius: 5, border: "1px solid #2a2f3a", cursor: "zoom-in" }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{reviewResult}</div>
          </div>
        )}
      </div>
    </div>
  );
}
