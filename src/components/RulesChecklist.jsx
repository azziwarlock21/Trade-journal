import { RULES, ALL_CHECKLIST_IDS } from "../utils/rulesData.js";

// ─── RulesChecklist ───────────────────────────────────────────────────────
// Rules tab: interactive pre-trade checklist (progress bar + tickable items)
// plus 6 static reference sections (Risk, Execution, Post-Trade, Mindset,
// Confluence explanation, MAE guide). Only the Pre-Trade Checklist section
// is clickable — the rest are numbered reference material.

export default function RulesChecklist({ checkedRules, setCheckedRules }) {
  const checked = Object.values(checkedRules).filter(Boolean).length;
  const total = ALL_CHECKLIST_IDS.length;
  const pct = total ? (checked / total) * 100 : 0;
  const allDone = checked === total;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>

      {/* Header */}
      <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Trading Rules &amp; Pre-Trade Checklist</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>Use the pre-trade checklist before every entry.</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#8b949e" }}>{checked} / {total} pre-trade checks</span>
          <button onClick={() => setCheckedRules({})} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Reset Checklist
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ background: "#0d1117", border: "1px solid " + (allDone ? "#00e5a044" : "#1f2937"), borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Pre-Trade Checklist Progress</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? "#00e5a0" : "#f5c842" }}>
            {allDone ? "READY TO TRADE" : `${checked} / ${total} complete`}
          </span>
        </div>
        <div style={{ height: 8, background: "#1f2937", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", background: allDone ? "#00e5a0" : "#f5c842", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
        {allDone && (
          <div style={{ marginTop: 10, fontSize: 11, color: "#00e5a0", fontWeight: 700, textAlign: "center", letterSpacing: 2 }}>
            ALL CONDITIONS MET — YOU MAY ENTER THE TRADE
          </div>
        )}
      </div>

      {/* Rule sections */}
      {RULES.map(section => (
        <div key={section.category} style={{ background: "#0d1117", border: `1px solid ${section.color}22`, borderRadius: 14, padding: "20px 24px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, background: section.color + "18", color: section.color, padding: "3px 10px", borderRadius: 20, letterSpacing: 2, textTransform: "uppercase" }}>
              {section.icon}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: section.color, letterSpacing: 2, textTransform: "uppercase" }}>{section.category}</span>
          </div>
          <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 16 }}>{section.description}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {section.rules.map((rule, idx) => {
              const isChecked = checkedRules[rule.id] || false;
              return (
                <div
                  key={rule.id}
                  onClick={() => section.checklist && setCheckedRules(c => ({ ...c, [rule.id]: !c[rule.id] }))}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 14px", borderRadius: 10,
                    background: isChecked ? section.color + "10" : "#070b12",
                    border: `1px solid ${isChecked ? section.color + "44" : "#1f2937"}`,
                    cursor: section.checklist ? "pointer" : "default",
                    transition: "all 0.2s ease",
                  }}>
                  {section.checklist ? (
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isChecked ? section.color : "#2a2f3a"}`, background: isChecked ? section.color : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                      {isChecked && <span style={{ fontSize: 11, color: "#070b12", fontWeight: 900 }}>✓</span>}
                    </div>
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: 5, background: section.color + "18", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: section.color }}>{idx + 1}</span>
                    </div>
                  )}
                  <span style={{ fontSize: 12, color: isChecked ? "#e6edf3" : "#9ca3af", lineHeight: 1.6 }}>{rule.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ background: "#0d1117", border: "1px solid #f5c84222", borderRadius: 12, padding: "16px 20px", marginTop: 8, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.8 }}>
          <span style={{ color: "#f5c842", fontWeight: 700 }}>Remember: </span>
          A loss following your rules is not a failure. A win breaking your rules is not a success.
          <br />The goal is consistent execution — the profits follow the process.
        </div>
      </div>
    </div>
  );
}
