import { useState, useEffect } from "react";

import { useTrades } from "./hooks/useTrades.js";
import { useFinancialData } from "./hooks/useFinancialData.js";
import { useTopstepXSync } from "./hooks/useTopstepXSync.js";
import { exportTradesCSV, importTradesCSV } from "./utils/csv.js";

import Header from "./components/Header.jsx";
import StreakBanner from "./components/StreakBanner.jsx";
import SyncStatusToast from "./components/SyncStatusToast.jsx";
import Lightbox from "./components/Lightbox.jsx";
import TradeForm from "./components/TradeForm.jsx";
import TradeList from "./components/TradeList.jsx";
import Analytics from "./components/Analytics.jsx";
import RulesChecklist from "./components/RulesChecklist.jsx";
import PositionCalculator from "./components/PositionCalculator.jsx";
import AICoach from "./components/AICoach.jsx";
import Payouts from "./components/Payouts.jsx";
import TaxEstimator from "./components/TaxEstimator.jsx";
import Expenses from "./components/Expenses.jsx";
import WeeklyReview from "./components/WeeklyReview.jsx";

// ═══════════════════════════════════════════════════════════════════════
// GC Futures Journal — App.jsx (Main Controller)
// ═══════════════════════════════════════════════════════════════════════
// This is the orchestrator: it owns view/navigation state, the lightbox,
// and the position-calculator inputs, and wires the useTrades /
// useFinancialData / useTopstepXSync hooks into the tab components below.
// All business logic (calculations, DB access, TSX sync pairing) lives in
// utils/ and api/ — this file should stay thin and mostly declarative.
//
// Phase 1 refactor note: this file replaces the previous single 3,360-line
// App_v2.jsx. Behavior is intended to be identical — see MIGRATION.md for
// the full before/after file map.
// ═══════════════════════════════════════════════════════════════════════

export default function GCJournal() {
  // ── Navigation (persisted across reloads) ────────────────────────────────
  const [view, setView] = useState(() => localStorage.getItem("gc_last_view") || "journal");
  const changeView = (v) => { setView(v); localStorage.setItem("gc_last_view", v); };

  // ── Lightbox ──────────────────────────────────────────────────────────────
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const openLightbox = (src) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);

  // ── Trades (form, list, CRUD, screenshots) ───────────────────────────────
  const trades = useTrades();

  // ── Financial data (payouts, expenses, tax, weekly review) ───────────────
  const fin = useFinancialData();

  // ── TopstepX sync ─────────────────────────────────────────────────────────
  const { syncStatus, setSyncStatus, syncRunning, triggerSync } = useTopstepXSync(trades.setTrades);
  useEffect(() => {
  triggerSync(false);

  const interval = setInterval(() => {
    triggerSync(false);
  }, 300000); // 5 minutes

  return () => clearInterval(interval);
}, []);

  // ── Analytics tab local state (mode/month filters + calendar) ────────────
  const [analyticsMode, setAnalyticsMode] = useState("All");
  const [analyticsMonth, setAnalyticsMonth] = useState("All");
  const [calendarDate, setCalendarDate] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [calendarDayFilter, setCalendarDayFilter] = useState(null);

  // ── Rules tab local state ─────────────────────────────────────────────────
  const [checkedRules, setCheckedRules] = useState({});

  // ── Position calculator local state ───────────────────────────────────────
  const [calcAccount, setCalcAccount] = useState("50000");
  const [calcRisk, setCalcRisk] = useState("0.5");
  const [calcEntry, setCalcEntry] = useState("");
  const [calcSL, setCalcSL] = useState("");
  const [calcTP, setCalcTP] = useState("");
  const [calcDirection, setCalcDirection] = useState("Long");
  const [calcContract, setCalcContract] = useState("MGC");

  // ── Keyboard shortcut: N = new trade ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && document.activeElement.tagName === "BODY") {
        changeView("journal");
        trades.resetForm();
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CSV handlers ───────────────────────────────────────────────────────────
  const handleExportCSV = () => exportTradesCSV(trades.trades);
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    trades.setSyncError("");
    try {
      const fresh = await importTradesCSV(file);
      if (fresh) trades.setTrades(fresh);
    } catch (err) {
      trades.setSyncError("Import failed: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  // ── Edit/duplicate need to switch to the Journal tab ──────────────────────
  const handleEditTrade = (t) => trades.editTrade(t, () => { changeView("journal"); window.scrollTo(0, 0); });
  const handleDuplicateTrade = (t) => trades.duplicateTrade(t, () => { changeView("journal"); window.scrollTo(0, 0); });

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace", background: "#070b12", minHeight: "100vh", color: "#e6edf3" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      <Lightbox src={lightboxSrc} onClose={closeLightbox} />

      <Header
        view={view}
        onViewChange={changeView}
        tradeCount={trades.trades.length}
        syncing={trades.syncing}
        syncError={trades.syncError}
        onExportCSV={handleExportCSV}
        onImportCSV={handleImportCSV}
        syncRunning={syncRunning}
        onSyncNew={() => triggerSync(false)}
        onSyncFull={() => {
          if (window.confirm("This clears the sync history and re-imports ALL trades from TopstepX. Continue?")) {
            triggerSync(true);
          }
        }}
      />

      <StreakBanner trades={trades.trades} />
      <SyncStatusToast syncStatus={syncStatus} onDismiss={() => setSyncStatus(null)} />

      {trades.loading && (
        <div style={{ textAlign: "center", padding: 80, color: "#f5c842", fontSize: 13 }}>
          <div style={{ marginBottom: 12, fontSize: 24 }}>⚡</div>
          Loading trades from cloud...
        </div>
      )}

      {!trades.loading && view === "journal" && (
        <TradeForm
          form={trades.form}
          set={trades.set}
          editId={trades.editId}
          resetForm={trades.resetForm}
          multiMode={trades.multiMode}
          setMultiMode={trades.setMultiMode}
          multiPositions={trades.multiPositions}
          setMultiPositions={trades.setMultiPositions}
          saveTrade={trades.saveTrade}
          saveMultiTrades={trades.saveMultiTrades}
          syncing={trades.syncing}
          syncError={trades.syncError}
          sessionOverridden={trades.sessionOverridden}
          setSessionOverridden={trades.setSessionOverridden}
          loadImageFile={trades.loadImageFile}
          openLightbox={openLightbox}
          pasteMode={trades.pasteMode}
          setPasteMode={trades.setPasteMode}
          handlePaste={trades.handlePaste}
          handleDrop={trades.handleDrop}
          handleDragOver={trades.handleDragOver}
          handleDragLeave={trades.handleDragLeave}
          isDragging={trades.isDragging}
        />
      )}

      {!trades.loading && view === "log" && (
        <TradeList
          trades={trades.trades}
          filterGrade={trades.filterGrade} setFilterGrade={trades.setFilterGrade}
          filterOutcome={trades.filterOutcome} setFilterOutcome={trades.setFilterOutcome}
          filterMode={trades.filterMode} setFilterMode={trades.setFilterMode}
          filterSearch={trades.filterSearch} setFilterSearch={trades.setFilterSearch}
          expandedId={trades.expandedId}
          onExpand={trades.handleExpand}
          selectedIds={trades.selectedIds}
          setSelectedIds={trades.setSelectedIds}
          bulkEditOpen={trades.bulkEditOpen}
          setBulkEditOpen={trades.setBulkEditOpen}
          bulkForm={trades.bulkForm}
          setBulkForm={trades.setBulkForm}
          onBulkApply={trades.saveBulkEdit}
          syncing={trades.syncing}
          syncError={trades.syncError}
          onDeleteAll={trades.deleteAllTrades}
          onDuplicate={handleDuplicateTrade}
          onEdit={handleEditTrade}
          onDelete={trades.deleteTrade}
          openLightbox={openLightbox}
        />
      )}

      {!trades.loading && view === "analytics" && (
        <Analytics
          trades={trades.trades}
          analyticsMode={analyticsMode} setAnalyticsMode={setAnalyticsMode}
          analyticsMonth={analyticsMonth} setAnalyticsMonth={setAnalyticsMonth}
          calendarDate={calendarDate} setCalendarDate={setCalendarDate}
          calendarDayFilter={calendarDayFilter} setCalendarDayFilter={setCalendarDayFilter}
        />
      )}

      {!trades.loading && view === "rules" && (
        <RulesChecklist checkedRules={checkedRules} setCheckedRules={setCheckedRules} />
      )}

      {!trades.loading && view === "calc" && (
        <PositionCalculator
          account={calcAccount} setAccount={setCalcAccount}
          risk={calcRisk} setRisk={setCalcRisk}
          entry={calcEntry} setEntry={setCalcEntry}
          sl={calcSL} setSl={setCalcSL}
          tp={calcTP} setTp={setCalcTP}
          direction={calcDirection} setDirection={setCalcDirection}
          contract={calcContract} setContract={setCalcContract}
        />
      )}

      {!trades.loading && view === "coach" && (
        <AICoach trades={trades.trades} setTrades={trades.setTrades} openLightbox={openLightbox} />
      )}

      {!trades.loading && view === "payouts" && (
        <Payouts
          trades={trades.trades}
          payouts={fin.payouts}
          expenses={fin.expenses}
          newPayout={fin.newPayout}
          setNewPayout={fin.setNewPayout}
          onSave={fin.savePayout}
          onDelete={fin.deletePayout}
        />
      )}

      {!trades.loading && view === "tax" && (
        <TaxEstimator
          payouts={fin.payouts}
          expenses={fin.expenses}
          armyIncome={fin.taxArmyIncome}
          setArmyIncome={fin.setTaxArmyIncome}
          filingStatus={fin.taxFilingStatus}
          setFilingStatus={fin.setTaxFilingStatus}
        />
      )}

      {!trades.loading && view === "expenses" && (
        <Expenses
          expenses={fin.expenses}
          newExpense={fin.newExpense}
          setNewExpense={fin.setNewExpense}
          onSave={fin.saveExpense}
          onDelete={fin.deleteExpense}
        />
      )}

      {!trades.loading && view === "review" && (
        <WeeklyReview
          weeklyReviews={fin.weeklyReviews}
          weeklyForm={fin.weeklyForm}
          setWeeklyForm={fin.setWeeklyForm}
          showWeeklyForm={fin.showWeeklyForm}
          setShowWeeklyForm={fin.setShowWeeklyForm}
          onSave={fin.saveWeeklyReview}
          onDelete={fin.deleteWeeklyReview}
        />
      )}

      <div style={{ textAlign: "center", padding: "20px", color: "#1f2937", fontSize: 9, letterSpacing: 3, marginTop: 16 }}>
        GC FUTURES JOURNAL · CLOUD SYNCED VIA SUPABASE · {trades.trades.length} TRADES
      </div>
    </div>
  );
}
