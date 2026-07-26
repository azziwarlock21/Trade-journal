import { useState, useEffect, useCallback } from "react";
import { dbLoadFinancial, dbSaveFinancial } from "../api/db.js";
import { DEFAULT_EXPENSES, emptyExpenseForm } from "../components/Expenses.jsx";
import { emptyPayoutForm } from "../components/Payouts.jsx";
import { emptyWeeklyForm } from "../components/WeeklyReview.jsx";

// ─── useFinancialData ─────────────────────────────────────────────────────
// Owns Payouts, Expenses, Tax Estimator inputs, and Weekly Reviews.
//
// Payouts/Expenses use a two-layer persistence strategy: localStorage first
// (instant, works offline) then Supabase sync_log table (cross-device).
// localStorage is always written synchronously before the network call so
// a page reload never loses data even if Supabase is slow or unreachable.
//
// Weekly Reviews are localStorage-only (personal reflection, not trade
// data — doesn't need cloud sync for this use case).

export function useFinancialData() {
  const [payouts, setPayouts] = useState([]);
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES);
  const [finLoaded, setFinLoaded] = useState(false);

  const [newPayout, setNewPayout] = useState(emptyPayoutForm());
  const [newExpense, setNewExpense] = useState(emptyExpenseForm());

  const [taxArmyIncome, setTaxArmyIncome] = useState(32000);
  const [taxFilingStatus, setTaxFilingStatus] = useState("single");

  const [weeklyReviews, setWeeklyReviews] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gc_weekly_reviews") || "[]"); }
    catch (e) { return []; }
  });
  const [showWeeklyForm, setShowWeeklyForm] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState(emptyWeeklyForm());

  // ── Load payouts/expenses: localStorage first, then Supabase ────────────
  useEffect(() => {
    const load = async () => {
      try {
        const lp = localStorage.getItem("gc_payouts");
        const le = localStorage.getItem("gc_expenses");
        if (lp) setPayouts(JSON.parse(lp));
        if (le) setExpenses(JSON.parse(le));
      } catch (e) { /* use defaults */ }

      try {
        const [pr, er] = await Promise.all([dbLoadFinancial("gc_payouts"), dbLoadFinancial("gc_expenses")]);
        if (pr) { const parsed = JSON.parse(pr); setPayouts(parsed); localStorage.setItem("gc_payouts", pr); }
        if (er) { const parsed = JSON.parse(er); setExpenses(parsed); localStorage.setItem("gc_expenses", er); }
      } catch (e) { /* stick with localStorage data */ }

      setFinLoaded(true);
    };
    load();
  }, []);

  const persist = useCallback(async (id, data) => {
    try { localStorage.setItem(id, JSON.stringify(data)); } catch (e) { /* ignore */ }
    try { await dbSaveFinancial(id, data); }
    catch (e) { console.warn(`Supabase sync failed for ${id}:`, e.message); }
  }, []);

  const savePayout = useCallback(async () => {
    if (!newPayout.date || !newPayout.amount) { alert("Fill in date and amount."); return; }
    const updated = [...payouts, { ...newPayout, id: Date.now(), amount: parseFloat(newPayout.amount) }];
    setPayouts(updated);
    await persist("gc_payouts", updated);
    setNewPayout(emptyPayoutForm());
  }, [payouts, newPayout, persist]);

  const deletePayout = useCallback(async (id) => {
    const updated = payouts.filter(p => p.id !== id);
    setPayouts(updated);
    await persist("gc_payouts", updated);
  }, [payouts, persist]);

  const saveExpense = useCallback(async () => {
    if (!newExpense.name || !newExpense.amount || !newExpense.startMonth) {
      alert("Fill in name, amount, and start month."); return;
    }
    const updated = [...expenses, { ...newExpense, id: Date.now(), amount: parseFloat(newExpense.amount) }];
    setExpenses(updated);
    await persist("gc_expenses", updated);
    setNewExpense(emptyExpenseForm());
  }, [expenses, newExpense, persist]);

  const deleteExpense = useCallback(async (id) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    await persist("gc_expenses", updated);
  }, [expenses, persist]);

  const saveWeeklyReview = useCallback(() => {
    if (!weeklyForm.week) { alert("Select the week first."); return; }
    const updated = [{ ...weeklyForm, id: Date.now() }, ...weeklyReviews.filter(r => r.week !== weeklyForm.week)];
    setWeeklyReviews(updated);
    localStorage.setItem("gc_weekly_reviews", JSON.stringify(updated));
    setShowWeeklyForm(false);
    setWeeklyForm(emptyWeeklyForm());
  }, [weeklyForm, weeklyReviews]);

  const deleteWeeklyReview = useCallback((id) => {
    setWeeklyReviews(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem("gc_weekly_reviews", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    payouts, expenses, finLoaded,
    newPayout, setNewPayout, savePayout, deletePayout,
    newExpense, setNewExpense, saveExpense, deleteExpense,
    taxArmyIncome, setTaxArmyIncome, taxFilingStatus, setTaxFilingStatus,
    weeklyReviews, showWeeklyForm, setShowWeeklyForm, weeklyForm, setWeeklyForm,
    saveWeeklyReview, deleteWeeklyReview,
  };
}
