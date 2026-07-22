import {
  CANDLE_PATTERNS, NEWS_EVENTS, SESSIONS,
  TRADE_TYPES, GRADES, HTF_BIASES, MARKET_STRUCTURES, TRADE_MODES,
} from "../utils/constants.js";
import { labelStyle as lbl, inputStyle as inp } from "../styles/formStyles.js";

// ─── BulkEditModal ────────────────────────────────────────────────────────
// Inline panel (not a true overlay modal) for applying shared field values
// to every currently-selected trade in the Log tab. Empty fields are left
// unchanged on each trade — only fields the user fills in get applied.
// This is the primary tool for cleaning up TopstepX-imported trades that
// arrive with no candle pattern, HTF bias, or grade.

const BULK_FIELDS = [
  ["Trade Type",       "tradeType",       "select", TRADE_TYPES],
  ["Direction",        "direction",       "select", ["Long", "Short"]],
  ["HTF Bias",         "htfBias",         "select", HTF_BIASES],
  ["Market Structure", "marketStructure", "select", MARKET_STRUCTURES],
  ["Candle Pattern",   "candlePattern",   "select", CANDLE_PATTERNS],
  ["Wick Direction",   "wickDirection",   "select", ["None", "Upper", "Lower", "Both"]],
  ["Session",          "session",         "select", SESSIONS],
  ["Trade Mode",       "tradeMode",       "select", TRADE_MODES],
  ["Setup Grade",      "grade",           "select", GRADES],
  ["Execution Grade",  "executionGrade",  "select", GRADES],
  ["Stop Loss",        "stopLoss",        "number", null],
  ["Take Profit",      "takeProfit",      "number", null],
  ["News Event",       "news",            "select", NEWS_EVENTS],
  ["News Impact",      "newsImpact",      "select", ["Low", "Medium", "High"]],
];

export const emptyBulkForm = () => ({
  tradeType: "", direction: "", htfBias: "", marketStructure: "",
  candlePattern: "", wickDirection: "", session: "", tradeMode: "",
  grade: "", executionGrade: "", stopLoss: "", takeProfit: "",
  news: "", newsImpact: "", notes: "",
});

export default function BulkEditModal({
  selectedCount, bulkForm, setBulkForm,
  onApply, onCancel, syncing, syncError,
}) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #f5c84233", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
        Bulk Edit — {selectedCount} trades
      </div>
      <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 14 }}>
        Only filled fields will be applied. Empty fields are left unchanged on each trade.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12, marginBottom: 16 }}>
        {BULK_FIELDS.map(([label, key, type, opts]) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            {type === "select" ? (
              <select
                value={bulkForm[key]}
                onChange={e => setBulkForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ ...inp, color: bulkForm[key] ? "#f5c842" : "#4b5563", border: bulkForm[key] ? "1px solid #f5c84244" : "1px solid #2a2f3a" }}>
                <option value="">— leave unchanged —</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type="number" step="0.1"
                value={bulkForm[key]}
                onChange={e => setBulkForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder="leave blank to skip"
                style={{ ...inp, border: bulkForm[key] ? "1px solid #f5c84244" : "1px solid #2a2f3a" }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Append to Notes (optional)</label>
        <input
          value={bulkForm.notes}
          onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Text appended to each trade's notes"
          style={inp}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={onApply} disabled={syncing}
          style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: syncing ? "#2a2f3a" : "linear-gradient(135deg,#f5c842,#ff9a3c)", color: syncing ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 11, cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
          {syncing ? "Saving..." : `Apply to ${selectedCount} Trade${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button onClick={onCancel}
          style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        {syncError && <span style={{ fontSize: 11, color: "#ff4d6d" }}>{syncError}</span>}
      </div>
    </div>
  );
}
