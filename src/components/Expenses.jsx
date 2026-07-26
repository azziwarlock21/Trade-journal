import { calcExpenseMonths, calcExpenseTotal } from "../utils/finance.js";
import { labelStyle as lbl } from "../styles/formStyles.jsx";

const cinp = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", color: "#e6edf3", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = [2024, 2025, 2026, 2027];

// ─── Expenses ─────────────────────────────────────────────────────────────
// Tracks recurring (monthly) and one-time trading-related costs. Totals
// update automatically each month via calcExpenseMonths/calcExpenseTotal —
// no manual recalculation needed. Month/year use two dropdowns instead of
// a native <input type="month"> since that control renders inconsistently
// (text field, not a picker) on desktop browsers.

export default function Expenses({ expenses, newExpense, setNewExpense, onSave, onDelete }) {
  const totalExpenses = expenses.reduce((s, e) => s + calcExpenseTotal(e), 0);
  const monthlyRecurring = expenses.filter(e => e.monthly).reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Expenses</div>
      <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 20 }}>Tracks recurring and one-time costs. Totals update automatically each month.</div>

      {/* Total card */}
      <div style={{ background: "#0d1117", border: "1px solid #ff4d6d33", borderRadius: 12, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Total Spent to Date</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ff4d6d" }}>${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ borderLeft: "1px solid #1f2937", paddingLeft: 24 }}>
          <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Monthly Recurring</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f5c842" }}>${monthlyRecurring.toFixed(2)}/mo</div>
        </div>
        <div style={{ borderLeft: "1px solid #1f2937", paddingLeft: 24 }}>
          <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Active Items</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e6edf3" }}>{expenses.length}</div>
        </div>
      </div>

      {/* Expense list */}
      {expenses.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          {expenses.map((e, i) => {
            const months = calcExpenseMonths(e);
            const total = calcExpenseTotal(e);
            const startLabel = new Date(e.startMonth + "-02").toLocaleString("en-US", { month: "short", year: "numeric" });
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i < expenses.length - 1 ? "1px solid #1f2937" : "none", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e6edf3", marginBottom: 3 }}>{e.name}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>
                    Started {startLabel} · {e.monthly ? `${months} month${months !== 1 ? "s" : ""}` : "one-time"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>${e.amount.toFixed(2)}{e.monthly ? "/mo" : ""}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ff4d6d" }}>${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} total</div>
                </div>
                <button onClick={() => onDelete(e.id)} style={{ fontSize: 10, color: "#ff4d6d", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Remove</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add expense */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Add Expense</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 200px auto auto", gap: 10, alignItems: "end" }}>
          <div><label style={lbl}>Name</label><input value={newExpense.name} onChange={e => setNewExpense(p => ({ ...p, name: e.target.value }))} placeholder="e.g. TopstepX API" style={cinp} /></div>
          <div><label style={lbl}>Amount ($)</label><input type="number" step="0.01" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} placeholder="29.00" style={cinp} /></div>
          <div>
            <label style={lbl}>Start Month</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select
                value={newExpense.startMonth ? newExpense.startMonth.split("-")[1] : ""}
                onChange={e => {
                  const yr = newExpense.startMonth ? newExpense.startMonth.split("-")[0] : new Date().getFullYear();
                  setNewExpense(p => ({ ...p, startMonth: e.target.value ? `${yr}-${e.target.value}` : "" }));
                }}
                style={{ ...cinp, flex: 1 }}>
                <option value="">Month</option>
                {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_LABELS[i]}</option>)}
              </select>
              <select
                value={newExpense.startMonth ? newExpense.startMonth.split("-")[0] : ""}
                onChange={e => {
                  const mo = newExpense.startMonth ? newExpense.startMonth.split("-")[1] : "01";
                  setNewExpense(p => ({ ...p, startMonth: e.target.value ? `${e.target.value}-${mo}` : "" }));
                }}
                style={{ ...cinp, flex: 1 }}>
                <option value="">Year</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={lbl}>Type</label>
            <div style={{ display: "flex", gap: 0, borderRadius: 7, overflow: "hidden", border: "1px solid #2a2f3a" }}>
              {["Monthly", "One-time"].map(t => (
                <button key={t} onClick={() => setNewExpense(p => ({ ...p, monthly: t === "Monthly" }))}
                  style={{ padding: "8px 12px", border: "none", background: (t === "Monthly") === newExpense.monthly ? "rgba(245,200,66,0.15)" : "transparent", color: (t === "Monthly") === newExpense.monthly ? "#f5c842" : "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#f5c842,#ff9a3c)", color: "#070b12", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", alignSelf: "end" }}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_EXPENSES = [
  { id: 1, name: "TopstepX 150k Account (Activation)", amount: 167, startMonth: "2026-04", monthly: true },
  { id: 2, name: "TopstepX 50k Account (Trade Copier)", amount: 50, startMonth: "2026-04", monthly: true },
  { id: 3, name: "TopstepX API Subscription", amount: 29, startMonth: "2026-05", monthly: true },
];

export const emptyExpenseForm = () => ({ name: "", amount: "", startMonth: "", monthly: true });
