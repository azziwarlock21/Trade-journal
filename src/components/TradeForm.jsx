import { useRef } from "react";
import {
  CANDLE_PATTERNS, NEWS_EVENTS, SESSIONS, DIRECTIONS,
  TRADE_TYPES, GRADES, HTF_BIASES, MARKET_STRUCTURES, TRADE_MODES,
} from "../utils/constants.js";
import {
  detectNewsEvent, detectSession, calcDuration,
  calcPointsFromOutcome, calcConfluence,
  gradeColor, outcomeColor, modeColor, confluenceColor,
} from "../utils/helpers.js";
import { inputStyle as inp, autoInputStyle as autoInp, labelStyle as lbl, AutoBadge } from "../styles/formStyles.js";

// ─── TradeForm ────────────────────────────────────────────────────────────
// Journal tab: single-trade entry form + multi-position batch entry mode.
// Owns no state itself except local file/drag refs — all form state and
// mutation logic (`set`, `saveTrade`, `saveMultiTrades`, screenshot
// handling) live in the parent (App.jsx / useTrades hook) and are passed
// down as props. This keeps the save/calculation logic in one place and
// testable independent of the UI.

export default function TradeForm({
  form, set, editId, resetForm,
  multiMode, setMultiMode,
  multiPositions, setMultiPositions,
  saveTrade, saveMultiTrades,
  syncing, syncError,
  sessionOverridden, setSessionOverridden,
  loadImageFile, openLightbox,
  pasteMode, setPasteMode, handlePaste, handleDrop, handleDragOver, handleDragLeave, isDragging,
}) {
  const fileRef = useRef();
  const dropZoneRef = useRef();
  const pasteTargetRef = useRef();

  const activatePasteMode = () => {
    setPasteMode(true);
    setTimeout(() => { if (pasteTargetRef.current) pasteTargetRef.current.focus(); }, 50);
  };

  const confluence = calcConfluence(form);
  const detectedNews = detectNewsEvent(form.entryDatetime);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 16, padding: 24 }}>

        {/* ── Header: title + Single/Multi toggle + Confluence ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase" }}>
              {editId ? "Edit Trade" : multiMode ? "+ Log Multiple Positions" : "+ Log New Trade"}
            </div>
            {!editId && (
              <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #2a2f3a" }}>
                {["Single", "Multi"].map(m => (
                  <button key={m} onClick={() => setMultiMode(m === "Multi")}
                    style={{ padding: "5px 14px", border: "none", background: (m === "Multi") === multiMode ? "rgba(245,200,66,0.15)" : "transparent", color: (m === "Multi") === multiMode ? "#f5c842" : "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}>
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2 }}>CONFLUENCE</span>
            <div style={{ display: "flex", gap: 3 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i <= confluence ? confluenceColor(confluence) : "#1f2937", transition: "background 0.3s" }} />
              ))}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: confluenceColor(confluence) }}>{confluence}/6</span>
          </div>
        </div>

        {/* ── Shared fields grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 14 }}>

          <div>
            <label style={lbl}>
              Entry Date &amp; Time (ET)
              <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: kill zone entry">◆</span>
            </label>
            <input type="datetime-local" value={form.entryDatetime} onChange={e => set("entryDatetime", e.target.value)} style={inp} />
          </div>

          <div><label style={lbl}>Exit Date &amp; Time (ET)</label><input type="datetime-local" value={form.exitDatetime} onChange={e => set("exitDatetime", e.target.value)} style={inp} /></div>
          <div><label style={{ ...lbl, color: "#f5c842" }}>Duration <AutoBadge /></label><input readOnly value={calcDuration(form.entryDatetime, form.exitDatetime)} placeholder="--" style={autoInp} /></div>

          <div>
            <label style={lbl}>
              Session
              {form.session && !sessionOverridden && <AutoBadge />}
              {sessionOverridden && (
                <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(245,200,66,0.1)", padding: "1px 6px", borderRadius: 4, color: "#f5c842", cursor: "pointer" }}
                  onClick={() => { setSessionOverridden(false); const d = detectSession(form.entryDatetime); if (d) set("session", d); }}>
                  MANUAL reset
                </span>
              )}
            </label>
            <select value={form.session} onChange={e => set("session", e.target.value)} style={{ ...inp, ...(form.session && !sessionOverridden ? { border: "1px solid #00e5a044", color: "#00e5a0", fontWeight: 700 } : {}) }}>
              <option value="">Select...</option>
              {SESSIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Trade Mode</label>
            <select value={form.tradeMode} onChange={e => set("tradeMode", e.target.value)} style={{ ...inp, color: modeColor(form.tradeMode), fontWeight: 700 }}>
              {TRADE_MODES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div><label style={lbl}>Trade Type</label><select value={form.tradeType} onChange={e => set("tradeType", e.target.value)} style={inp}><option value="">Select...</option>{TRADE_TYPES.map(s => <option key={s}>{s}</option>)}</select></div>

          <div>
            <label style={lbl}>Direction</label>
            <select value={form.direction} onChange={e => set("direction", e.target.value)} style={{ ...inp, color: form.direction === "Long" ? "#00e5a0" : form.direction === "Short" ? "#ff4d6d" : "#e6edf3", fontWeight: form.direction ? 700 : 400 }}>
              <option value="">Select...</option>{DIRECTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>
              HTF Bias (Daily/4H)
              <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: clear directional bias">◆</span>
            </label>
            <select value={form.htfBias} onChange={e => set("htfBias", e.target.value)} style={{ ...inp, color: form.htfBias === "Bullish" ? "#00e5a0" : form.htfBias === "Bearish" ? "#ff4d6d" : form.htfBias === "Ranging" ? "#f5c842" : "#e6edf3" }}>
              <option value="">Select...</option>{HTF_BIASES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div><label style={lbl}>Market Structure</label><select value={form.marketStructure} onChange={e => set("marketStructure", e.target.value)} style={inp}><option value="">Select...</option>{MARKET_STRUCTURES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Lot Size</label><input type="number" step="0.1" value={form.lotSize} onChange={e => set("lotSize", e.target.value)} placeholder="1.0" style={inp} /></div>
          <div><label style={lbl}>Entry Price</label><input type="number" step="0.1" value={form.entryPrice} onChange={e => set("entryPrice", e.target.value)} placeholder="2350.0" style={inp} /></div>

          <div>
            <label style={lbl}>
              Stop Loss
              <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: SL placed behind structure">◆</span>
              <AutoBadge />
            </label>
            <input type="number" step="0.1" value={form.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="Auto from entry" style={{ ...inp, border: form.stopLoss ? "1px solid #ff4d6d44" : "1px solid #2a2f3a" }} />
          </div>

          <div><label style={lbl}>Take Profit</label><input type="number" step="0.1" value={form.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="2370.0" style={inp} /></div>

          <div><label style={{ ...lbl, color: "#f5c842" }}>Points <AutoBadge /></label><input readOnly value={form.points} placeholder="--" style={autoInp} /></div>

          <div>
            <label style={{ ...lbl, color: "#f5c842" }}>
              RRR <AutoBadge />
              <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: RRR ≥ 2.0">◆</span>
            </label>
            <input readOnly value={form.rrr} placeholder="--" style={autoInp} />
          </div>

          <div>
            <label style={lbl}>MAE Extreme Price</label>
            <input type="number" step="0.1" value={form.maePrice} onChange={e => set("maePrice", e.target.value)} placeholder={form.direction === "Short" ? "Highest price reached" : "Lowest price reached"} style={inp} />
          </div>
          <div>
            <label style={{ ...lbl, color: "#f5c842" }}>MAE Points <AutoBadge /></label>
            <input readOnly value={form.mae} placeholder="--" style={autoInp} />
          </div>

          <div>
            <label style={lbl}>
              Candle Pattern
              <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: signal candle present">◆</span>
            </label>
            <select value={form.candlePattern} onChange={e => set("candlePattern", e.target.value)} style={inp}>{CANDLE_PATTERNS.map(s => <option key={s}>{s}</option>)}</select>
          </div>

          <div><label style={lbl}>Wick Direction</label><select value={form.wickDirection} onChange={e => set("wickDirection", e.target.value)} style={inp}>{["None", "Upper", "Lower", "Both"].map(s => <option key={s}>{s}</option>)}</select></div>

          <div>
            <label style={lbl}>
              News Event
              <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: no high-impact news nearby">◆</span>
              {form.news !== "None" && <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(0,229,160,0.12)", padding: "1px 6px", borderRadius: 4, color: "#00e5a0", fontWeight: 700 }}>AUTO</span>}
            </label>
            <select value={form.news} onChange={e => set("news", e.target.value)} style={{ ...inp, ...(form.news !== "None" ? { border: "1px solid #00e5a044", color: "#f5c842", fontWeight: 700 } : {}) }}>
              {NEWS_EVENTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {form.news !== "None" && (
            <div>
              <label style={lbl}>News Impact</label>
              <select value={form.newsImpact} onChange={e => set("newsImpact", e.target.value)} style={{ ...inp, color: form.newsImpact === "High" ? "#ff4d6d" : form.newsImpact === "Medium" ? "#f5c842" : "#8b949e", fontWeight: 700 }}>
                {["Low", "Medium", "High"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ ...lbl, color: "#f5c842" }}>Outcome <AutoBadge /></label>
            <select value={form.outcome} onChange={e => set("outcome", e.target.value)} style={{ ...inp, background: "#111827", border: "1px solid #00e5a044", color: outcomeColor(form.outcome), fontWeight: 700 }}>
              {["Win", "Loss", "Breakeven"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Setup Grade (before entry)</label>
            <select value={form.grade} onChange={e => set("grade", e.target.value)} style={{ ...inp, color: gradeColor(form.grade), fontWeight: 700 }}>
              {GRADES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Execution Grade (after close)</label>
            <select value={form.executionGrade} onChange={e => set("executionGrade", e.target.value)} style={{ ...inp, color: gradeColor(form.executionGrade), fontWeight: 700 }}>
              {GRADES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#f97316", fontWeight: 700 }}>◆</span>
          <span style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1 }}>CONTRIBUTES TO CONFLUENCE SCORE</span>
        </div>

        {/* ── Multi-position rows ── */}
        {multiMode && !editId && (
          <MultiPositionRows
            form={form}
            multiPositions={multiPositions}
            setMultiPositions={setMultiPositions}
          />
        )}

        {/* ── Notes (single mode only — multi has per-row notes) ── */}
        {!multiMode && (
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>Notes / Observations</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Context, confluences, HTF alignment, what you would do differently..." style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
          </div>
        )}

        {/* ── Screenshots ── */}
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>Chart Screenshots ({form.screenshots?.length || 0} added)</label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => Array.from(e.target.files).forEach(f => loadImageFile(f))} style={{ display: "none" }} />
          <div
            ref={dropZoneRef}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            tabIndex={0}
            style={{ border: `2px dashed ${isDragging ? "#f5c842" : (form.screenshots?.length > 0) ? "#00e5a044" : "#2a2f3a"}`, borderRadius: 12, background: isDragging ? "rgba(245,200,66,0.05)" : "#070b12", padding: "16px", textAlign: "center", transition: "all 0.2s ease", outline: "none" }}>

            {form.screenshots?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
                {form.screenshots.map((ss, idx) => (
                  <div key={idx} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2f3a" }}>
                    <img src={ss.data} alt={ss.name} onClick={() => openLightbox(ss.data)} style={{ width: "100%", height: 120, objectFit: "cover", cursor: "zoom-in", display: "block" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{ss.name}</span>
                      <button onClick={e => { e.stopPropagation(); set("screenshots", form.screenshots.filter((_, i) => i !== idx)); }}
                        style={{ fontSize: 10, color: "#ff4d6d", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, flexShrink: 0 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pasteMode ? (
              <div>
                <div style={{ fontSize: 12, color: "#f5c842", fontWeight: 700, marginBottom: 10 }}>Ready — press Cmd+V or long-press and tap Paste</div>
                <div ref={pasteTargetRef} contentEditable suppressContentEditableWarning onPaste={handlePaste}
                  style={{ minHeight: 44, border: "1px dashed #f5c842", borderRadius: 8, padding: "10px 12px", color: "#f5c842", fontSize: 11, outline: "none", background: "rgba(245,200,66,0.04)", textAlign: "center", lineHeight: 2 }}>
                  Tap here then paste
                </div>
                <button onClick={e => { e.stopPropagation(); setPasteMode(false); }} style={{ marginTop: 8, fontSize: 10, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: form.screenshots?.length > 0 ? 0 : 10 }}>
                  <button onClick={e => { e.stopPropagation(); fileRef.current && fileRef.current.click(); }}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #f5c842", background: "transparent", color: "#f5c842", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {form.screenshots?.length > 0 ? "+ Add More" : "Browse / Photos"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); activatePasteMode(); }}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #3b82f6", background: "transparent", color: "#3b82f6", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Paste from Clipboard
                  </button>
                  {form.screenshots?.length > 0 && (
                    <button onClick={e => { e.stopPropagation(); set("screenshots", []); if (fileRef.current) fileRef.current.value = ""; }}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ff4d6d44", background: "transparent", color: "#ff4d6d", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Clear All
                    </button>
                  )}
                </div>
                {form.screenshots?.length === 0 && (
                  <div style={{ fontSize: 10, color: "#4b5563", marginTop: 6 }}>Drag &amp; drop multiple images · iPad: screenshot → Share → Copy Photo → Paste</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── News proximity warning ── */}
        {detectedNews && (
          <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(245,200,66,0.08)", border: "1px solid #f5c84266", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>!</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", marginBottom: 2 }}>News Window: {detectedNews.event}</div>
              <div style={{ fontSize: 10, color: "#8b949e" }}>Entry falls within 30 min of {detectedNews.event}. Verify this is intentional before saving.</div>
            </div>
          </div>
        )}

        {/* ── Save / Cancel ── */}
        <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={multiMode && !editId ? saveMultiTrades : saveTrade} disabled={syncing}
            style={{ padding: "11px 28px", background: syncing ? "#2a2f3a" : "linear-gradient(135deg, #f5c842, #ff9a3c)", borderRadius: 10, border: "none", color: syncing ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 12, cursor: syncing ? "not-allowed" : "pointer", letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit" }}>
            {syncing ? "Saving..." : editId ? "Update Trade" : multiMode ? `Save ${multiPositions.filter(p => p.entryPrice && p.entryDatetime).length || "All"} Positions` : "Save Trade"}
          </button>
          {editId && (
            <button onClick={resetForm} style={{ padding: "11px 20px", background: "transparent", borderRadius: 10, border: "1px solid #2a2f3a", color: "#8b949e", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          )}
          {syncError && <span style={{ fontSize: 11, color: "#ff4d6d" }}>{syncError}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── MultiPositionRows ────────────────────────────────────────────────────
// Sub-component for batch trade entry: shared fields above apply to every
// row; each row only needs entry/exit time, entry price, MAE, and a note.
function MultiPositionRows({ form, multiPositions, setMultiPositions }) {
  return (
    <div style={{ marginTop: 18, background: "#070b12", border: "1px solid #f5c84233", borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>Position Rows</div>
          <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>Each row = one separate trade. Shared fields above apply to all.</div>
        </div>
        <button onClick={() => setMultiPositions(p => [...p, { entryDatetime: "", exitDatetime: "", entryPrice: "", maePrice: "", notes: "" }])}
          style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #f5c84244", background: "rgba(245,200,66,0.08)", color: "#f5c842", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + Add Row
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 120px 1fr 32px", gap: 8, marginBottom: 6 }}>
        {["Entry Time (ET)", "Exit Time (ET)", "Entry Price", "MAE Price", "Notes (optional)", ""].map((h, i) => (
          <div key={i} style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>

      {multiPositions.map((pos, idx) => {
        const ep = parseFloat(pos.entryPrice);
        const sl = parseFloat(form.stopLoss);
        const tp = parseFloat(form.takeProfit);
        const dir = form.direction;
        let rowPoints = "";
        if (!isNaN(ep) && !isNaN(sl) && !isNaN(tp) && dir) {
          const rowOutcome = dir === "Long" ? (tp > ep ? "Win" : "Loss") : (tp < ep ? "Win" : "Loss");
          rowPoints = calcPointsFromOutcome(ep, sl, tp, dir, rowOutcome);
        }
        const maeP = parseFloat(pos.maePrice);
        let rowMAE = "";
        if (!isNaN(maeP) && !isNaN(ep) && dir) {
          const raw = dir === "Long" ? (ep - maeP) : (maeP - ep);
          rowMAE = raw > 0 ? raw.toFixed(1) : "0.0";
        }

        return (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 120px 1fr 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="datetime-local" value={pos.entryDatetime}
              onChange={e => setMultiPositions(p => p.map((r, i) => i === idx ? { ...r, entryDatetime: e.target.value } : r))}
              style={inp} />
            <input type="datetime-local" value={pos.exitDatetime}
              onChange={e => setMultiPositions(p => p.map((r, i) => i === idx ? { ...r, exitDatetime: e.target.value } : r))}
              style={inp} />
            <input type="number" step="0.1" value={pos.entryPrice} placeholder="Entry"
              onChange={e => setMultiPositions(p => p.map((r, i) => i === idx ? { ...r, entryPrice: e.target.value } : r))}
              style={inp} />
            <input type="number" step="0.1" value={pos.maePrice} placeholder="MAE low/high"
              onChange={e => setMultiPositions(p => p.map((r, i) => i === idx ? { ...r, maePrice: e.target.value } : r))}
              style={inp} />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={pos.notes} placeholder="Optional note for this position"
                onChange={e => setMultiPositions(p => p.map((r, i) => i === idx ? { ...r, notes: e.target.value } : r))}
                style={{ ...inp, flex: 1 }} />
              {rowPoints && <span style={{ fontSize: 10, fontWeight: 700, color: parseFloat(rowPoints) >= 0 ? "#00e5a0" : "#ff4d6d", whiteSpace: "nowrap" }}>{rowPoints}pts</span>}
              {rowMAE && <span style={{ fontSize: 10, color: "#a78bfa", whiteSpace: "nowrap" }}>MAE:{rowMAE}</span>}
            </div>
            <button onClick={() => setMultiPositions(p => p.filter((_, i) => i !== idx))} disabled={multiPositions.length <= 1}
              style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #ff4d6d33", background: "transparent", color: "#ff4d6d", fontSize: 14, cursor: multiPositions.length <= 1 ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", opacity: multiPositions.length <= 1 ? 0.3 : 1 }}>
              ×
            </button>
          </div>
        );
      })}

      <div style={{ marginTop: 12, fontSize: 10, color: "#4b5563" }}>
        {multiPositions.filter(p => p.entryPrice && p.entryDatetime).length} of {multiPositions.length} rows ready to save
      </div>
    </div>
  );
}
