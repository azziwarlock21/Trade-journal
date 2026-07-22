import { computePositionSize } from "../utils/calculations.js";

// ─── PositionCalculator ───────────────────────────────────────────────────
// Position tab: risk-based lot sizing for MGC/GC. Defaults to $50,000
// account and MGC contract (matches the trader's actual TopstepX setup).
// All state is owned by the parent and passed down so the values persist
// across tab switches without being reset.

export default function PositionCalculator({
  account, setAccount,
  risk, setRisk,
  entry, setEntry,
  sl, setSl,
  tp, setTp,
  direction, setDirection,
  contract, setContract,
}) {
  const accountNum = parseFloat(account) || 0;
  const riskPct = parseFloat(risk);
  const entryNum = parseFloat(entry);
  const slNum = parseFloat(sl);
  const tpNum = parseFloat(tp);

  const { pointValue, riskDollars, slPoints, tpPoints, lotSize, lossAmt, winAmt, rrr } =
    computePositionSize({ account: accountNum, riskPct, direction, entry: entryNum, sl: slNum, tp: tpNum, contract });

  const fmt = (n) => (n !== null && !isNaN(n) ? n.toFixed(2) : "--");
  const fmtDollar = (n) =>
    n !== null && !isNaN(n) ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";

  const cinp = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", color: "#e6edf3", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
  const clbl = { display: "block", fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 5 };

  const Card = ({ label, value, color, sub }) => (
    <div style={{ background: "#0d1117", border: `1px solid ${color}33`, borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
        GC Position Size Calculator
      </div>

      {/* Account + Risk */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Account Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={clbl}>Account Size ($)</label>
            <input type="number" value={account} onChange={e => setAccount(e.target.value)} placeholder="50000" style={cinp} />
          </div>
          <div>
            <label style={clbl}>Risk Per Trade</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["0.5", "1"].map(r => (
                <button key={r} onClick={() => setRisk(r)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${risk === r ? "#f5c842" : "#2a2f3a"}`, background: risk === r ? "rgba(245,200,66,0.12)" : "transparent", color: risk === r ? "#f5c842" : "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {r}%
                </button>
              ))}
              <input type="number" step="0.1" min="0.1" max="5" value={risk} onChange={e => setRisk(e.target.value)} style={{ ...cinp, width: 72, flexShrink: 0, fontSize: 13, textAlign: "center" }} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>RISK AMOUNT:</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#ff4d6d" }}>{fmtDollar(riskDollars)}</span>
          <span style={{ fontSize: 10, color: "#4b5563" }}>({risk}% of {fmtDollar(accountNum)})</span>
        </div>
      </div>

      {/* Trade inputs */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Trade Levels</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
          <div>
            <label style={clbl}>Contract</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["MGC", "GC"].map(c => (
                <button key={c} onClick={() => setContract(c)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${contract === c ? "#f5c842" : "#2a2f3a"}`, background: contract === c ? "rgba(245,200,66,0.12)" : "transparent", color: contract === c ? "#f5c842" : "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {c}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>${contract === "MGC" ? "10" : "100"}/pt per contract</div>
          </div>
          <div>
            <label style={clbl}>Direction</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Long", "Short"].map(d => (
                <button key={d} onClick={() => setDirection(d)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${direction === d ? (d === "Long" ? "#00e5a0" : "#ff4d6d") : "#2a2f3a"}`, background: direction === d ? (d === "Long" ? "rgba(0,229,160,0.1)" : "rgba(255,77,109,0.1)") : "transparent", color: direction === d ? (d === "Long" ? "#00e5a0" : "#ff4d6d") : "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={clbl}>Entry Price</label>
            <input type="number" step="0.1" value={entry} onChange={e => setEntry(e.target.value)} placeholder="2350.0" style={cinp} />
          </div>
          <div>
            <label style={clbl}>Stop Loss</label>
            <input type="number" step="0.1" value={sl} onChange={e => setSl(e.target.value)} placeholder="2340.0" style={{ ...cinp, border: "1px solid #ff4d6d44" }} />
          </div>
          <div>
            <label style={clbl}>Take Profit</label>
            <input type="number" step="0.1" value={tp} onChange={e => setTp(e.target.value)} placeholder="2375.0" style={{ ...cinp, border: "1px solid #00e5a044" }} />
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Card label="Lot Size" value={fmt(lotSize)} color="#f5c842" sub={`${contract} contracts to trade`} />
        <Card label="SL Distance" value={slPoints > 0 ? `${slPoints.toFixed(1)} pts` : "--"} color="#ff4d6d" sub={slPoints > 0 ? `${(slPoints * 10).toFixed(0)} ticks` : null} />
        <Card label="TP Distance" value={tpPoints > 0 ? `${tpPoints.toFixed(1)} pts` : "--"} color="#00e5a0" sub={tpPoints > 0 ? `${(tpPoints * 10).toFixed(0)} ticks` : null} />
        <Card label="RRR" value={rrr || "--"} color={parseFloat(rrr) >= 2 ? "#00e5a0" : parseFloat(rrr) >= 1 ? "#f5c842" : "#ff4d6d"} sub={rrr ? (parseFloat(rrr) >= 2 ? "✓ Meets minimum" : "⚠ Below 1:2 target") : null} />
        <Card label="Max Loss" value={fmtDollar(lossAmt)} color="#ff4d6d" sub={lossAmt ? `${risk}% of account` : null} />
        <Card label="Potential Win" value={fmtDollar(winAmt)} color="#00e5a0" sub={winAmt && lossAmt ? `${(winAmt / lossAmt).toFixed(1)}× your risk` : null} />
      </div>

      {/* Info box */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{contract} Contract Spec</div>
          <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.8 }}>
            {contract === "MGC"
              ? "1 lot = 10 troy oz · 1 point = $10 · 1 tick = $1"
              : "1 lot = 100 troy oz · 1 point = $100 · 1 tick = $10"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Formula</div>
          <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.8 }}>
            Lot Size = Risk $ ÷ (SL points × ${pointValue})
          </div>
        </div>
        {contract === "GC" && lotSize !== null && lotSize > 0 && (
          <div>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Micro Equivalent</div>
            <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.8 }}>
              MGC = {(lotSize * 10).toFixed(1)} contracts (1/10th size)
            </div>
          </div>
        )}
      </div>

      <button onClick={() => { setEntry(""); setSl(""); setTp(""); }} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
        CLEAR
      </button>
    </div>
  );
}
