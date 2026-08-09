import { useState } from "react";
import { fetchExecutionBars, computeMaeMfe } from "../utils/maeMfe.js";
import { dbUpdate } from "../api/db.js";

// ─── MaeMfeCalculator ───────────────────────────────────────────────────
// Auto-determines MAE/MFE Extreme Price (and the resulting MAE/MFE point
// values) from actual 1-minute historical bars over the trade's exact
// entry→exit window, instead of requiring them to be typed in on
// TradeForm. Same preview-then-save pattern as chart generation: nothing
// is written until you've looked at the computed extreme price.

export default function MaeMfeCalculator({ trade, onUpdate }) {
  const [status, setStatus] = useState("idle"); // idle | loading | previewed | saving | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canCalc = !!trade.contractId && !!trade.entryDatetimeUtc && !!trade.exitDatetimeUtc;
  if (!canCalc) return null;

  // Already computed — either automatically at import, or by a previous
  // manual run. Don't show the full "Auto-Calculate" call-to-action for
  // something that's already done; just offer a small, de-emphasized way
  // to redo it (e.g. if the trade's stop/entry got edited afterward).
  const alreadyComputed = trade.mae !== null && trade.mae !== undefined && trade.mae !== ""
    && trade.mfe !== null && trade.mfe !== undefined && trade.mfe !== "";

  const handleCalculate = async () => {
    setStatus("loading");
    setError("");
    setResult(null);
    try {
      const bars = await fetchExecutionBars(trade);
      const r = computeMaeMfe(bars, trade);
      setResult(r);
      setStatus("previewed");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setStatus("saving");
    setError("");
    try {
      const updated = { ...trade, mae: result.mae, mfe: result.mfe };
      await dbUpdate(updated);
      onUpdate?.(updated);
      setResult(null);
      setStatus("idle");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  return (
    <div style={{ gridColumn: "1/-1", marginTop: 4 }}>
      {status === "idle" && !alreadyComputed && (
        <button onClick={handleCalculate} style={btnStyle("#a78bfa")}>
          Auto-Calculate MAE/MFE from Market Data
        </button>
      )}

      {status === "idle" && alreadyComputed && (
        <button
          onClick={handleCalculate}
          style={{ background: "none", border: "none", padding: 0, color: "#6b7280", fontSize: 10, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
        >
          Recalculate MAE/MFE
        </button>
      )}

      {status === "loading" && (
        <div style={{ fontSize: 11, color: "#8b949e" }}>Fetching 1-minute bars for the entry→exit window…</div>
      )}

      {status === "error" && (
        <>
          <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 6 }}>{error}</div>
          <button onClick={handleCalculate} style={btnStyle("#a78bfa")}>Try Again</button>
        </>
      )}

      {(status === "previewed" || status === "saving") && result && (
        <div style={{ fontSize: 11, color: "#e6edf3", background: "rgba(167,139,250,0.08)", border: "1px solid #a78bfa33", borderRadius: 8, padding: 10 }}>
          <div style={{ marginBottom: 4 }}>
            From {result.barCount} 1-minute bars between entry and exit ({trade.direction}):
          </div>
          <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
            <span>MAE Extreme Price: <b style={{ color: "#ff4d6d" }}>{result.maePrice.toFixed(2)}</b> → <b>{result.mae} pts</b></span>
            <span>MFE Extreme Price: <b style={{ color: "#00e5a0" }}>{result.mfePrice.toFixed(2)}</b> → <b>{result.mfe} pts</b></span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={status === "saving"} style={btnStyle("#00e5a0", "#0d1117")}>
              {status === "saving" ? "Saving…" : "Looks correct — Save"}
            </button>
            <button onClick={() => { setResult(null); setStatus("idle"); }} disabled={status === "saving"} style={btnStyle("transparent", "#8b949e", true)}>
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
    padding: "6px 12px",
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
