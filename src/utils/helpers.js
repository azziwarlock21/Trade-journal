// ─── Pure Helper Functions ──────────────────────────────────────────────────
// Datetime parsing, session/news detection, points/RRR calculation, color maps.
// IMPORTANT: All datetime parsing uses direct string splitting, never `new
// Date(datetimeLocalValue)`, because the browser applies local timezone to
// strings without a timezone suffix. All entry/exit times are treated as ET.

import { NEWS_CALENDAR } from "./newsCalendar.js";

// ─── News & Session Detection ───────────────────────────────────────────────
export function detectNewsEvent(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return null;
  try {
    const [datePart, timePart] = entryDatetime.split("T");
    const [h, m] = timePart.split(":").map(Number);
    const entryMins = h * 60 + m;
    for (const [date, time, event, impact] of NEWS_CALENDAR) {
      if (date !== datePart) continue;
      const [evH, evM] = time.split(":").map(Number);
      if (Math.abs(entryMins - (evH * 60 + evM)) <= 30) return { event, impact };
    }
    return null;
  } catch (e) { return null; }
}

export function detectSession(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return "";
  try {
    const [h, m] = entryDatetime.split("T")[1].split(":").map(Number);
    const etMins = h * 60 + m;
    if (etMins >= 1080 || etMins < 180) return "Asia";
    if (etMins < 480)  return "London";
    if (etMins < 720)  return "London/NY Overlap";
    if (etMins < 1020) return "New York";
    return "After Hours";
  } catch (e) { return ""; }
}

export function getETHour(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return null;
  try { return parseInt(entryDatetime.split("T")[1].split(":")[0], 10); }
  catch (e) { return null; }
}

// ─── Formatting ──────────────────────────────────────────────────────────────
export function calcDuration(entry, exit) {
  if (!entry || !exit || !entry.includes("T") || !exit.includes("T")) return "";
  try {
    const diff = new Date(exit) - new Date(entry);
    if (isNaN(diff) || diff <= 0) return "";
    const totalMins = Math.floor(diff / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  } catch (e) { return ""; }
}

export function formatDatetime(dt) {
  if (!dt) return "--";
  try {
    return new Date(dt).toLocaleString("en-US", {
      month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch (e) { return dt; }
}

export function formatDate(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "2-digit",
    });
  } catch (e) { return dt.split("T")[0]; }
}

// ─── Default Form State ──────────────────────────────────────────────────────
export const defaultForm = () => ({
  entryDatetime: "", exitDatetime: "", tradeType: "", direction: "", session: "",
  lotSize: "", entryPrice: "", stopLoss: "", takeProfit: "",
  points: "", rrr: "", candlePattern: "None", wickDirection: "None",
  news: "None", newsImpact: "Low", htfBias: "", marketStructure: "",
  tradeMode: "Backtest", grade: "Ungraded", executionGrade: "Ungraded",
  outcome: "Win", maePrice: "", mae: "", notes: "", screenshots: [],
});

// ─── Points / RRR Calculation ────────────────────────────────────────────────
// MGC: 1 price unit = $10 = 1 point in journal terms.
// Points = price difference directly (e.g. entry 4554.1 → exit 4533.6 short
// = +20.5 pts). Do not multiply by 10 — that was for a different contract spec.
export function calcPointsFromOutcome(entry, sl, tp, direction, outcome) {
  if (!entry || !sl) return "";
  if (outcome === "Win") {
    if (!tp) return "";
    const pts = direction === "Long" ? tp - entry : entry - tp;
    return pts.toFixed(1);
  }
  if (outcome === "Loss") {
    const pts = direction === "Long" ? sl - entry : entry - sl;
    return pts.toFixed(1); // negative for losses
  }
  if (outcome === "Breakeven") return "0.0";
  return "";
}

export function calcRRRFromOutcome(entry, sl, tp, direction, outcome) {
  if (!entry || !sl || entry === sl) return "";
  const risk = Math.abs(entry - sl);
  if (outcome === "Win") {
    if (!tp) return "";
    const reward = direction === "Long" ? tp - entry : entry - tp;
    if (reward <= 0) return "";
    return (reward / risk).toFixed(2);
  }
  if (outcome === "Loss") return "-1.00";
  if (outcome === "Breakeven") return "0.00";
  return "";
}

export function calcConfluence(form) {
  let score = 0;
  if (form.htfBias && form.htfBias !== "Ranging" && form.htfBias !== "Uncertain") score++;
  const h = form.entryDatetime ? parseInt(form.entryDatetime.split("T")[1], 10) : -1;
  if ((h >= 3 && h < 5) || (h >= 9 && h < 11)) score++; // kill zones
  if (form.candlePattern && form.candlePattern !== "" && form.candlePattern !== "None") score++;
  if (form.stopLoss && form.entryPrice && Math.abs(parseFloat(form.entryPrice) - parseFloat(form.stopLoss)) > 0) score++;
  if (parseFloat(form.rrr) >= 2) score++;
  if (form.news === "None" || form.newsImpact === "Low") score++;
  return score;
}

// ─── Color Maps ───────────────────────────────────────────────────────────────
export const gradeColor = (g) =>
  g === "A" ? "#00e5a0" : g === "B" ? "#f5c842" : g === "C" ? "#ff7043" : "#888";

export const outcomeColor = (o) =>
  o === "Win" ? "#00e5a0" : o === "Loss" ? "#ff4d6d" : "#aaa";

export const modeColor = (m) =>
  m === "Live" ? "#00e5a0" : m === "Paper" ? "#3b82f6" : "#a78bfa";

export const confluenceColor = (s) =>
  s >= 5 ? "#00e5a0" : s >= 3 ? "#f5c842" : "#ff4d6d";
