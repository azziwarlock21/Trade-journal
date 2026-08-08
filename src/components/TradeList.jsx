import { useMemo } from "react";
import { GRADES, TRADE_MODES } from "../utils/constants.js";
import {
  calcDuration, formatDate, formatDatetime,
  gradeColor, outcomeColor, modeColor,
} from "../utils/helpers.js";
import BulkEditModal, { emptyBulkForm } from "./BulkEditModal.jsx";
import GeneratedChart from "./GeneratedChart.jsx";

// ─── TradeList ────────────────────────────────────────────────────────────
// Log tab: filterable, searchable list of trades grouped by day. Supports
// multi-select (individual + select-all-for-day) feeding into BulkEditModal,
// expandable rows for full trade detail, and per-row Copy/Edit/Delete
// actions. All data mutation (dbUpdate, dbDelete, etc.) lives in the parent
// — this component only renders and reports user intent via callback props.

export default function TradeList({
  trades,
  filterGrade, setFilterGrade,
  filterOutcome, setFilterOutcome,
  filterMode, setFilterMode,
  filterSearch, setFilterSearch,
  expandedId, onExpand,
  selectedIds, setSelectedIds,
  bulkEditOpen, setBulkEditOpen,
  bulkForm, setBulkForm,
  onBulkApply, syncing, syncError,
  onDeleteAll, onDuplicate, onEdit, onDelete,
  openLightbox,
  onUpdateTrade,
}) {
  const filteredTrades = useMemo(() => {
    return trades
      .filter(t => filterGrade === "All" || t.grade === filterGrade)
      .filter(t => filterOutcome === "All" || t.outcome === filterOutcome)
      .filter(t => filterMode === "All" || (t.tradeMode || "Backtest") === filterMode)
      .filter(t => !filterSearch ||
        (t.notes || "").toLowerCase().includes(filterSearch.toLowerCase()) ||
        (t.tradeType || "").toLowerCase().includes(filterSearch.toLowerCase()) ||
        (t.candlePattern || "").toLowerCase().includes(filterSearch.toLowerCase()))
      .sort((a, b) => (a.entryDatetime < b.entryDatetime ? 1 : -1));
  }, [trades, filterGrade, filterOutcome, filterMode, filterSearch]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredTrades.forEach(t => {
      const d = t.entryDatetime ? t.entryDatetime.split("T")[0] : "Unknown";
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTrades]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectDay = (dayTrades, allSelected) => {
    const ids = dayTrades.map(t => t.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const cancelBulkEdit = () => {
    setBulkEditOpen(false);
    setBulkForm(emptyBulkForm());
  };

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px" }}>

      {/* ── Filters + search ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>FILTER:</span>
        {[
          { val: filterGrade, set: setFilterGrade, opts: ["All Grades", ...GRADES] },
          { val: filterOutcome, set: setFilterOutcome, opts: ["All Outcomes", "Win", "Loss", "Breakeven"] },
          { val: filterMode, set: setFilterMode, opts: ["All Modes", ...TRADE_MODES] },
        ].map(({ val, set: setter, opts }, i) => (
          <select key={i} value={val} onChange={e => setter(e.target.value)} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 10px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit" }}>
            {opts.map(o => <option key={o} value={o.startsWith("All") ? "All" : o}>{o}</option>)}
          </select>
        ))}
        <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search notes, type, pattern..." style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 12px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit", minWidth: 200 }} />
        <span style={{ fontSize: 10, color: "#6b7280" }}>{filteredTrades.length} trades</span>

        {selectedIds.size > 0 && (
          <>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#f5c842" }}>{selectedIds.size} selected</span>
            <button onClick={() => setBulkEditOpen(o => !o)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #f5c84244", background: bulkEditOpen ? "rgba(245,200,66,0.12)" : "rgba(245,200,66,0.06)", color: "#f5c842", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {bulkEditOpen ? "Close Bulk Edit" : "Bulk Edit"}
            </button>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
          </>
        )}

        {trades.length > 0 && (
          <button onClick={onDeleteAll} style={{ marginLeft: selectedIds.size > 0 ? 0 : "auto", padding: "6px 14px", borderRadius: 7, border: "1px solid #ff4d6d55", background: "rgba(255,77,109,0.07)", color: "#ff4d6d", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Delete All
          </button>
        )}
      </div>

      {/* ── Bulk edit panel ── */}
      {bulkEditOpen && selectedIds.size > 0 && (
        <BulkEditModal
          selectedCount={selectedIds.size}
          bulkForm={bulkForm}
          setBulkForm={setBulkForm}
          onApply={onBulkApply}
          onCancel={cancelBulkEdit}
          syncing={syncing}
          syncError={syncError}
        />
      )}

      {/* ── Grouped trade list ── */}
      {filteredTrades.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 13 }}>No trades found.</div>
      ) : (
        <div>
          {groupedByDate.map(([date, dayTrades]) => {
            const dayPts = dayTrades.reduce((a, t) => a + (parseFloat(t.points) || 0), 0);
            const dayWins = dayTrades.filter(t => t.outcome === "Win").length;
            const dayAllSelected = dayTrades.every(t => selectedIds.has(t.id));

            return (
              <div key={date} style={{ marginBottom: 20 }}>
                {/* Daily header */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", background: "#0d1117", borderRadius: "10px 10px 0 0", border: "1px solid #1f2937", borderBottom: "none" }}>
                  <div
                    onClick={() => toggleSelectDay(dayTrades, dayAllSelected)}
                    style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${dayAllSelected ? "#f5c842" : "#2a2f3a"}`, background: dayAllSelected ? "rgba(245,200,66,0.2)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {dayAllSelected && <span style={{ fontSize: 9, color: "#f5c842", fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f5c842" }}>{formatDate(date + "T00:00")}</span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{dayTrades.length} trades</span>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{dayWins}W / {dayTrades.length - dayWins}L</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: dayPts >= 0 ? "#00e5a0" : "#ff4d6d" }}>
                    {dayPts >= 0 ? "+" : ""}{dayPts.toFixed(1)} pts
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {dayTrades.map(t => (
                    <TradeRow
                      key={t.id}
                      t={t}
                      isSelected={selectedIds.has(t.id)}
                      isExpanded={expandedId === t.id}
                      onToggleSelect={() => toggleSelect(t.id)}
                      onExpand={() => onExpand(t.id)}
                      onDuplicate={() => onDuplicate(t)}
                      onEdit={() => onEdit(t)}
                      onDelete={() => onDelete(t.id)}
                      openLightbox={openLightbox}
                      onUpdateTrade={onUpdateTrade}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TradeRow ─────────────────────────────────────────────────────────────
// Single trade row: collapsed summary + expandable detail panel.
function TradeRow({ t, isSelected, isExpanded, onToggleSelect, onExpand, onDuplicate, onEdit, onDelete, openLightbox, onUpdateTrade }) {
  return (
    <div style={{ background: isSelected ? "rgba(245,200,66,0.03)" : "#0d1117", border: `1px solid ${isSelected ? "#f5c84233" : "#1f2937"}`, borderTop: "none", overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          onClick={e => { e.stopPropagation(); onToggleSelect(); }}
          style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? "#f5c842" : "#2a2f3a"}`, background: isSelected ? "rgba(245,200,66,0.2)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isSelected && <span style={{ fontSize: 9, color: "#f5c842", fontWeight: 900 }}>✓</span>}
        </div>

        <div onClick={onExpand} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#6b7280", minWidth: 50 }}>{t.entryDatetime ? t.entryDatetime.split("T")[1]?.slice(0, 5) : "--"}</span>
          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: modeColor(t.tradeMode || "Backtest") + "18", color: modeColor(t.tradeMode || "Backtest") }}>{t.tradeMode || "BT"}</span>
          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: t.direction === "Long" ? "rgba(0,229,160,0.1)" : "rgba(255,77,109,0.1)", color: t.direction === "Long" ? "#00e5a0" : "#ff4d6d" }}>{t.direction || "--"}</span>
          <span style={{ fontSize: 11, color: "#e6edf3", minWidth: 70 }}>{t.tradeType || "--"}</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{t.candlePattern || "--"}</span>
          <span style={{ fontSize: 10, color: "#6b7280" }}>{t.session || "--"}</span>
          {t.htfBias && <span style={{ fontSize: 10, color: t.htfBias === "Bullish" ? "#00e5a0" : t.htfBias === "Bearish" ? "#ff4d6d" : "#f5c842" }}>{t.htfBias}</span>}
          <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 12, color: parseFloat(t.points) >= 0 ? "#00e5a0" : "#ff4d6d" }}>{t.points ? `${t.points}pts` : "--"}</span>
          <span style={{ fontSize: 11, color: parseFloat(t.rrr) >= 2 ? "#00e5a0" : parseFloat(t.rrr) > 0 ? "#f5c842" : "#ff4d6d" }}>RRR:{t.rrr || "--"}</span>
          <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${gradeColor(t.grade)}22`, color: gradeColor(t.grade) }} title="Setup grade">{t.grade}</span>
          <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${gradeColor(t.executionGrade || "Ungraded")}15`, color: gradeColor(t.executionGrade || "Ungraded"), border: `1px solid ${gradeColor(t.executionGrade || "Ungraded")}44` }} title="Execution grade">E:{t.executionGrade || "?"}</span>
          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${outcomeColor(t.outcome)}22`, color: outcomeColor(t.outcome) }}>{t.outcome}</span>
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }} title="Duplicate setup">Copy</button>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ff4d6d44", background: "transparent", color: "#ff4d6d", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Del</button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ borderTop: "1px solid #1f2937", padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 }}>
          {[
            ["Entry", formatDatetime(t.entryDatetime)],
            ["Exit", formatDatetime(t.exitDatetime)],
            ["Duration", calcDuration(t.entryDatetime, t.exitDatetime)],
            ["Session", t.session],
            ["HTF Bias", t.htfBias],
            ["Market Structure", t.marketStructure],
            ["Lot Size", t.lotSize],
            ["Entry Price", t.entryPrice],
            ["Stop Loss", t.stopLoss],
            ["Take Profit", t.takeProfit],
            ["MAE", t.mae ? t.mae + " pts" : ""],
            ["MFE", t.mfe ? t.mfe + " pts" : ""],
            ["Wick", t.wickDirection !== "None" ? t.wickDirection : ""],
            ["News", t.news !== "None" ? t.news : ""],
            ["News Impact", t.news !== "None" ? t.newsImpact : ""],
            ["Setup Grade", t.grade],
            ["Exec Grade", t.executionGrade || "Ungraded"],
          ].map(([k, v]) => v ? (
            <div key={k}>
              <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 12, color: "#e6edf3" }}>{v}</div>
            </div>
          ) : null)}

          {t.notes && (
            <div style={{ gridColumn: "1/-1" }}>
              <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{t.notes}</div>
            </div>
          )}

          {t.screenshots?.length > 0 && (
            <div style={{ gridColumn: "1/-1" }}>
              <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Screenshots ({t.screenshots.length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                {t.screenshots.map((ss, idx) => (
                  <img key={idx} src={ss.data} alt={ss.name} onClick={() => openLightbox(ss.data)}
                    style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block" }} />
                ))}
              </div>
            </div>
          )}

          {/* Chart reconstruction is only offered for TopstepX-imported trades —
              manually-entered trades have no contract_id / historical bars to fetch. */}
          {t.tradeMode === "Live" && t.contractId !== undefined && (
            <GeneratedChart trade={t} onUpdate={onUpdateTrade} openLightbox={openLightbox} />
          )}
        </div>
      )}
    </div>
  );
}
