import { calcExpenseTotal } from "../utils/finance.js";
import { labelStyle as lbl } from "../styles/formStyles.jsx";
import PayoutEligibilityTracker from "./PayoutEligibilityTracker.jsx";

const cinp = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", color: "#e6edf3", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };

// ─── Payouts ──────────────────────────────────────────────────────────────
// Tracks prop firm payouts and shows Net Profit (payouts minus expenses)
// as motivation. Uses `calcExpenseTotal` from finance.js so this stays in
// sync with whatever the Expenses tab has recorded. Also shows the
// TopstepX payout eligibility tracker (5 days at $150+ net) using `trades`.

export default function Payouts({ trades, payouts, expenses, newPayout, setNewPayout, onSave, onDelete }) {
  const totalPaidOut = payouts.reduce((s, p) => s + (p.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + calcExpenseTotal(e), 0);
  const net = totalPaidOut - totalExpenses;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>Payouts</div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          ["Total Withdrawn", `$${totalPaidOut.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#00e5a0"],
          ["Total Expenses", `$${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "#ff4d6d"],
          ["Net Profit", `${net >= 0 ? "+" : ""}$${Math.abs(net).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, net >= 0 ? "#00e5a0" : "#ff4d6d"],
          ["Payouts Count", payouts.length, "#f5c842"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      <PayoutEligibilityTracker trades={trades} />

      {/* Add payout */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Log a Payout</div>
        <div style={{ display: "grid", gridTemplateColumns: "160px 140px 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>Date</label><input type="date" value={newPayout.date} onChange={e => setNewPayout(p => ({ ...p, date: e.target.value }))} style={cinp} /></div>
          <div><label style={lbl}>Amount ($)</label><input type="number" step="0.01" value={newPayout.amount} onChange={e => setNewPayout(p => ({ ...p, amount: e.target.value }))} placeholder="1250.00" style={cinp} /></div>
          <div><label style={lbl}>Account</label><input value={newPayout.account} onChange={e => setNewPayout(p => ({ ...p, account: e.target.value }))} placeholder="e.g. 150k TopstepX" style={cinp} /></div>
          <div><label style={lbl}>Notes</label><input value={newPayout.notes} onChange={e => setNewPayout(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" style={cinp} /></div>
          <button onClick={onSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#f5c842,#ff9a3c)", color: "#070b12", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Add</button>
        </div>
      </div>

      {/* Payout list */}
      {payouts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#4b5563", fontSize: 12 }}>No payouts logged yet.</div>
      ) : (
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden" }}>
          {[...payouts].sort((a, b) => (b.date > a.date ? 1 : -1)).map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: i < payouts.length - 1 ? "1px solid #1f2937" : "none", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#6b7280", minWidth: 90 }}>{p.date}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#00e5a0" }}>${parseFloat(p.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              {p.account && <span style={{ fontSize: 11, color: "#9ca3af" }}>{p.account}</span>}
              {p.notes && <span style={{ fontSize: 11, color: "#4b5563" }}>{p.notes}</span>}
              <button onClick={() => onDelete(p.id)} style={{ marginLeft: "auto", fontSize: 10, color: "#ff4d6d", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const emptyPayoutForm = () => ({ date: "", amount: "", account: "", notes: "" });
