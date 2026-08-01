import { useState, useEffect, useCallback } from "react";
import {
  dbFetchAll, dbFetchScreenshots, dbInsert, dbUpdate, dbDelete, dbDeleteAll, compressImage,
} from "../api/db.js";
import {
  defaultForm, detectSession, detectNewsEvent,
  calcPointsFromOutcome, calcRRRFromOutcome,
} from "../utils/helpers.js";
import { emptyBulkForm } from "../components/BulkEditModal.jsx";

const SL_DIST_POINTS = 15; // $150 risk / $10 per point (MGC) for the 50k account, 1 contract

// ─── useTrades ────────────────────────────────────────────────────────────
// The single source of truth for all trade data and mutation logic. Owns:
//   - the trade list itself (loaded from Supabase on mount)
//   - the single-trade form state + auto-calculation (`set`)
//   - multi-position batch entry state
//   - screenshot upload/paste/drag handling
//   - log tab selection + bulk edit
//
// TradeForm, TradeList, Analytics, and AICoach all consume this hook's
// return value rather than owning their own copies of trade state, so
// there is exactly one place trades can be mutated.

export function useTrades() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const [form, setForm] = useState(defaultForm());
  const [editId, setEditId] = useState(null);
  const [sessionOverridden, setSessionOverridden] = useState(false);

  const [multiMode, setMultiMode] = useState(false);
  const [multiPositions, setMultiPositions] = useState([
    { entryDatetime: "", exitDatetime: "", entryPrice: "", maePrice: "", notes: "" },
    { entryDatetime: "", exitDatetime: "", entryPrice: "", maePrice: "", notes: "" },
  ]);

  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);

  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm());

  const [filterGrade, setFilterGrade] = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");
  const [filterMode, setFilterMode] = useState("All");
  const [filterSearch, setFilterSearch] = useState("");

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    dbFetchAll()
      .then(rows => {
  console.log("Loaded from Supabase:", rows[0]);
  setTrades(rows);
  setSyncError("");
})
      .catch(e => setSyncError("Could not connect to database: " + e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Form field setter with auto-calculation ─────────────────────────────
  // Handles: session/news auto-detect on entry datetime change, auto SL
  // (fixed $150 risk system), and live points/RRR recalculation.
  const set = useCallback((k, v) => {
    if (k === "session") setSessionOverridden(true);
    setForm(f => {
      const next = { ...f, [k]: v };

      if (k === "entryDatetime") {
        if (!f.exitDatetime || f.exitDatetime === f.entryDatetime) next.exitDatetime = v;
        if (!sessionOverridden) {
          const detected = detectSession(v);
          if (detected) next.session = detected;
        }
        const newsMatch = detectNewsEvent(v);
        next.news = newsMatch ? newsMatch.event : "None";
        next.newsImpact = newsMatch ? newsMatch.impact : "Low";
      }

      const entry = parseFloat(next.entryPrice);

      // Auto SL: 15 points from entry (= $150 at $10/pt for MGC), rounded to whole number
      if ((k === "entryPrice" || k === "direction") && !isNaN(entry) && next.direction) {
        next.stopLoss = next.direction === "Long"
          ? Math.round(entry - SL_DIST_POINTS).toString()
          : Math.round(entry + SL_DIST_POINTS).toString();
      }

      const slCalc = parseFloat(next.stopLoss);
      const tp = parseFloat(next.takeProfit);
      if (!isNaN(entry) && !isNaN(slCalc)) {
        next.points = calcPointsFromOutcome(entry, slCalc, isNaN(tp) ? null : tp, next.direction, next.outcome);
        next.rrr = calcRRRFromOutcome(entry, slCalc, isNaN(tp) ? null : tp, next.direction, next.outcome);
      }

      // MAE (Max Adverse Excursion): worst price against the position.
      // Long: entry minus the low reached. Short: the high reached minus entry.
      if (next.maePrice && !isNaN(entry) && next.direction) {
        const maeP = parseFloat(next.maePrice);
        if (!isNaN(maeP)) {
          const raw = next.direction === "Long" ? entry - maeP : maeP - entry;
          next.mae = raw > 0 ? raw.toFixed(1) : "0.0";
        }
      }

      // MFE (Max Favorable Excursion): best price reached in the position's
      // favor, even if the trade didn't close there. Long: high minus entry.
      // Short: entry minus the low reached. Same pattern as MAE, opposite side.
      if (next.mfePrice && !isNaN(entry) && next.direction) {
        const mfeP = parseFloat(next.mfePrice);
        if (!isNaN(mfeP)) {
          const raw = next.direction === "Long" ? mfeP - entry : entry - mfeP;
          next.mfe = raw > 0 ? raw.toFixed(1) : "0.0";
        }
      }

      return next;
    });
  }, [sessionOverridden]);

  // ── Screenshot handling ──────────────────────────────────────────────────
  const loadImageFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result);
      setForm(f => ({ ...f, screenshots: [...(f.screenshots || []), { data: compressed, name: file.name }] }));
    };
    reader.readAsDataURL(file);
  }, []);

  const pasteTargetInnerHTMLReset = useCallback((ref) => { if (ref?.current) ref.current.innerHTML = ""; }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        loadImageFile(items[i].getAsFile());
        setPasteMode(false);
        break;
      }
    }
  }, [loadImageFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => loadImageFile(f));
  }, [loadImageFile]);
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  // ── Lazy-load screenshots when a log row is expanded ────────────────────
  const handleExpand = useCallback(async (id) => {
    setExpandedId(prev => (prev === id ? null : id));
    const trade = trades.find(t => t.id === id);
    if (trade && !trade.screenshotsLoaded && expandedId !== id) {
      try {
        const shots = await dbFetchScreenshots(id);
        setTrades(ts => ts.map(t => (t.id === id ? { ...t, screenshots: shots, screenshotsLoaded: true } : t)));
      } catch (e) { /* silent — screenshots just won't show */ }
    }
  }, [trades, expandedId]);

  // ── Form lifecycle ───────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setEditId(null);
    setForm(defaultForm());
    setSessionOverridden(false);
  }, []);

  // ── Save (single) ────────────────────────────────────────────────────────
  const saveTrade = useCallback(async () => {
    if (!form.entryDatetime || !form.direction || !form.tradeType) {
      alert("Please fill in Entry Date/Time, Direction, and Trade Type at minimum.");
      return;
    }
    setSyncing(true); setSyncError("");
    try {
      if (editId !== null) {
        const updated = { ...form, id: editId };
        await dbUpdate(updated);
        setTrades(ts => ts.map(t => (t.id === editId ? updated : t)));
      } else {
        const newTrade = { ...form, id: Date.now() };
        await dbInsert(newTrade);
        setTrades(ts => [newTrade, ...ts]);
      }
      resetForm();
    } catch (e) { setSyncError("Save failed: " + e.message); }
    finally { setSyncing(false); }
  }, [form, editId, resetForm]);

  // ── Save (multi-position batch) ──────────────────────────────────────────
  const saveMultiTrades = useCallback(async () => {
    const valid = multiPositions.filter(p => p.entryPrice && p.entryDatetime);
    if (!valid.length) { alert("Fill in Entry Time and Entry Price for at least one row."); return; }
    if (!form.direction || !form.tradeType) { alert("Please fill in Direction and Trade Type in the shared fields above."); return; }

    setSyncing(true); setSyncError("");
    try {
      const inserted = [];
      for (let i = 0; i < valid.length; i++) {
        const pos = valid[i];
        const ep = parseFloat(pos.entryPrice);
        const sl = parseFloat(form.stopLoss);
        const tp = parseFloat(form.takeProfit);
        const dir = form.direction;

        let outcome = "Win";
        if (!isNaN(ep) && !isNaN(sl) && !isNaN(tp)) {
          outcome = dir === "Long" ? (tp > ep ? "Win" : "Loss") : (tp < ep ? "Win" : "Loss");
        }

        const pts = (!isNaN(ep) && !isNaN(sl) && !isNaN(tp)) ? calcPointsFromOutcome(ep, sl, tp, dir, outcome) : "";
        const rr = (!isNaN(ep) && !isNaN(sl) && !isNaN(tp)) ? calcRRRFromOutcome(ep, sl, tp, dir, outcome) : "";

        const maeP = parseFloat(pos.maePrice);
        let mae = "";
        if (!isNaN(maeP) && !isNaN(ep)) {
          const raw = dir === "Long" ? (ep - maeP) : (maeP - ep);
          mae = raw > 0 ? raw.toFixed(1) : "0.0";
        }

        const session = sessionOverridden ? form.session : (detectSession(pos.entryDatetime) || form.session);
        const newsMatch = detectNewsEvent(pos.entryDatetime);

        const trade = {
          ...form,
          id: Date.now() + i * 1000 + Math.floor(Math.random() * 999),
          entryDatetime: pos.entryDatetime,
          exitDatetime: pos.exitDatetime || pos.entryDatetime,
          entryPrice: pos.entryPrice,
          session,
          news: newsMatch ? newsMatch.event : "None",
          newsImpact: newsMatch ? newsMatch.impact : "Low",
          points: pts,
          rrr: rr,
          mae,
          maePrice: pos.maePrice || "",
          outcome,
          notes: pos.notes ? `${pos.notes}${form.notes ? ` | ${form.notes}` : ""}` : (form.notes || ""),
          screenshots: [], // attached to individual trades after logging
        };
        await dbInsert(trade);
        inserted.push(trade);
      }
      setTrades(ts => [...inserted.reverse(), ...ts]);
      setMultiPositions([
        { entryDatetime: "", exitDatetime: "", entryPrice: "", maePrice: "", notes: "" },
        { entryDatetime: "", exitDatetime: "", entryPrice: "", maePrice: "", notes: "" },
      ]);
      setSyncError("");
    } catch (e) { setSyncError("Save failed: " + e.message); }
    finally { setSyncing(false); }
  }, [multiPositions, form, sessionOverridden]);

  // ── Edit / duplicate ──────────────────────────────────────────────────────
  const editTrade = useCallback((t, navigateToJournal) => {
    setForm({ ...t });
    setEditId(t.id);
    setSessionOverridden(true);
    if (navigateToJournal) navigateToJournal();
  }, []);

  const duplicateTrade = useCallback((t, navigateToJournal) => {
    const { id, screenshots, entryDatetime, exitDatetime, points, rrr, outcome, notes, mae, maePrice, mfe, mfePrice, executionGrade, ...rest } = t;
    setForm({
      ...defaultForm(), ...rest,
      entryDatetime: "", exitDatetime: "", points: "", rrr: "", outcome: "Win",
      notes: "", mae: "", maePrice: "", mfe: "", mfePrice: "", executionGrade: "Ungraded", screenshots: [],
    });
    setEditId(null);
    setSessionOverridden(true);
    if (navigateToJournal) navigateToJournal();
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteTrade = useCallback(async (id) => {
    if (!window.confirm("Delete this trade?")) return;
    setSyncing(true);
    try { await dbDelete(id); setTrades(ts => ts.filter(t => t.id !== id)); }
    catch (e) { setSyncError("Delete failed: " + e.message); }
    finally { setSyncing(false); }
  }, []);

  const deleteAllTrades = useCallback(async () => {
    if (!window.confirm("Delete ALL trades? This cannot be undone.")) return;
    setSyncing(true);
    try { await dbDeleteAll(); setTrades([]); setExpandedId(null); }
    catch (e) { setSyncError("Delete all failed: " + e.message); }
    finally { setSyncing(false); }
  }, []);

  // ── Bulk edit ─────────────────────────────────────────────────────────────
  const saveBulkEdit = useCallback(async () => {
    if (!selectedIds.size) return;
    const updates = Object.fromEntries(Object.entries(bulkForm).filter(([, v]) => v !== "" && v !== null));
    if (!Object.keys(updates).length) { alert("Fill in at least one field to apply."); return; }

    setSyncing(true); setSyncError("");
    try {
      const updatedTrades = [];
      for (const id of selectedIds) {
        const existing = trades.find(t => t.id === id);
        if (!existing) continue;
        const merged = { ...existing, ...updates };
        const ep = parseFloat(merged.entryPrice);
        const sl = parseFloat(merged.stopLoss);
        const tp = parseFloat(merged.takeProfit);
        if (!isNaN(ep) && !isNaN(sl) && !isNaN(tp) && merged.direction) {
          merged.points = calcPointsFromOutcome(ep, sl, tp, merged.direction, merged.outcome);
          merged.rrr = calcRRRFromOutcome(ep, sl, tp, merged.direction, merged.outcome);
        }
        await dbUpdate(merged);
        updatedTrades.push(merged);
      }
      setTrades(ts => ts.map(t => updatedTrades.find(u => u.id === t.id) || t));
      setSelectedIds(new Set());
      setBulkEditOpen(false);
      setBulkForm(emptyBulkForm());
    } catch (e) { setSyncError("Bulk save failed: " + e.message); }
    finally { setSyncing(false); }
  }, [selectedIds, bulkForm, trades]);

  return {
    // data
    trades, setTrades, loading, syncing, syncError, setSyncError,
    // single-trade form
    form, set, editId, resetForm, sessionOverridden, setSessionOverridden,
    saveTrade, editTrade, duplicateTrade, deleteTrade, deleteAllTrades,
    // multi-position
    multiMode, setMultiMode, multiPositions, setMultiPositions, saveMultiTrades,
    // screenshots
    isDragging, pasteMode, setPasteMode, loadImageFile,
    handlePaste, handleDrop, handleDragOver, handleDragLeave,
    // log tab
    expandedId, handleExpand,
    selectedIds, setSelectedIds, bulkEditOpen, setBulkEditOpen, bulkForm, setBulkForm, saveBulkEdit,
    filterGrade, setFilterGrade, filterOutcome, setFilterOutcome,
    filterMode, setFilterMode, filterSearch, setFilterSearch,
  };
}
