import { calcExpenseTotal } from "../utils/finance.js";
import { estimateTax } from "../utils/finance.js";
import { labelStyle as lbl } from "../styles/formStyles.jsx";

const cinp = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", color: "#e6edf3", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };

const KEY_POINTS = [
  ["Futures = Section 1256", "GC (gold futures) contracts get 60/40 tax treatment — 60% taxed as long-term capital gains, 40% as short-term. This is more favorable than regular income. Your actual tax may be slightly lower than this estimate which uses ordinary income rates.", "#3b82f6"],
  ["Self-Employment Tax", "Trading income from a prop firm is generally treated as self-employment income. You pay 15.3% SE tax on it on top of federal income tax. Keep this number in mind — it catches most new traders off guard.", "#f97316"],
  ["Deductible Expenses", "Your TopstepX fees, API subscription, and trade copier costs are deductible business expenses. They reduce your taxable trading income, which is why we subtract them from payouts before calculating tax.", "#00e5a0"],
  ["Quarterly Estimated Taxes", "Since you're self-employed on the trading side, you should file quarterly estimated payments (Jan 15, Apr 15, Jun 15, Sep 15). If you don't, you may owe a penalty at year end.", "#a78bfa"],
  ["Tennessee Advantage", "Tennessee has no state income tax on wages or trading income. You keep more than traders in states like California or New York.", "#f5c842"],
];

// ─── TaxEstimator ─────────────────────────────────────────────────────────
// Estimates federal + self-employment tax owed on trading income, and
// shows how much to set aside from each payout. Uses `estimateTax` from
// finance.js for the actual bracket math — this component is display only.

export default function TaxEstimator({ payouts, expenses, armyIncome, setArmyIncome, filingStatus, setFilingStatus }) {
  const totalPayouts = payouts.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + calcExpenseTotal(e), 0);
  const tradingIncome = Math.max(0, totalPayouts - totalExpenses);
  const armyIncomeNum = parseFloat(armyIncome) || 0;

  const tax = estimateTax({ armyIncome: armyIncomeNum, tradingIncome, filingStatus });

  const perPayoutSave = payouts.map(p => ({ ...p, save: p.amount * tax.setAsideRate }));
  const totalShouldSave = totalPayouts * tax.setAsideRate;

  const fmt = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const fmtD = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cards = [
    ["Total Income", fmt(tax.totalIncome), "#e6edf3", "army + trading"],
    ["Standard Deduction", fmt(tax.standardDeduction), "#9ca3af", "2024 federal"],
    ["Taxable Income", fmt(tax.taxableIncome), "#f5c842", "after deduction"],
    ["Federal Tax", fmt(tax.fedTax), "#ff4d6d", "progressive brackets"],
    ["Self-Employ. Tax", fmt(tax.seTax), "#ff4d6d", "15.3% on trading income"],
    ["State Tax (TN)", "$0", "#00e5a0", "no income tax"],
    ["Total Tax Est.", fmt(tax.totalTax), "#ff4d6d", `${tax.effectiveRate.toFixed(1)}% effective rate`],
    ["Set Aside Rate", `${(tax.setAsideRate * 100).toFixed(1)}%`, "#a78bfa", "of each payout"],
    ["Save from Payouts", fmt(totalShouldSave), "#f5c842", `from ${fmtD(totalPayouts)} withdrawn`],
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Tax Estimator</div>
      <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 20 }}>
        Estimates based on 2024 US federal brackets + self-employment tax. Tennessee has no state income tax. Not tax advice — consult a CPA for your actual filing.
      </div>

      {/* Inputs */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Your Situation</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Army Base Pay (annual)</label>
            <input type="number" value={armyIncome} onChange={e => setArmyIncome(e.target.value)} style={cinp} />
            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>W-2 income — taxed normally</div>
          </div>
          <div>
            <label style={lbl}>Filing Status</label>
            <select value={filingStatus} onChange={e => setFilingStatus(e.target.value)} style={cinp}>
              <option value="single">Single</option>
              <option value="married">Married Filing Jointly</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Trading Income (auto)</label>
            <input readOnly value={fmtD(tradingIncome)} style={{ ...cinp, background: "#111827", border: "1px solid #00e5a044", color: "#f5c842", fontWeight: 700 }} />
            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>Payouts minus deductible expenses</div>
          </div>
        </div>
      </div>

      {/* Tax breakdown cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        {cards.map(([label, val, color, sub]) => (
          <div key={label} style={{ background: "#0d1117", border: label === "Total Tax Est." ? "1px solid #ff4d6d44" : label === "Save from Payouts" ? "1px solid #f5c84244" : "1px solid #1f2937", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
            {sub && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Per-payout savings guide */}
      {payouts.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Per-Payout Tax Reserve</div>
          <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 12 }}>
            Set aside {(tax.setAsideRate * 100).toFixed(1)}% of each payout. Keep in a separate savings account untouched until tax time.
          </div>
          {[...perPayoutSave].sort((a, b) => (b.date > a.date ? 1 : -1)).map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: i < perPayoutSave.length - 1 ? "1px solid #1f2937" : "none" }}>
              <span style={{ fontSize: 11, color: "#6b7280", minWidth: 90 }}>{p.date}</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{p.account || "—"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#00e5a0" }}>{fmtD(p.amount)}</span>
              <span style={{ fontSize: 10, color: "#4b5563" }}>→ save</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f5c842" }}>{fmtD(p.save)}</span>
              <span style={{ fontSize: 10, color: "#4b5563", marginLeft: "auto" }}>keep {fmtD(p.amount - p.save)}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(245,200,66,0.06)", border: "1px solid #f5c84233", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>Total you should have in tax reserve</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#f5c842" }}>{fmt(totalShouldSave)}</span>
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>
              This covers estimated federal tax + SE tax on your trading profits. File quarterly (Form 1040-ES) to avoid underpayment penalties.
            </div>
          </div>
        </div>
      )}

      {/* Key reminders */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Key Points for Your Situation</div>
        {KEY_POINTS.map(([title, body, color]) => (
          <div key={title} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
