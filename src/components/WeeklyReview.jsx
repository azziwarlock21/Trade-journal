import { labelStyle as lbl } from "../styles/formStyles.js";

// ─── WeeklyReview ─────────────────────────────────────────────────────────
// Sunday review tab: 5 structured reflection questions, saved per-week and
// displayed newest-first. Reviews persist in localStorage (this data is
// personal reflection, not trade data, so it doesn't need cloud sync).

const REVIEW_QUESTIONS = [
  ["What worked well this week?", "whatWorked", "Setups, execution, discipline..."],
  ["What didn't work?", "whatDidnt", "Mistakes, hesitation, overtrading..."],
  ["One rule I broke (if any)", "ruleBroke", "Be honest — this is your private journal"],
  ["One specific thing to improve next week", "improvement", "Concrete and actionable, not vague"],
  ["Mindset & emotional state this week", "mindset", "How did you feel during trades?"],
];

const REVIEW_DISPLAY_FIELDS = [
  ["What worked", "whatWorked", "#00e5a0"],
  ["What didn't work", "whatDidnt", "#ff4d6d"],
  ["Rule broke", "ruleBroke", "#f5c842"],
  ["Improve next week", "improvement", "#3b82f6"],
  ["Mindset", "mindset", "#a78bfa"],
];

const textareaStyle = {
  width: "100%", background: "#070b12", border: "1px solid #2a2f3a", borderRadius: 8,
  padding: "8px 12px", color: "#e6edf3", fontSize: 12, boxSizing: "border-box",
  fontFamily: "inherit", resize: "vertical", lineHeight: 1.6,
};

export default function WeeklyReview({
  weeklyReviews, weeklyForm, setWeeklyForm,
  showWeeklyForm, setShowWeeklyForm,
  onSave, onDelete,
}) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase" }}>Weekly Review</div>
          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>Complete every Sunday. Builds the habit that separates improving traders from stagnant ones.</div>
        </div>
        <button onClick={() => setShowWeeklyForm(f => !f)}
          style={{ padding: "9px 20px", borderRadius: 9, border: `1px solid ${showWeeklyForm ? "#2a2f3a" : "#f5c842"}`, background: showWeeklyForm ? "transparent" : "rgba(245,200,66,0.1)", color: showWeeklyForm ? "#6b7280" : "#f5c842", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
          {showWeeklyForm ? "Cancel" : "+ New Review"}
        </button>
      </div>

      {showWeeklyForm && (
        <div style={{ background: "#0d1117", border: "1px solid #f5c84233", borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Week of (Monday date)</label>
              <input type="date" value={weeklyForm.week} onChange={e => setWeeklyForm(f => ({ ...f, week: e.target.value }))} style={{ ...textareaStyle, resize: "none" }} />
            </div>
          </div>
          {REVIEW_QUESTIONS.map(([label, key, placeholder]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={lbl}>{label}</label>
              <textarea value={weeklyForm[key]} onChange={e => setWeeklyForm(f => ({ ...f, [key]: e.target.value }))} rows={2} placeholder={placeholder} style={textareaStyle} />
            </div>
          ))}
          <button onClick={onSave} style={{ padding: "11px 28px", background: "linear-gradient(135deg,#f5c842,#ff9a3c)", borderRadius: 10, border: "none", color: "#070b12", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
            Save Review
          </button>
        </div>
      )}

      {weeklyReviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 12 }}>
          No reviews yet. Complete your first Sunday review to start building your trading journal history.
        </div>
      ) : (
        [...weeklyReviews].sort((a, b) => (b.week > a.week ? 1 : -1)).map(r => (
          <div key={r.id} style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842" }}>
                Week of {new Date(r.week + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <button onClick={() => onDelete(r.id)} style={{ fontSize: 10, color: "#ff4d6d", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Remove
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {REVIEW_DISPLAY_FIELDS.filter(([, key]) => r[key]).map(([label, key, color]) => (
                <div key={key}>
                  <div style={{ fontSize: 9, color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{r[key]}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export const emptyWeeklyForm = () => ({
  week: "", whatWorked: "", whatDidnt: "", ruleBroke: "", improvement: "", mindset: "",
});
