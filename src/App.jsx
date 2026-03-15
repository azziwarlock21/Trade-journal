import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ─── Supabase config ───────────────────────────────────────────────────────
const SUPABASE_URL = "https://ivbgtbsobmwxldoiwcru.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymd0YnNvYm13eGxkb2l3Y3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDk4MDksImV4cCI6MjA4ODgyNTgwOX0.2L7GDrMKZVuQpkjU4WDoHxEVvq7n0D0WIc8wQJOTWaw";
const HEADERS = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const TABLE = `${SUPABASE_URL}/rest/v1/trades`;

const toRow = (t) => ({
  id: t.id,
  entry_datetime: t.entryDatetime || null,
  exit_datetime: t.exitDatetime || null,
  trade_type: t.tradeType || null,
  direction: t.direction || null,
  session: t.session || null,
  lot_size: t.lotSize || null,
  entry_price: t.entryPrice || null,
  exit_price: null,
  stop_loss: t.stopLoss || null,
  take_profit: t.takeProfit || null,
  points: t.points || null,
  rrr: t.rrr || null,
  candle_pattern: t.candlePattern || null,
  wick_direction: t.wickDirection || null,
  news: t.news || null,
  news_impact: t.newsImpact || null,
  htf_bias: t.htfBias || null,
  market_structure: t.marketStructure || null,
  trade_mode: t.tradeMode || "Backtest",
  grade: t.grade || "Ungraded",
  execution_grade: t.executionGrade || "Ungraded",
  outcome: t.outcome || "Win",
  mae: t.mae || null,
  notes: t.notes || null,
  screenshot: t.screenshots ? JSON.stringify(t.screenshots) : null,
  screenshot_name: t.screenshots ? t.screenshots.map(s => s.name).join("|") : null,
});

const fromRow = (r) => ({
  id: r.id,
  entryDatetime: r.entry_datetime || "",
  exitDatetime: r.exit_datetime || "",
  tradeType: r.trade_type || "",
  direction: r.direction || "",
  session: r.session || "",
  lotSize: r.lot_size || "",
  entryPrice: r.entry_price || "",
  stopLoss: r.stop_loss || "",
  takeProfit: r.take_profit || "",
  points: r.points || "",
  rrr: r.rrr || "",
  candlePattern: r.candle_pattern || "",
  wickDirection: r.wick_direction || "None",
  news: r.news || "None",
  newsImpact: r.news_impact || "Low",
  htfBias: r.htf_bias || "",
  marketStructure: r.market_structure || "",
  tradeMode: r.trade_mode || "Backtest",
  grade: r.grade || "Ungraded",
  executionGrade: r.execution_grade || "Ungraded",
  outcome: r.outcome || "Win",
  mae: r.mae || "",
  notes: r.notes || "",
  screenshots: (() => { try { return r.screenshot ? JSON.parse(r.screenshot) : []; } catch(e) { return r.screenshot ? [{ data: r.screenshot, name: r.screenshot_name || "screenshot" }] : []; } })(),
});

async function dbFetchAll() {
  const res = await fetch(`${TABLE}?order=entry_datetime.desc&limit=2000`, { headers: { ...HEADERS, "Prefer": "return=representation" } });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).map(fromRow);
}
async function dbInsert(trade) {
  const res = await fetch(TABLE, { method: "POST", headers: { ...HEADERS, "Prefer": "return=representation" }, body: JSON.stringify(toRow(trade)) });
  if (!res.ok) throw new Error(await res.text());
}
async function dbUpdate(trade) {
  const res = await fetch(`${TABLE}?id=eq.${trade.id}`, { method: "PATCH", headers: { ...HEADERS, "Prefer": "return=representation" }, body: JSON.stringify(toRow(trade)) });
  if (!res.ok) throw new Error(await res.text());
}
async function dbDelete(id) {
  const res = await fetch(`${TABLE}?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
}
async function dbDeleteAll() {
  const res = await fetch(`${TABLE}?id=neq.0`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Constants ─────────────────────────────────────────────────────────────
const CANDLE_PATTERNS = ["None","Engulfing Bull","Engulfing Bear","Hammer","Doji","Pin Bar","Other"];
const NEWS_EVENTS = ["None","CPI","NFP","FOMC","PPI","GDP","ISM","Retail Sales","Unemployment Claims","Jerome Powell Speech","Other"];
const SESSIONS = ["London","New York","Asia","London/NY Overlap","Pre-Market","After Hours"];
const DIRECTIONS = ["Long","Short"];
const TRADE_TYPES = ["Supply and Demand","Breakout","Reversal","Range","Break and Retest","News Play"];
const GRADES = ["A","B","C","Ungraded"];
const HTF_BIASES = ["Bullish","Bearish","Ranging","Uncertain"];
const MARKET_STRUCTURES = ["With Trend","Counter Trend","Range","Breakout","Reversal"];
const TRADE_MODES = ["Backtest","Paper","Live"];
const TIMEZONES = [
  { label: "Germany (CET/CEST)", tz: "Europe/Berlin" },
  { label: "New York (ET)", tz: "America/New_York" },
];

// ─── Economic Calendar 2024–2026 (ET times) ──────────────────────────────
const NEWS_CALENDAR = [
  ["2024-01-05","08:30","NFP","High"],["2024-01-11","08:30","CPI","High"],["2024-01-12","08:30","PPI","High"],
  ["2024-01-18","08:30","Unemployment Claims","Medium"],["2024-01-25","08:30","Unemployment Claims","Medium"],
  ["2024-01-31","14:00","FOMC","High"],["2024-02-01","08:30","Unemployment Claims","Medium"],
  ["2024-02-02","08:30","NFP","High"],["2024-02-08","08:30","Unemployment Claims","Medium"],
  ["2024-02-13","08:30","CPI","High"],["2024-02-14","08:30","PPI","High"],
  ["2024-02-15","08:30","Unemployment Claims","Medium"],["2024-02-20","08:30","Unemployment Claims","Medium"],
  ["2024-02-22","08:30","Unemployment Claims","Medium"],["2024-02-29","08:30","Unemployment Claims","Medium"],
  ["2024-03-01","08:30","NFP","High"],["2024-03-07","08:30","Unemployment Claims","Medium"],
  ["2024-03-12","08:30","CPI","High"],["2024-03-13","08:30","PPI","High"],
  ["2024-03-14","08:30","Unemployment Claims","Medium"],["2024-03-20","14:00","FOMC","High"],
  ["2024-03-21","08:30","Unemployment Claims","Medium"],["2024-03-28","08:30","Unemployment Claims","Medium"],
  ["2024-04-05","08:30","NFP","High"],["2024-04-10","08:30","CPI","High"],["2024-04-11","08:30","PPI","High"],
  ["2024-04-11","08:30","Unemployment Claims","Medium"],["2024-04-18","08:30","Unemployment Claims","Medium"],
  ["2024-04-25","08:30","Unemployment Claims","Medium"],["2024-05-01","14:00","FOMC","High"],
  ["2024-05-02","08:30","Unemployment Claims","Medium"],["2024-05-03","08:30","NFP","High"],
  ["2024-05-09","08:30","Unemployment Claims","Medium"],["2024-05-15","08:30","CPI","High"],
  ["2024-05-16","08:30","PPI","High"],["2024-05-16","08:30","Unemployment Claims","Medium"],
  ["2024-05-23","08:30","Unemployment Claims","Medium"],["2024-05-30","08:30","Unemployment Claims","Medium"],
  ["2024-06-06","08:30","Unemployment Claims","Medium"],["2024-06-07","08:30","NFP","High"],
  ["2024-06-12","08:30","CPI","High"],["2024-06-12","14:00","FOMC","High"],["2024-06-13","08:30","PPI","High"],
  ["2024-06-13","08:30","Unemployment Claims","Medium"],["2024-06-20","08:30","Unemployment Claims","Medium"],
  ["2024-06-27","08:30","Unemployment Claims","Medium"],["2024-07-02","08:30","Unemployment Claims","Medium"],
  ["2024-07-05","08:30","NFP","High"],["2024-07-11","08:30","CPI","High"],["2024-07-12","08:30","PPI","High"],
  ["2024-07-11","08:30","Unemployment Claims","Medium"],["2024-07-18","08:30","Unemployment Claims","Medium"],
  ["2024-07-25","08:30","Unemployment Claims","Medium"],["2024-07-31","14:00","FOMC","High"],
  ["2024-08-01","08:30","Unemployment Claims","Medium"],["2024-08-02","08:30","NFP","High"],
  ["2024-08-08","08:30","Unemployment Claims","Medium"],["2024-08-14","08:30","CPI","High"],
  ["2024-08-15","08:30","PPI","High"],["2024-08-15","08:30","Unemployment Claims","Medium"],
  ["2024-08-22","08:30","Unemployment Claims","Medium"],["2024-08-23","10:00","Jerome Powell Speech","High"],
  ["2024-08-29","08:30","Unemployment Claims","Medium"],["2024-09-05","08:30","Unemployment Claims","Medium"],
  ["2024-09-06","08:30","NFP","High"],["2024-09-11","08:30","CPI","High"],["2024-09-12","08:30","PPI","High"],
  ["2024-09-12","08:30","Unemployment Claims","Medium"],["2024-09-18","14:00","FOMC","High"],
  ["2024-09-19","08:30","Unemployment Claims","Medium"],["2024-09-26","08:30","Unemployment Claims","Medium"],
  ["2024-10-03","08:30","Unemployment Claims","Medium"],["2024-10-04","08:30","NFP","High"],
  ["2024-10-10","08:30","CPI","High"],["2024-10-11","08:30","PPI","High"],
  ["2024-10-10","08:30","Unemployment Claims","Medium"],["2024-10-17","08:30","Unemployment Claims","Medium"],
  ["2024-10-24","08:30","Unemployment Claims","Medium"],["2024-10-31","08:30","Unemployment Claims","Medium"],
  ["2024-11-01","08:30","NFP","High"],["2024-11-07","14:00","FOMC","High"],
  ["2024-11-07","08:30","Unemployment Claims","Medium"],["2024-11-13","08:30","CPI","High"],
  ["2024-11-14","08:30","PPI","High"],["2024-11-14","08:30","Unemployment Claims","Medium"],
  ["2024-11-21","08:30","Unemployment Claims","Medium"],["2024-11-27","08:30","Unemployment Claims","Medium"],
  ["2024-12-05","08:30","Unemployment Claims","Medium"],["2024-12-06","08:30","NFP","High"],
  ["2024-12-11","08:30","CPI","High"],["2024-12-12","08:30","PPI","High"],
  ["2024-12-12","08:30","Unemployment Claims","Medium"],["2024-12-18","14:00","FOMC","High"],
  ["2024-12-19","08:30","Unemployment Claims","Medium"],["2024-12-26","08:30","Unemployment Claims","Medium"],
  ["2025-01-02","08:30","Unemployment Claims","Medium"],["2025-01-10","08:30","NFP","High"],
  ["2025-01-15","08:30","CPI","High"],["2025-01-16","08:30","PPI","High"],
  ["2025-01-16","08:30","Unemployment Claims","Medium"],["2025-01-23","08:30","Unemployment Claims","Medium"],
  ["2025-01-29","14:00","FOMC","High"],["2025-01-30","08:30","Unemployment Claims","Medium"],
  ["2025-02-07","08:30","NFP","High"],["2025-02-12","08:30","CPI","High"],["2025-02-13","08:30","PPI","High"],
  ["2025-02-13","08:30","Unemployment Claims","Medium"],["2025-02-20","08:30","Unemployment Claims","Medium"],
  ["2025-02-27","08:30","Unemployment Claims","Medium"],["2025-03-06","08:30","Unemployment Claims","Medium"],
  ["2025-03-07","08:30","NFP","High"],["2025-03-12","08:30","CPI","High"],["2025-03-13","08:30","PPI","High"],
  ["2025-03-13","08:30","Unemployment Claims","Medium"],["2025-03-19","14:00","FOMC","High"],
  ["2025-03-20","08:30","Unemployment Claims","Medium"],["2025-03-27","08:30","Unemployment Claims","Medium"],
  ["2025-04-03","08:30","Unemployment Claims","Medium"],["2025-04-04","08:30","NFP","High"],
  ["2025-04-10","08:30","CPI","High"],["2025-04-11","08:30","PPI","High"],
  ["2025-04-10","08:30","Unemployment Claims","Medium"],["2025-04-17","08:30","Unemployment Claims","Medium"],
  ["2025-04-24","08:30","Unemployment Claims","Medium"],["2025-05-01","08:30","Unemployment Claims","Medium"],
  ["2025-05-02","08:30","NFP","High"],["2025-05-07","14:00","FOMC","High"],
  ["2025-05-08","08:30","Unemployment Claims","Medium"],["2025-05-13","08:30","CPI","High"],
  ["2025-05-15","08:30","PPI","High"],["2025-05-15","08:30","Unemployment Claims","Medium"],
  ["2025-05-22","08:30","Unemployment Claims","Medium"],["2025-05-29","08:30","Unemployment Claims","Medium"],
  ["2025-06-05","08:30","Unemployment Claims","Medium"],["2025-06-06","08:30","NFP","High"],
  ["2025-06-11","08:30","CPI","High"],["2025-06-12","08:30","PPI","High"],
  ["2025-06-12","08:30","Unemployment Claims","Medium"],["2025-06-18","14:00","FOMC","High"],
  ["2025-06-19","08:30","Unemployment Claims","Medium"],["2025-06-26","08:30","Unemployment Claims","Medium"],
  ["2025-07-03","08:30","Unemployment Claims","Medium"],["2025-07-03","08:30","NFP","High"],
  ["2025-07-10","08:30","Unemployment Claims","Medium"],["2025-07-15","08:30","CPI","High"],
  ["2025-07-16","08:30","PPI","High"],["2025-07-17","08:30","Unemployment Claims","Medium"],
  ["2025-07-24","08:30","Unemployment Claims","Medium"],["2025-07-30","14:00","FOMC","High"],
  ["2025-07-31","08:30","Unemployment Claims","Medium"],["2025-08-01","08:30","NFP","High"],
  ["2025-08-07","08:30","Unemployment Claims","Medium"],["2025-08-13","08:30","CPI","High"],
  ["2025-08-14","08:30","PPI","High"],["2025-08-14","08:30","Unemployment Claims","Medium"],
  ["2025-08-21","08:30","Unemployment Claims","Medium"],["2025-08-28","08:30","Unemployment Claims","Medium"],
  ["2025-09-04","08:30","Unemployment Claims","Medium"],["2025-09-05","08:30","NFP","High"],
  ["2025-09-10","08:30","CPI","High"],["2025-09-11","08:30","PPI","High"],
  ["2025-09-11","08:30","Unemployment Claims","Medium"],["2025-09-17","14:00","FOMC","High"],
  ["2025-09-18","08:30","Unemployment Claims","Medium"],["2025-09-25","08:30","Unemployment Claims","Medium"],
  ["2025-10-02","08:30","Unemployment Claims","Medium"],["2025-10-03","08:30","NFP","High"],
  ["2025-10-09","08:30","Unemployment Claims","Medium"],["2025-10-15","08:30","CPI","High"],
  ["2025-10-16","08:30","PPI","High"],["2025-10-16","08:30","Unemployment Claims","Medium"],
  ["2025-10-23","08:30","Unemployment Claims","Medium"],["2025-10-29","14:00","FOMC","High"],
  ["2025-10-30","08:30","Unemployment Claims","Medium"],["2025-11-06","08:30","Unemployment Claims","Medium"],
  ["2025-11-07","08:30","NFP","High"],["2025-11-13","08:30","Unemployment Claims","Medium"],
  ["2025-11-13","08:30","CPI","High"],["2025-11-14","08:30","PPI","High"],
  ["2025-11-20","08:30","Unemployment Claims","Medium"],["2025-11-26","08:30","Unemployment Claims","Medium"],
  ["2025-12-04","08:30","Unemployment Claims","Medium"],["2025-12-05","08:30","NFP","High"],
  ["2025-12-10","08:30","CPI","High"],["2025-12-11","08:30","PPI","High"],
  ["2025-12-11","08:30","Unemployment Claims","Medium"],["2025-12-17","14:00","FOMC","High"],
  ["2025-12-18","08:30","Unemployment Claims","Medium"],["2025-12-25","08:30","Unemployment Claims","Medium"],
  ["2026-01-08","08:30","Unemployment Claims","Medium"],["2026-01-09","08:30","NFP","High"],
  ["2026-01-15","08:30","CPI","High"],["2026-01-15","08:30","Unemployment Claims","Medium"],
  ["2026-01-16","08:30","PPI","High"],["2026-01-22","08:30","Unemployment Claims","Medium"],
  ["2026-01-28","14:00","FOMC","High"],["2026-01-29","08:30","Unemployment Claims","Medium"],
  ["2026-02-05","08:30","Unemployment Claims","Medium"],["2026-02-06","08:30","NFP","High"],
  ["2026-02-12","08:30","CPI","High"],["2026-02-12","08:30","Unemployment Claims","Medium"],
  ["2026-02-13","08:30","PPI","High"],["2026-02-19","08:30","Unemployment Claims","Medium"],
  ["2026-02-26","08:30","Unemployment Claims","Medium"],["2026-03-05","08:30","Unemployment Claims","Medium"],
  ["2026-03-06","08:30","NFP","High"],["2026-03-12","08:30","CPI","High"],
  ["2026-03-12","08:30","Unemployment Claims","Medium"],["2026-03-13","08:30","PPI","High"],
  ["2026-03-18","14:00","FOMC","High"],["2026-03-19","08:30","Unemployment Claims","Medium"],
  ["2026-03-26","08:30","Unemployment Claims","Medium"],
];

function detectNewsEvent(entryDatetime) {
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
  } catch(e) { return null; }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function detectSession(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return "";
  try {
    const [h, m] = entryDatetime.split("T")[1].split(":").map(Number);
    const etMins = h * 60 + m;
    if (etMins >= 1080 || etMins < 180) return "Asia";
    if (etMins < 480)  return "London";
    if (etMins < 720)  return "London/NY Overlap";
    if (etMins < 1020) return "New York";
    return "After Hours";
  } catch(e) { return ""; }
}

function getETHour(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return null;
  try { return parseInt(entryDatetime.split("T")[1].split(":")[0], 10); } catch(e) { return null; }
}

function calcDuration(entry, exit) {
  if (!entry || !exit || !entry.includes("T") || !exit.includes("T")) return "";
  try {
    const diff = new Date(exit) - new Date(entry);
    if (isNaN(diff) || diff <= 0) return "";
    const totalMins = Math.floor(diff / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  } catch(e) { return ""; }
}

function formatDatetime(dt) {
  if (!dt) return "--";
  try {
    return new Date(dt).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch(e) { return dt; }
}

function formatDate(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
  } catch(e) { return dt.split("T")[0]; }
}

const defaultForm = () => ({
  entryDatetime: "", exitDatetime: "", tradeType: "", direction: "", session: "",
  lotSize: "", entryPrice: "", stopLoss: "", takeProfit: "",
  points: "", rrr: "", candlePattern: "None", wickDirection: "None",
  news: "None", newsImpact: "Low", htfBias: "", marketStructure: "",
  tradeMode: "Backtest", grade: "Ungraded", executionGrade: "Ungraded",
  outcome: "Win", maePrice: "", mae: "", notes: "", screenshots: [],
});

function calcPointsFromOutcome(entry, sl, tp, direction, outcome) {
  if (!entry || !sl) return "";
  if (outcome === "Win") {
    if (!tp) return "";
    const pts = direction === "Long" ? tp - entry : entry - tp;
    return (pts * 10).toFixed(1);
  }
  if (outcome === "Loss") {
    const pts = direction === "Long" ? sl - entry : entry - sl;
    return (pts * 10).toFixed(1); // will be negative
  }
  if (outcome === "Breakeven") return "0.0";
  return "";
}

function calcRRRFromOutcome(entry, sl, tp, direction, outcome) {
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
function calcConfluence(form) {
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

const gradeColor   = (g) => g === "A" ? "#00e5a0" : g === "B" ? "#f5c842" : g === "C" ? "#ff7043" : "#888";
const outcomeColor = (o) => o === "Win" ? "#00e5a0" : o === "Loss" ? "#ff4d6d" : "#aaa";
const modeColor    = (m) => m === "Live" ? "#00e5a0" : m === "Paper" ? "#3b82f6" : "#a78bfa";
const confluenceColor = (s) => s >= 5 ? "#00e5a0" : s >= 3 ? "#f5c842" : "#ff4d6d";

function BarRow({ label, wins, total, color }) {
  const wr = total ? (wins / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#e6edf3" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#8b949e" }}>{wins}/{total} · {wr.toFixed(0)}% WR</span>
      </div>
      <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${wr}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function HeatmapCell({ wins, total }) {
  if (total === 0) return (
    <div style={{ background: "#0d1117", borderRadius: 4, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 9, color: "#2a2f3a" }}>-</span>
    </div>
  );
  const wr = wins / total;
  const alpha = Math.min(0.15 + wr * 0.75, 0.9);
  const bg = wr >= 0.55 ? `rgba(0,229,160,${alpha})` : wr >= 0.4 ? `rgba(245,200,66,${alpha})` : `rgba(255,77,109,${alpha})`;
  return (
    <div style={{ background: bg, borderRadius: 4, height: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#e6edf3" }}>{(wr * 100).toFixed(0)}%</span>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{total}t</span>
    </div>
  );
}

function EquityCurve({ data }) {
  if (!data || data.length < 2) return <div style={{ color: "#4b5563", fontSize: 12, padding: 20 }}>Not enough trades to render curve.</div>;
  const pts = data.map(d => d.pts);
  const min = Math.min(...pts, 0), max = Math.max(...pts, 0);
  const range = max - min || 1;
  const W = 600, H = 120, PAD = 12;
  const x = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const zeroY = y(0);
  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.pts).toFixed(1)}`).join(" ");
  const fillD = `${pathD} L${x(data.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const lineColor = data[data.length - 1].pts >= 0 ? "#00e5a0" : "#ff4d6d";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
      <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#2a2f3a" strokeWidth="1" strokeDasharray="4,4" />
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#eqGrad)" />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.pts)} r={3} fill={d.outcome === "Win" ? "#00e5a0" : d.outcome === "Loss" ? "#ff4d6d" : "#aaa"} />
      ))}
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function GCJournal() {
  const [trades, setTrades]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [syncing, setSyncing]             = useState(false);
  const [syncError, setSyncError]         = useState("");
  const [form, setForm]                   = useState(defaultForm());
  const [view, setView]                   = useState("journal");
  const [editId, setEditId]               = useState(null);
  const [filterGrade, setFilterGrade]     = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");
  const [filterMode, setFilterMode]       = useState("All");
  const [filterSearch, setFilterSearch]   = useState("");
  const [expandedId, setExpandedId]       = useState(null);
  const [userTz, setUserTz]               = useState("Europe/Berlin");
  const [sessionOverridden, setSessionOverridden] = useState(false);
  const [lightboxSrc, setLightboxSrc]     = useState(null);
  const [analyticsMode, setAnalyticsMode] = useState("All");
  const [analyticsMonth, setAnalyticsMonth] = useState("All");
  const [checkedRules, setCheckedRules]   = useState({});
  const [isDragging, setIsDragging]       = useState(false);
  const [pasteMode, setPasteMode]         = useState(false);

  // ── AI Coach state ─────────────────────────────────────────────────────
  const [coachAnalysis, setCoachAnalysis] = useState("");
  const [coachLoading, setCoachLoading]   = useState(false);
  const [coachError, setCoachError]       = useState("");
  const [reviewTrade, setReviewTrade]     = useState(null);
  const [reviewResult, setReviewResult]   = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError]     = useState("");

  // ── Position Calculator state ──────────────────────────────────────────
  const [calcAccount, setCalcAccount]     = useState("100000");
  const [calcRisk, setCalcRisk]           = useState("0.5");
  const [calcEntry, setCalcEntry]         = useState("");
  const [calcSL, setCalcSL]               = useState("");
  const [calcTP, setCalcTP]               = useState("");
  const [calcDir, setCalcDir]             = useState("Long");
  const fileRef       = useRef();
  const importRef     = useRef();
  const dropZoneRef   = useRef();
  const pasteTargetRef = useRef();

  useEffect(() => {
    setLoading(true);
    dbFetchAll()
      .then(rows => { setTrades(rows); setSyncError(""); })
      .catch(e => setSyncError("Could not connect to database: " + e.message))
      .finally(() => setLoading(false));
  }, []);

  // Keyboard shortcut: N = new trade
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && document.activeElement.tagName === "BODY") {
        setView("journal");
        setEditId(null);
        setForm(defaultForm());
        setSessionOverridden(false);
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const set = (k, v) => {
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
      const sl    = parseFloat(next.stopLoss);
      const tp    = parseFloat(next.takeProfit);

      // Recalculate points and RRR whenever any of the 4 inputs change
      if (!isNaN(entry) && !isNaN(sl)) {
        next.points = calcPointsFromOutcome(entry, sl, isNaN(tp) ? null : tp, next.direction, next.outcome);
        next.rrr    = calcRRRFromOutcome(entry, sl, isNaN(tp) ? null : tp, next.direction, next.outcome);
      }

      // Auto-calculate MAE from maePrice
      const maeP = parseFloat(next.maePrice);
      const entryP = parseFloat(next.entryPrice);
      if (!isNaN(maeP) && !isNaN(entryP) && next.direction) {
        const maePts = next.direction === "Long"
          ? (entryP - maeP) * 10
          : (maeP - entryP) * 10;
        next.mae = maePts > 0 ? maePts.toFixed(1) : "0.0";
      }
      return next;
    });
  };

  const loadImageFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({
      ...f,
      screenshots: [...(f.screenshots || []), { data: ev.target.result, name: file.name }]
    }));
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
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
    if (pasteTargetRef.current) pasteTargetRef.current.innerHTML = "";
  };

  const activatePasteMode = () => {
    setPasteMode(true);
    setTimeout(() => { if (pasteTargetRef.current) pasteTargetRef.current.focus(); }, 50);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => loadImageFile(f));
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const resetForm = () => {
    setEditId(null);
    setForm(defaultForm());
    setSessionOverridden(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const saveTrade = async () => {
    if (!form.entryDatetime || !form.direction || !form.tradeType) {
      alert("Please fill in Entry Date/Time, Direction, and Trade Type at minimum.");
      return;
    }
    setSyncing(true); setSyncError("");
    try {
      if (editId !== null) {
        const updated = { ...form, id: editId };
        await dbUpdate(updated);
        setTrades(ts => ts.map(t => t.id === editId ? updated : t));
      } else {
        const newTrade = { ...form, id: Date.now() };
        await dbInsert(newTrade);
        setTrades(ts => [newTrade, ...ts]);
      }
      resetForm();
    } catch(e) { setSyncError("Save failed: " + e.message); }
    finally { setSyncing(false); }
  };

  const editTrade = (t) => {
    setForm({ ...t });
    setEditId(t.id);
    setSessionOverridden(true);
    setView("journal");
    window.scrollTo(0, 0);
  };

  const duplicateTrade = (t) => {
    const { id, screenshots, entryDatetime, exitDatetime, points, rrr, outcome, notes, mae, maePrice, executionGrade, ...rest } = t;
    setForm({ ...defaultForm(), ...rest, entryDatetime: "", exitDatetime: "", points: "", rrr: "", outcome: "Win", notes: "", mae: "", maePrice: "", executionGrade: "Ungraded", screenshots: [] });
    setEditId(null);
    setSessionOverridden(true);
    setView("journal");
    window.scrollTo(0, 0);
  };

  const deleteTrade = async (id) => {
    if (!window.confirm("Delete this trade?")) return;
    setSyncing(true);
    try { await dbDelete(id); setTrades(ts => ts.filter(t => t.id !== id)); }
    catch(e) { setSyncError("Delete failed: " + e.message); }
    finally { setSyncing(false); }
  };

  const deleteAllTrades = async () => {
    if (!window.confirm("Delete ALL trades? This cannot be undone.")) return;
    setSyncing(true);
    try { await dbDeleteAll(); setTrades([]); setExpandedId(null); }
    catch(e) { setSyncError("Delete all failed: " + e.message); }
    finally { setSyncing(false); }
  };

  const exportCSV = () => {
    const headers = Object.keys(defaultForm()).filter(k => k !== "screenshots");
    const rows = trades.map(t => headers.map(h => JSON.stringify(t[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "gc_trades.csv";
    a.click();
  };

  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(Boolean);
        const headers = lines[0].split(",");
        const imported = lines.slice(1).map((line, i) => {
          const vals = line.match(/(\".*?\"|[^,]+)/g) || [];
          const obj = {};
          headers.forEach((h, idx) => { try { obj[h] = JSON.parse(vals[idx] || "null"); } catch(e) { obj[h] = vals[idx] || ""; } });
          obj.id = Date.now() + i;
          return obj;
        });
        if (!window.confirm(`Import ${imported.length} trades? This ADDS to existing trades.`)) return;
        setSyncing(true);
        for (const t of imported) await dbInsert(t);
        setTrades(await dbFetchAll());
        setSyncError("");
      } catch(err) { setSyncError("Import failed: " + err.message); }
      finally { setSyncing(false); if (importRef.current) importRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  // ── Streak calculation ─────────────────────────────────────────────────
  // curLoss resets on a new trading week (stop-week rule)
  // curWin never resets on week boundary — win streaks are continuous
  const streaks = useMemo(() => {
    const getWeekKey = (dt) => {
      if (!dt) return "";
      const d = new Date(dt);
      const day = d.getUTCDay() || 7; // Mon=1 ... Sun=7
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - day + 1);
      return monday.toISOString().slice(0, 10);
    };

    const sorted = [...trades].sort((a, b) => a.entryDatetime < b.entryDatetime ? -1 : 1);
    let curWin = 0, curLoss = 0, maxWin = 0, maxLoss = 0;
    let prevWeek = null;

    sorted.forEach(t => {
      const week = getWeekKey(t.entryDatetime);
      // New week: reset loss streak only (stop-week rule resets each Monday)
      if (week && week !== prevWeek) {
        curLoss = 0;
        prevWeek = week;
      }
      if (t.outcome === "Win")        { curWin++; curLoss = 0; maxWin  = Math.max(maxWin,  curWin);  }
      else if (t.outcome === "Loss")  { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
      else                            { curWin = 0; curLoss = 0; }
    });
    return { curWin, curLoss, maxWin, maxLoss };
  }, [trades]);

  // ── Analytics ──────────────────────────────────────────────────────────
  const analyticsTrades = useMemo(() => {
    let src = trades;
    if (analyticsMode !== "All") src = src.filter(t => (t.tradeMode || "Backtest") === analyticsMode);
    if (analyticsMonth !== "All") src = src.filter(t => t.entryDatetime && t.entryDatetime.slice(0, 7) === analyticsMonth);
    return src;
  }, [trades, analyticsMode, analyticsMonth]);

  // Available months derived from all trades
  const availableMonths = useMemo(() => {
    const months = [...new Set(trades.map(t => t.entryDatetime?.slice(0, 7)).filter(Boolean))].sort().reverse();
    return months;
  }, [trades]);

  const stats = useMemo(() => {
    const src = analyticsTrades;
    if (!src.length) return null;
    const wins   = src.filter(t => t.outcome === "Win");
    const losses = src.filter(t => t.outcome === "Loss");
    const winRate    = ((wins.length / src.length) * 100).toFixed(1);
    const avgRRR     = wins.length
      ? (wins.reduce((a, t) => a + (parseFloat(t.rrr) || 0), 0) / wins.length).toFixed(2)
      : "0.00";
    const winRate01  = wins.length / src.length;
    const expectancy = ((winRate01 * 2) - ((1 - winRate01) * 1)).toFixed(2); // R per trade
    const avgPoints  = (src.reduce((a, t) => a + (parseFloat(t.points) || 0), 0) / src.length).toFixed(1);
    const totalPoints = src.reduce((a, t) => a + (parseFloat(t.points) || 0), 0).toFixed(1);
    const avgMAE     = src.filter(t => t.mae).length
      ? (src.filter(t => t.mae).reduce((a, t) => a + parseFloat(t.mae), 0) / src.filter(t => t.mae).length).toFixed(1)
      : null;

    const byGrade = {};
    GRADES.forEach(g => { const gt = src.filter(t => t.grade === g); byGrade[g] = { total: gt.length, wins: gt.filter(t => t.outcome === "Win").length }; });

    const byExecGrade = {};
    GRADES.forEach(g => { const gt = src.filter(t => t.executionGrade === g); byExecGrade[g] = { total: gt.length, wins: gt.filter(t => t.outcome === "Win").length }; });

    const byCandle = {}, bySession = {}, byType = {}, byHtf = {}, byStructure = {};
    src.forEach(t => {
      const add = (obj, key) => { if (!key) return; if (!obj[key]) obj[key] = { total: 0, wins: 0 }; obj[key].total++; if (t.outcome === "Win") obj[key].wins++; };
      add(byCandle, t.candlePattern); add(bySession, t.session); add(byType, t.tradeType); add(byHtf, t.htfBias); add(byStructure, t.marketStructure);
    });

    const heatmap = {};
    for (let h = 0; h < 24; h++) heatmap[h] = { Long: { total: 0, wins: 0 }, Short: { total: 0, wins: 0 } };
    src.forEach(t => {
      const hr = getETHour(t.entryDatetime);
      if (hr === null || !t.direction) return;
      if (!heatmap[hr][t.direction]) heatmap[hr][t.direction] = { total: 0, wins: 0 };
      heatmap[hr][t.direction].total++;
      if (t.outcome === "Win") heatmap[hr][t.direction].wins++;
    });

    const sorted = [...src].sort((a, b) => a.entryDatetime < b.entryDatetime ? -1 : 1);
    let cum = 0;
    const equity = sorted.map(t => { cum += parseFloat(t.points) || 0; return { pts: parseFloat(cum.toFixed(1)), outcome: t.outcome }; });

    // Gain % — 1% risk per trade, 2% gain per win, 1% loss per loss
    const gainPct = (wins.length * 2 - losses.length * 1).toFixed(1);

    // Monthly breakdown
    const byMonth = {};
    src.forEach(t => {
      const mo = t.entryDatetime?.slice(0, 7);
      if (!mo) return;
      if (!byMonth[mo]) byMonth[mo] = { wins: 0, losses: 0, points: 0 };
      if (t.outcome === "Win") byMonth[mo].wins++;
      else if (t.outcome === "Loss") byMonth[mo].losses++;
      byMonth[mo].points += parseFloat(t.points) || 0;
    });
    const monthlyData = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([mo, d]) => ({
      mo, ...d,
      total: d.wins + d.losses,
      wr: d.wins + d.losses ? ((d.wins / (d.wins + d.losses)) * 100).toFixed(0) : 0,
      gainPct: (d.wins * 2 - d.losses * 1).toFixed(1),
      points: d.points.toFixed(1),
    }));
    const setupVsExec = { AA: 0, AB: 0, BA: 0, BB: 0, other: 0 };
    src.forEach(t => {
      const key = (t.grade || "U") + (t.executionGrade || "U");
      if (key === "AA") setupVsExec.AA++;
      else if (key === "AB" || key === "AC") setupVsExec.AB++;
      else if (key === "BA" || key === "CA") setupVsExec.BA++;
      else if (key === "BB") setupVsExec.BB++;
      else setupVsExec.other++;
    });

    return { wins: wins.length, losses: losses.length, winRate, avgRRR, avgPoints, totalPoints, gainPct, expectancy, avgMAE, byGrade, byExecGrade, byCandle, bySession, byType, byHtf, byStructure, heatmap, equity, setupVsExec, monthlyData };
  }, [analyticsTrades]);

  // ── Filtered / grouped log ─────────────────────────────────────────────
  const filteredTrades = useMemo(() => {
    return trades
      .filter(t => filterGrade === "All" || t.grade === filterGrade)
      .filter(t => filterOutcome === "All" || t.outcome === filterOutcome)
      .filter(t => filterMode === "All" || (t.tradeMode || "Backtest") === filterMode)
      .filter(t => !filterSearch || (t.notes || "").toLowerCase().includes(filterSearch.toLowerCase()) || (t.tradeType || "").toLowerCase().includes(filterSearch.toLowerCase()) || (t.candlePattern || "").toLowerCase().includes(filterSearch.toLowerCase()))
      .sort((a, b) => (a.entryDatetime < b.entryDatetime ? 1 : -1));
  }, [trades, filterGrade, filterOutcome, filterMode, filterSearch]);

  // Group by date for daily P&L
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredTrades.forEach(t => {
      const d = t.entryDatetime ? t.entryDatetime.split("T")[0] : "Unknown";
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTrades]);

  const activeHours = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.heatmap).map(Number).filter(h => stats.heatmap[h].Long.total > 0 || stats.heatmap[h].Short.total > 0);
  }, [stats]);

  const inp      = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", color: "#e6edf3", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };
  const autoInp  = { ...inp, background: "#111827", border: "1px solid #00e5a044", color: "#f5c842", fontWeight: 700 };
  const lbl      = { display: "block", fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 };
  const autoBadge = <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(0,229,160,0.12)", padding: "1px 6px", borderRadius: 4, color: "#00e5a0", fontWeight: 700 }}>AUTO</span>;

  const syncIndicator = syncing
    ? <span style={{ fontSize: 10, color: "#f5c842", letterSpacing: 1 }}>saving...</span>
    : syncError
    ? <span style={{ fontSize: 10, color: "#ff4d6d" }}>{syncError}</span>
    : trades.length > 0
    ? <span style={{ fontSize: 10, color: "#00e5a0" }}>cloud synced</span>
    : null;

  const confluence = calcConfluence(form);

  const RULES = [
    { category: "Pre-Trade Checklist", color: "#3b82f6", icon: "CHECK", description: "Must meet ALL before entering a trade", checklist: true,
      rules: [
        { id: "r1", text: "HTF bias (Daily/4H) is clearly Bullish or Bearish — no trading in Ranging or Uncertain conditions until you have 200+ trades of data" },
        { id: "r2", text: "Entry is in a confirmed kill zone — London open (3-5 AM ET) or New York open (9:30-10:30 AM ET) only" },
        { id: "r3", text: "A clear candle pattern signal is present on your entry timeframe" },
        { id: "r4", text: "Stop loss is placed behind a structural level — a swing high/low, not a round number or arbitrary distance" },
        { id: "r5", text: "Risk/reward is at minimum 1:2 before entry — if the target does not offer at least 2x the risk, skip the trade" },
        { id: "r6", text: "No active high-impact news within 15 minutes of entry (CPI, NFP, FOMC, Powell speeches)" },
      ],
    },
    { category: "Risk Rules", color: "#ff4d6d", icon: "RISK", description: "Non-negotiable — follow these without exception", checklist: false,
      rules: [
        { id: "r7",  text: "Maximum 1% of account risked per trade — no exceptions" },
        { id: "r8",  text: "Maximum 2 trades open simultaneously" },
        { id: "r9",  text: "3 consecutive losses = stop trading for the remainder of the week — no revenge trading, no exceptions" },
        { id: "r10", text: "Down 3% on the week = stop trading until Monday — protect capital above all else" },
        { id: "r11", text: "Never move your stop loss further away once a trade is live — you may move it to breakeven or tighter, never wider" },
        { id: "r12", text: "Never add to a losing position" },
      ],
    },
    { category: "Execution Rules", color: "#f5c842", icon: "EXEC", description: "Discipline at the point of entry and exit", checklist: false,
      rules: [
        { id: "r13", text: "Only trade pre-defined setup types — if you cannot name the setup before entry it does not qualify" },
        { id: "r14", text: "Do not enter a trade in the last 30 minutes before a scheduled high-impact news event" },
        { id: "r15", text: "Do not trade the first 5 minutes of any session open — wait for the initial volatility to settle and direction to show" },
        { id: "r16", text: "If you missed the entry, let it go — do not chase price more than 3-4 ticks from your planned entry" },
        { id: "r17", text: "Grade every trade A, B or C before you enter, not after — if it is a C setup, consider skipping it entirely" },
      ],
    },
    { category: "Post-Trade & Review", color: "#a78bfa", icon: "LOG", description: "How you learn and improve over time", checklist: false,
      rules: [
        { id: "r18", text: "Screenshot every trade immediately after closing — do not rely on memory" },
        { id: "r19", text: "Write your notes within 10 minutes of closing the trade while the reasoning is fresh" },
        { id: "r20", text: "Review your journal every Sunday — look at the week's trades, not individual days" },
        { id: "r21", text: "After every 50 trades, run a full analytics review — if your live win rate drops below 40% for 50+ trades, return to backtesting before continuing live" },
        { id: "r22", text: "Never change your system rules mid-week — write proposed changes down and implement on Monday only" },
      ],
    },
    { category: "Mindset Rules", color: "#00e5a0", icon: "MIND", description: "The mental edge that separates consistent traders", checklist: false,
      rules: [
        { id: "r23", text: "A loss is not a mistake if you followed your rules — a loss on a valid setup is the cost of doing business" },
        { id: "r24", text: "A win on a rule-breaking trade is more dangerous than a loss — it reinforces bad habits" },
        { id: "r25", text: "Your job is to execute the process, not predict the market — focus on did I follow my rules, not did I make money today" },
        { id: "r26", text: "Keep position sizing consistent — do not increase size after a winning streak or decrease out of fear after losses until you have 200+ live trades of data" },
      ],
    },
    {
      category: "Confluence Score — What Each Point Means",
      color: "#f97316",
      icon: "6/6",
      description: "The journal scores your setup 0–6 live as you fill in the form. Each point below is one confluence. Aim for 5–6 before entering.",
      checklist: false,
      rules: [
        { id: "c1", text: "HTF Bias is clear — Daily or 4H trend is set to Bullish or Bearish. Ranging or Uncertain = 0 points here. Trading against a clear bias is one of the most common reasons for avoidable losses." },
        { id: "c2", text: "Kill zone entry — Your entry time falls between 03:00–05:00 ET (London open) or 09:00–11:00 ET (New York open). These are the two highest-liquidity windows for GC. Entries outside these windows score 0 for this point." },
        { id: "c3", text: "Candle pattern present — A named pattern is selected on the form. A signal candle on your entry timeframe is required — a confluence without a trigger is not a trade, it is a guess." },
        { id: "c4", text: "Stop loss placed behind structure — Both entry price and stop loss are filled in with a real distance between them. A stop is not valid if it is a round number or arbitrary pip distance; it must sit behind a swing high or low." },
        { id: "c5", text: "RRR is at least 1:2 — The auto-calculated risk/reward ratio is 2.0 or higher. This is non-negotiable. If the target does not offer twice the risk, the setup does not qualify regardless of how good the signal looks." },
        { id: "c6", text: "News is clear — No high-impact event is detected within 30 minutes of your entry, or the news impact is Low. CPI, NFP, FOMC, and Powell speeches all score 0 here. The journal auto-detects these from the built-in calendar." },
      ],
    },
    {
      category: "MAE — Max Adverse Excursion",
      color: "#a78bfa",
      icon: "MAE",
      description: "One of the most underused metrics in retail trading. Log it on every trade — it reveals whether your stops are sized correctly over time.",
      checklist: false,
      rules: [
        { id: "m1", text: "What MAE is — Max Adverse Excursion is how far price moved against you, in points, before the trade resolved. On a Long trade, it is the distance from your entry down to the lowest wick reached before price reversed or hit your stop. On a Short, it is the distance up to the highest wick." },
        { id: "m2", text: "How to measure it — After closing the trade, look at the chart and find the worst price reached against your position before resolution. For a Long, this is the lowest wick. For a Short, this is the highest wick. Enter that price in the MAE Extreme Price field and the journal calculates the points automatically." },
        { id: "m3", text: "What a low MAE on winning trades tells you — If your winners consistently show a MAE of 2–5 points, your entries are precise and price is moving in your direction almost immediately. This is the ideal. It means your timing and confluence are working." },
        { id: "m4", text: "What a high MAE on winning trades tells you — If price goes 15–20 points against you before eventually winning, your stop is wide enough to survive but your entry is early or imprecise. You are enduring unnecessary heat. Consider tightening your entry trigger or waiting for more confirmation." },
        { id: "m5", text: "What MAE on losing trades tells you — If your losses show a MAE equal to your full stop distance, price went straight to your stop without hesitation. This is normal and expected on invalid setups. If MAE on losses is consistently less than your stop, your stops may be too tight — you are getting stopped out before the trade had a chance to work." },
        { id: "m6", text: "The goal over 50+ trades — Your average MAE on winning trades should be significantly smaller than your stop size. If your average stop is 15 points and your average MAE on winners is 12 points, you are nearly getting stopped out on every winner. That is a sign to either widen stops slightly or improve entry precision." },
      ],
    },
  ];

  const allChecklistIds = RULES.find(s => s.checklist).rules.map(r => r.id);

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', 'Courier New', monospace", background: "#070b12", minHeight: "100vh", color: "#e6edf3" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* LIGHTBOX */}
      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 24 }}>
          <div style={{ position: "absolute", top: 20, right: 28, fontSize: 26, color: "#8b949e", cursor: "pointer" }} onClick={() => setLightboxSrc(null)}>×</div>
          <img src={lightboxSrc} alt="chart" style={{ maxWidth: "95vw", maxHeight: "92vh", borderRadius: 10, border: "1px solid #2a2f3a" }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0d1117, #111827)", borderBottom: "1px solid #1f2937", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #f5c842, #ff9a3c)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f5c842", letterSpacing: 2 }}>GC FUTURES JOURNAL</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3 }}>GOLD · {trades.length} TRADES</span>
              {syncIndicator}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {["journal","log","analytics","rules","calc","coach"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${view === v ? "#f5c842" : "#2a2f3a"}`, background: view === v ? "rgba(245,200,66,0.1)" : "transparent", color: view === v ? "#f5c842" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit" }}>
              {v === "calc" ? "Position" : v === "coach" ? "AI Coach" : v}
            </button>
          ))}
          <button onClick={exportCSV} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>CSV ↓</button>
          <label style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            CSV ↑<input ref={importRef} type="file" accept=".csv" onChange={importCSV} style={{ display: "none" }} />
          </label>
          <select value={userTz} onChange={e => { setUserTz(e.target.value); setSessionOverridden(false); }} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "7px 10px", color: "#f5c842", fontSize: 10, fontFamily: "inherit" }}>
            {TIMEZONES.map(t => <option key={t.tz} value={t.tz}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* STREAK BANNER */}
      {!loading && trades.length > 0 && (
        <div style={{ background: "#0d1117", borderBottom: "1px solid #1f2937", padding: "8px 24px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3 }}>STREAKS</span>
          <span style={{ fontSize: 11, color: streaks.curWin > 0 ? "#00e5a0" : "#4b5563" }}>
            Current: {streaks.curWin > 0 ? `🔥 ${streaks.curWin}W` : streaks.curLoss > 0 ? `❄️ ${streaks.curLoss}L` : "—"}
          </span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Best win streak: <span style={{ color: "#00e5a0" }}>{streaks.maxWin}W</span></span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Worst loss streak: <span style={{ color: "#ff4d6d" }}>{streaks.maxLoss}L</span></span>
          {streaks.curLoss >= 2 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#ff4d6d", background: "rgba(255,77,109,0.1)", padding: "2px 10px", borderRadius: 20, border: "1px solid #ff4d6d44" }}>
              {streaks.curLoss >= 3 ? "⚠ STOP WEEK — 3 consecutive losses reached" : "⚠ Warning: 2 losses — 1 more = stop for the week"}
            </span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#4b5563" }}>Press N for new trade</span>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: "center", padding: 80, color: "#f5c842", fontSize: 13 }}>
          <div style={{ marginBottom: 12, fontSize: 24 }}>⚡</div>
          Loading trades from cloud...
        </div>
      )}

      {/* ═══ JOURNAL ═══ */}
      {!loading && view === "journal" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase" }}>
                {editId ? "Edit Trade" : "+ Log New Trade"}
              </div>
              {/* Confluence Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2 }}>CONFLUENCE</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i <= confluence ? confluenceColor(confluence) : "#1f2937", transition: "background 0.3s" }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: confluenceColor(confluence) }}>{confluence}/6</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 14 }}>

              {/* confluence fields get a diamond marker in the label */}
              {/* c1 — HTF Bias */}
              {/* c2 — Entry Datetime (kill zone) */}
              {/* c3 — Candle Pattern */}
              {/* c4 — Stop Loss (placed behind structure) */}
              {/* c5 — RRR ≥ 2 */}
              {/* c6 — News clear */}

              <div>
                <label style={lbl}>
                  Entry Date &amp; Time (ET)
                  <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: kill zone entry">◆</span>
                </label>
                <input type="datetime-local" value={form.entryDatetime} onChange={e => set("entryDatetime", e.target.value)} style={inp} />
              </div>

              <div><label style={lbl}>Exit Date &amp; Time (ET)</label><input type="datetime-local" value={form.exitDatetime} onChange={e => set("exitDatetime", e.target.value)} style={inp} /></div>
              <div><label style={{ ...lbl, color: "#f5c842" }}>Duration {autoBadge}</label><input readOnly value={calcDuration(form.entryDatetime, form.exitDatetime)} placeholder="--" style={autoInp} /></div>

              <div>
                <label style={lbl}>
                  Session
                  {form.session && !sessionOverridden && autoBadge}
                  {sessionOverridden && <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(245,200,66,0.1)", padding: "1px 6px", borderRadius: 4, color: "#f5c842", cursor: "pointer" }} onClick={() => { setSessionOverridden(false); const d = detectSession(form.entryDatetime); if (d) set("session", d); }}>MANUAL reset</span>}
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
                </label>
                <input type="number" step="0.1" value={form.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="2345.0" style={inp} />
              </div>

              <div><label style={lbl}>Take Profit</label><input type="number" step="0.1" value={form.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="2370.0" style={inp} /></div>

              <div>
                <label style={{ ...lbl, color: "#f5c842" }}>
                  Points {autoBadge}
                </label>
                <input readOnly value={form.points} placeholder="--" style={autoInp} />
              </div>

              <div>
                <label style={{ ...lbl, color: "#f5c842" }}>
                  RRR {autoBadge}
                  <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: RRR ≥ 2.0">◆</span>
                </label>
                <input readOnly value={form.rrr} placeholder="--" style={autoInp} />
              </div>

              <div>
                <label style={lbl}>MAE Extreme Price</label>
                <input type="number" step="0.1" value={form.maePrice} onChange={e => set("maePrice", e.target.value)} placeholder={form.direction === "Short" ? "Highest price reached" : "Lowest price reached"} style={inp} />
              </div>
              <div>
                <label style={{ ...lbl, color: "#f5c842" }}>MAE Points {autoBadge}</label>
                <input readOnly value={form.mae} placeholder="--" style={autoInp} />
              </div>

              <div>
                <label style={lbl}>
                  Candle Pattern
                  <span style={{ marginLeft: 6, fontSize: 9, color: "#f97316", fontWeight: 700 }} title="Confluence: signal candle present">◆</span>
                </label>
                <select value={form.candlePattern} onChange={e => set("candlePattern", e.target.value)} style={inp}>{CANDLE_PATTERNS.map(s => <option key={s}>{s}</option>)}</select>
              </div>

              <div><label style={lbl}>Wick Direction</label><select value={form.wickDirection} onChange={e => set("wickDirection", e.target.value)} style={inp}>{["None","Upper","Lower","Both"].map(s => <option key={s}>{s}</option>)}</select></div>

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
                    {["Low","Medium","High"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ ...lbl, color: "#f5c842" }}>Outcome {autoBadge}</label>
                <select value={form.outcome} onChange={e => set("outcome", e.target.value)} style={{ ...inp, background: "#111827", border: "1px solid #00e5a044", color: outcomeColor(form.outcome), fontWeight: 700 }}>
                  {["Win","Loss","Breakeven"].map(s => <option key={s}>{s}</option>)}
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

            {/* confluence legend */}
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "#f97316", fontWeight: 700 }}>◆</span>
              <span style={{ fontSize: 9, color: "#4b5563", letterSpacing: 1 }}>CONTRIBUTES TO CONFLUENCE SCORE</span>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={lbl}>Notes / Observations</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Context, confluences, HTF alignment, what you would do differently..." style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={lbl}>Chart Screenshots ({form.screenshots?.length || 0} added)</label>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => Array.from(e.target.files).forEach(f => loadImageFile(f))} style={{ display: "none" }} />
              <div ref={dropZoneRef} onPaste={handlePaste} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} tabIndex={0}
                style={{ border: `2px dashed ${isDragging ? "#f5c842" : (form.screenshots?.length > 0) ? "#00e5a044" : "#2a2f3a"}`, borderRadius: 12, background: isDragging ? "rgba(245,200,66,0.05)" : "#070b12", padding: "16px", textAlign: "center", transition: "all 0.2s ease", outline: "none" }}>

                {/* Thumbnails grid */}
                {form.screenshots?.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
                    {form.screenshots.map((ss, idx) => (
                      <div key={idx} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2f3a" }}>
                        <img src={ss.data} alt={ss.name} onClick={() => setLightboxSrc(ss.data)}
                          style={{ width: "100%", height: 120, objectFit: "cover", cursor: "zoom-in", display: "block" }} />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{ss.name}</span>
                          <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, screenshots: f.screenshots.filter((_, i) => i !== idx) })); }}
                            style={{ fontSize: 10, color: "#ff4d6d", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, flexShrink: 0 }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add more / paste zone */}
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
                        <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, screenshots: [] })); if (fileRef.current) fileRef.current.value = ""; }}
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

            {/* News warning */}
            {(() => {
              const detected = detectNewsEvent(form.entryDatetime);
              if (!detected) return null;
              return (
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(245,200,66,0.08)", border: "1px solid #f5c84266", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 16 }}>!</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", marginBottom: 2 }}>News Window: {detected.event}</div>
                    <div style={{ fontSize: 10, color: "#8b949e" }}>Entry falls within 30 min of {detected.event}. Verify this is intentional before saving.</div>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={saveTrade} disabled={syncing} style={{ padding: "11px 28px", background: syncing ? "#2a2f3a" : "linear-gradient(135deg, #f5c842, #ff9a3c)", borderRadius: 10, border: "none", color: syncing ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 12, cursor: syncing ? "not-allowed" : "pointer", letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit" }}>
                {syncing ? "Saving..." : editId ? "Update Trade" : "Save Trade"}
              </button>
              {editId && <button onClick={resetForm} style={{ padding: "11px 20px", background: "transparent", borderRadius: 10, border: "1px solid #2a2f3a", color: "#8b949e", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>}
              {syncError && <span style={{ fontSize: 11, color: "#ff4d6d" }}>{syncError}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOG ═══ */}
      {!loading && view === "log" && (
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px" }}>
          {/* Filters + search */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>FILTER:</span>
            {[
              { val: filterGrade, set: setFilterGrade, opts: ["All Grades", ...GRADES] },
              { val: filterOutcome, set: setFilterOutcome, opts: ["All Outcomes","Win","Loss","Breakeven"] },
              { val: filterMode, set: setFilterMode, opts: ["All Modes", ...TRADE_MODES] },
            ].map(({ val, set: setter, opts }, i) => (
              <select key={i} value={val} onChange={e => setter(e.target.value)} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 10px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit" }}>
                {opts.map(o => <option key={o} value={o.startsWith("All") ? "All" : o}>{o}</option>)}
              </select>
            ))}
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search notes, type, pattern..." style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 12px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit", minWidth: 200 }} />
            <span style={{ fontSize: 10, color: "#6b7280" }}>{filteredTrades.length} trades</span>
            {trades.length > 0 && <button onClick={deleteAllTrades} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 7, border: "1px solid #ff4d6d55", background: "rgba(255,77,109,0.07)", color: "#ff4d6d", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete All</button>}
          </div>

          {filteredTrades.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 13 }}>No trades found.</div>
          ) : (
            <div>
              {groupedByDate.map(([date, dayTrades]) => {
                const dayPts = dayTrades.reduce((a, t) => a + (parseFloat(t.points) || 0), 0);
                const dayWins = dayTrades.filter(t => t.outcome === "Win").length;
                return (
                  <div key={date} style={{ marginBottom: 20 }}>
                    {/* Daily header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 12px", background: "#0d1117", borderRadius: "10px 10px 0 0", border: "1px solid #1f2937", borderBottom: "none" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#f5c842" }}>{formatDate(date + "T00:00")}</span>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{dayTrades.length} trades</span>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{dayWins}W / {dayTrades.length - dayWins}L</span>
                      <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: dayPts >= 0 ? "#00e5a0" : "#ff4d6d" }}>{dayPts >= 0 ? "+" : ""}{dayPts.toFixed(1)} pts</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {dayTrades.map(t => (
                        <div key={t.id} style={{ background: "#0d1117", border: "1px solid #1f2937", borderTop: "none", overflow: "hidden" }}>
                          <div onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, color: "#6b7280", minWidth: 50 }}>{t.entryDatetime ? t.entryDatetime.split("T")[1]?.slice(0,5) : "--"}</span>
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
                            <button onClick={e => { e.stopPropagation(); duplicateTrade(t); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }} title="Duplicate setup">Copy</button>
                            <button onClick={e => { e.stopPropagation(); editTrade(t); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                            <button onClick={e => { e.stopPropagation(); deleteTrade(t.id); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ff4d6d44", background: "transparent", color: "#ff4d6d", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Del</button>
                          </div>
                          {expandedId === t.id && (
                            <div style={{ borderTop: "1px solid #1f2937", padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 }}>
                              {[["Entry", formatDatetime(t.entryDatetime)],["Exit", formatDatetime(t.exitDatetime)],["Duration", calcDuration(t.entryDatetime, t.exitDatetime)],["Session", t.session],["HTF Bias", t.htfBias],["Market Structure", t.marketStructure],["Lot Size", t.lotSize],["Entry Price", t.entryPrice],["Stop Loss", t.stopLoss],["Take Profit", t.takeProfit],["MAE", t.mae ? t.mae + " pts" : ""],["Wick", t.wickDirection !== "None" ? t.wickDirection : ""],["News", t.news !== "None" ? t.news : ""],["News Impact", t.news !== "None" ? t.newsImpact : ""],["Setup Grade", t.grade],["Exec Grade", t.executionGrade || "Ungraded"]].map(([k, v]) => v ? (
                                <div key={k}><div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 12, color: "#e6edf3" }}>{v}</div></div>
                              ) : null)}
                              {t.notes && <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{t.notes}</div></div>}
                              {t.screenshots?.length > 0 && <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Screenshots ({t.screenshots.length})</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>{t.screenshots.map((ss, idx) => <img key={idx} src={ss.data} alt={ss.name} onClick={() => setLightboxSrc(ss.data)} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block" }} />)}</div></div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYTICS ═══ */}
      {!loading && view === "analytics" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>MODE:</span>
            {["All", ...TRADE_MODES].map(m => (
              <button key={m} onClick={() => setAnalyticsMode(m)} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMode === m ? "#f5c842" : "#2a2f3a"}`, background: analyticsMode === m ? "rgba(245,200,66,0.1)" : "transparent", color: analyticsMode === m ? "#f5c842" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                {m}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>MONTH:</span>
            <button onClick={() => setAnalyticsMonth("All")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMonth === "All" ? "#a78bfa" : "#2a2f3a"}`, background: analyticsMonth === "All" ? "rgba(167,139,250,0.1)" : "transparent", color: analyticsMonth === "All" ? "#a78bfa" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>All</button>
            {availableMonths.map(m => {
              const label = new Date(m + "-02").toLocaleString("en-US", { month: "short", year: "2-digit" });
              return (
                <button key={m} onClick={() => setAnalyticsMonth(m)} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMonth === m ? "#a78bfa" : "#2a2f3a"}`, background: analyticsMonth === m ? "rgba(167,139,250,0.1)" : "transparent", color: analyticsMonth === m ? "#a78bfa" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {label}
                </button>
              );
            })}
            <span style={{ fontSize: 10, color: "#4b5563" }}>{analyticsTrades.length} trades</span>
          </div>

          {!stats ? (
            <div style={{ textAlign: "center", padding: 80, color: "#4b5563", fontSize: 13 }}>No trade data yet. Log some trades first.</div>
          ) : (<>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[
                ["Total Trades", analyticsTrades.length, "#e6edf3"],
                ["Win Rate", `${stats.winRate}%`, "#00e5a0"],
                ["Total Points", stats.totalPoints, parseFloat(stats.totalPoints) >= 0 ? "#00e5a0" : "#ff4d6d"],
                ["Overall Gain", `${parseFloat(stats.gainPct) >= 0 ? "+" : ""}${stats.gainPct}%`, parseFloat(stats.gainPct) >= 0 ? "#00e5a0" : "#ff4d6d"],
                ["Avg Pts/Trade", stats.avgPoints, "#e6edf3"],
                ["Avg RRR (wins)", stats.avgRRR, "#f5c842"],
                ["Expectancy", `${parseFloat(stats.expectancy) >= 0 ? "+" : ""}${stats.expectancy}R`, parseFloat(stats.expectancy) >= 0 ? "#00e5a0" : "#ff4d6d"],
                ["W / L", `${stats.wins} / ${stats.losses}`, "#e6edf3"],
                ["Win Streak", `${streaks.curWin}W cur / ${streaks.maxWin}W best`, "#00e5a0"],
                ["Loss Streak", `${streaks.curLoss}L cur / ${streaks.maxLoss}L worst`, streaks.curLoss >= 3 ? "#ff4d6d" : "#e6edf3"],
                ...(stats.avgMAE ? [["Avg MAE", `${stats.avgMAE} pts`, "#a78bfa"]] : []),
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "#0d1117", border: label === "Overall Gain" ? `1px solid ${parseFloat(stats.gainPct) >= 0 ? "#00e5a044" : "#ff4d6d44"}` : "1px solid #1f2937", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: label.includes("Streak") ? 14 : 22, fontWeight: 700, color }}>{val}</div>
                  {label === "Overall Gain" && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>+2% per win · −1% per loss</div>}
                  {label === "Avg RRR (wins)" && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>losses excluded</div>}
                  {label === "Expectancy" && <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>R earned per trade avg</div>}
                </div>
              ))}
            </div>

            {/* Monthly Breakdown Table */}
            {analyticsMonth === "All" && stats.monthlyData.length > 0 && (
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Monthly Breakdown</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["Month","Trades","W","L","Win Rate","Points","Gain %"].map(h => (
                          <td key={h} style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", paddingBottom: 10, paddingRight: 16, whiteSpace: "nowrap" }}>{h}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.monthlyData.map((m, i) => {
                        const gain = parseFloat(m.gainPct);
                        const pts  = parseFloat(m.points);
                        return (
                          <tr key={m.mo} style={{ borderTop: "1px solid #1f2937" }}>
                            <td style={{ padding: "10px 16px 10px 0", color: "#e6edf3", fontWeight: 700 }}>
                              {new Date(m.mo + "-02").toLocaleString("en-US", { month: "short", year: "numeric" })}
                            </td>
                            <td style={{ padding: "10px 16px 10px 0", color: "#9ca3af" }}>{m.total}</td>
                            <td style={{ padding: "10px 16px 10px 0", color: "#00e5a0" }}>{m.wins}</td>
                            <td style={{ padding: "10px 16px 10px 0", color: "#ff4d6d" }}>{m.losses}</td>
                            <td style={{ padding: "10px 16px 10px 0", color: parseInt(m.wr) >= 55 ? "#00e5a0" : parseInt(m.wr) >= 40 ? "#f5c842" : "#ff4d6d", fontWeight: 700 }}>{m.wr}%</td>
                            <td style={{ padding: "10px 16px 10px 0", color: pts >= 0 ? "#00e5a0" : "#ff4d6d", fontWeight: 700 }}>{pts >= 0 ? "+" : ""}{m.points}</td>
                            <td style={{ padding: "10px 16px 10px 0", fontWeight: 700 }}>
                              <span style={{ color: gain >= 0 ? "#00e5a0" : "#ff4d6d", background: gain >= 0 ? "rgba(0,229,160,0.08)" : "rgba(255,77,109,0.08)", padding: "2px 10px", borderRadius: 20 }}>
                                {gain >= 0 ? "+" : ""}{m.gainPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Equity Curve */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Equity Curve — Cumulative Points</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 10 }}>Dots: green=win red=loss</div>
              <EquityCurve data={stats.equity} />
            </div>

            {/* Charts grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Setup Grade</div>
                {GRADES.map(g => <BarRow key={g} label={`Grade ${g}`} wins={stats.byGrade[g].wins} total={stats.byGrade[g].total} color={gradeColor(g)} />)}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Execution Grade</div>
                {GRADES.map(g => <BarRow key={g} label={`Exec ${g}`} wins={stats.byExecGrade[g].wins} total={stats.byExecGrade[g].total} color={gradeColor(g)} />)}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Session Performance</div>
                {Object.entries(stats.bySession).sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total)).map(([s,d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color="#3b82f6" />)}
                {!Object.keys(stats.bySession).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>HTF Bias Win Rate</div>
                {Object.entries(stats.byHtf).sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total)).map(([s,d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color={s === "Bullish" ? "#00e5a0" : s === "Bearish" ? "#ff4d6d" : "#f5c842"} />)}
                {!Object.keys(stats.byHtf).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No HTF data yet</div>}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Market Structure</div>
                {Object.entries(stats.byStructure).sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total)).map(([s,d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color="#a78bfa" />)}
                {!Object.keys(stats.byStructure).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Candle Pattern</div>
                {Object.entries(stats.byCandle).sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total)).slice(0,8).map(([c,d]) => <BarRow key={c} label={c} wins={d.wins} total={d.total} color="#8b5cf6" />)}
                {!Object.keys(stats.byCandle).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Trade Type</div>
                {Object.entries(stats.byType).sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total)).map(([s,d]) => <BarRow key={s} label={s} wins={d.wins} total={d.total} color="#f97316" />)}
                {!Object.keys(stats.byType).length && <div style={{ color: "#4b5563", fontSize: 11 }}>No data yet</div>}
              </div>

              {/* Setup vs Execution grade insight */}
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Setup vs Execution</div>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 12 }}>Are you executing A setups well?</div>
                {[
                  ["A setup, A execution", stats.setupVsExec.AA, "#00e5a0"],
                  ["A setup, poor execution", stats.setupVsExec.AB, "#f5c842"],
                  ["B/C setup, good execution", stats.setupVsExec.BA, "#3b82f6"],
                  ["B setup, B execution", stats.setupVsExec.BB, "#8b949e"],
                  ["Other combos", stats.setupVsExec.other, "#4b5563"],
                ].map(([label, count, color]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Time of Day Heatmap (ET Hours)</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 14 }}>Win rate by hour × direction. Only hours with trades shown.</div>
              {activeHours.length === 0 ? <div style={{ color: "#4b5563", fontSize: 11 }}>No trades with timestamps yet.</div> : (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${activeHours.length}, minmax(52px, 1fr))`, gap: 4, minWidth: activeHours.length * 56 + 84 }}>
                    <div style={{ fontSize: 9, color: "#6b7280", display: "flex", alignItems: "center" }}>Direction</div>
                    {activeHours.map(h => <div key={h} style={{ fontSize: 9, color: "#6b7280", textAlign: "center", paddingBottom: 4 }}>{h.toString().padStart(2,"0")}:00</div>)}
                    {["Long","Short"].map(dir => (
                      <>
                        <div key={dir+"lbl"} style={{ fontSize: 10, color: dir === "Long" ? "#00e5a0" : "#ff4d6d", display: "flex", alignItems: "center", fontWeight: 700 }}>{dir}</div>
                        {activeHours.map(h => <HeatmapCell key={dir+h} wins={stats.heatmap[h][dir]?.wins || 0} total={stats.heatmap[h][dir]?.total || 0} />)}
                      </>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ranker */}
            <div style={{ background: "#0d1117", border: "1px solid #f5c84233", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Auto Setup Ranker</div>
              {(() => {
                const combos = {};
                analyticsTrades.forEach(t => {
                  const key = [t.tradeType, t.candlePattern, t.session, t.direction, t.htfBias].filter(Boolean).join(" | ");
                  if (!key) return;
                  if (!combos[key]) combos[key] = { total: 0, wins: 0, pts: 0 };
                  combos[key].total++;
                  if (t.outcome === "Win") combos[key].wins++;
                  combos[key].pts += parseFloat(t.points) || 0;
                });
                const ranked = Object.entries(combos).map(([k,d]) => ({ key: k, ...d, wr: d.wins/d.total, score: (d.wins/d.total)*100 + d.pts/d.total })).sort((a,b) => b.score - a.score);
                if (!ranked.length) return <div style={{ color: "#4b5563", fontSize: 11 }}>Log more trades to see ranked setups.</div>;
                return ranked.slice(0,10).map((r,i) => (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #1f2937", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? "#f5c842" : "#374151", minWidth: 24 }}>#{i+1}</span>
                    <span style={{ fontSize: 10, color: "#e6edf3", flex: 1, minWidth: 160 }}>{r.key}</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{r.total} trades</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.wr >= 0.6 ? "#00e5a0" : r.wr >= 0.4 ? "#f5c842" : "#ff4d6d" }}>{(r.wr*100).toFixed(0)}% WR</span>
                    <span style={{ fontSize: 11, color: r.pts >= 0 ? "#00e5a0" : "#ff4d6d" }}>{(r.pts/r.total).toFixed(1)} pts/trade</span>
                    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: r.wr >= 0.65 ? "rgba(0,229,160,0.1)" : r.wr >= 0.45 ? "rgba(245,200,66,0.1)" : "rgba(255,77,109,0.1)", color: r.wr >= 0.65 ? "#00e5a0" : r.wr >= 0.45 ? "#f5c842" : "#ff4d6d" }}>
                      {r.wr >= 0.65 ? "A" : r.wr >= 0.45 ? "B" : "C"}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </>)}
        </div>
      )}

      {/* RULES */}
      {!loading && view === "rules" && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Trading Rules & Pre-Trade Checklist</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>26 rules across 5 categories. Use the pre-trade checklist before every entry.</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#8b949e" }}>{Object.values(checkedRules).filter(Boolean).length} / {allChecklistIds.length} pre-trade checks</span>
              <button onClick={() => setCheckedRules({})} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reset Checklist</button>
            </div>
          </div>

          {(() => {
            const checked = Object.values(checkedRules).filter(Boolean).length;
            const total = allChecklistIds.length;
            const pct = total ? (checked / total) * 100 : 0;
            const allDone = checked === total;
            return (
              <div style={{ background: "#0d1117", border: "1px solid " + (allDone ? "#00e5a044" : "#1f2937"), borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Pre-Trade Checklist Progress</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? "#00e5a0" : "#f5c842" }}>{allDone ? "READY TO TRADE" : checked + " / " + total + " complete"}</span>
                </div>
                <div style={{ height: 8, background: "#1f2937", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct + "%", background: allDone ? "#00e5a0" : "#f5c842", borderRadius: 4, transition: "width 0.4s ease" }} />
                </div>
                {allDone && <div style={{ marginTop: 10, fontSize: 11, color: "#00e5a0", fontWeight: 700, textAlign: "center", letterSpacing: 2 }}>ALL CONDITIONS MET — YOU MAY ENTER THE TRADE</div>}
              </div>
            );
          })()}

          {RULES.map(section => (
            <div key={section.category} style={{ background: "#0d1117", border: "1px solid " + section.color + "22", borderRadius: 14, padding: "20px 24px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: section.color + "18", color: section.color, padding: "3px 10px", borderRadius: 20, letterSpacing: 2, textTransform: "uppercase" }}>{section.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: section.color, letterSpacing: 2, textTransform: "uppercase" }}>{section.category}</span>
              </div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 16 }}>{section.description}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {section.rules.map((rule, idx) => {
                  const isChecked = checkedRules[rule.id] || false;
                  return (
                    <div key={rule.id} onClick={() => section.checklist && setCheckedRules(c => ({ ...c, [rule.id]: !c[rule.id] }))}
                      style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 14px", borderRadius: 10, background: isChecked ? section.color + "10" : "#070b12", border: "1px solid " + (isChecked ? section.color + "44" : "#1f2937"), cursor: section.checklist ? "pointer" : "default", transition: "all 0.2s ease" }}>
                      {section.checklist ? (
                        <div style={{ width: 20, height: 20, borderRadius: 5, border: "2px solid " + (isChecked ? section.color : "#2a2f3a"), background: isChecked ? section.color : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
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
      )}

      {/* ═══ POSITION CALCULATOR ═══ */}
      {!loading && view === "calc" && (() => {
        // GC contract spec: 1 lot = 100 troy oz, tick = $0.10/oz = $10/tick, 1 point = $100
        const GC_POINT_VALUE = 100; // $ per full point per lot
        const account  = parseFloat(calcAccount) || 0;
        const riskPct  = parseFloat(calcRisk) / 100;
        const entry    = parseFloat(calcEntry);
        const sl       = parseFloat(calcSL);
        const tp       = parseFloat(calcTP);

        const riskDollars = account * riskPct;

        let slPoints = null, tpPoints = null, lotSize = null;
        let lossAmt = null, winAmt = null, rrr = null;

        if (!isNaN(entry) && !isNaN(sl) && entry !== sl) {
          slPoints = calcDir === "Long" ? (entry - sl) : (sl - entry);
          if (slPoints > 0) {
            lotSize = riskDollars / (slPoints * GC_POINT_VALUE);
            lossAmt = lotSize * slPoints * GC_POINT_VALUE;
          }
        }
        if (!isNaN(entry) && !isNaN(tp) && entry !== tp) {
          tpPoints = calcDir === "Long" ? (tp - entry) : (entry - tp);
          if (tpPoints > 0 && lotSize) {
            winAmt = lotSize * tpPoints * GC_POINT_VALUE;
          }
        }
        if (slPoints > 0 && tpPoints > 0) {
          rrr = (tpPoints / slPoints).toFixed(2);
        }

        const fmt = (n) => n !== null && !isNaN(n) ? n.toFixed(2) : "--";
        const fmtDollar = (n) => n !== null && !isNaN(n) ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";

        const cinp = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", color: "#e6edf3", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
        const clbl = { display: "block", fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 5 };
        const card = (label, value, color, sub) => (
          <div style={{ background: "#0d1117", border: `1px solid ${color}33`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{sub}</div>}
          </div>
        );

        return (
          <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
              GC Position Size Calculator
            </div>

            {/* Account + Risk */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Account Settings</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={clbl}>Account Size ($)</label>
                  <input type="number" value={calcAccount} onChange={e => setCalcAccount(e.target.value)} placeholder="100000" style={cinp} />
                </div>
                <div>
                  <label style={clbl}>Risk Per Trade</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["0.5","1"].map(r => (
                      <button key={r} onClick={() => setCalcRisk(r)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${calcRisk === r ? "#f5c842" : "#2a2f3a"}`, background: calcRisk === r ? "rgba(245,200,66,0.12)" : "transparent", color: calcRisk === r ? "#f5c842" : "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {r}%
                      </button>
                    ))}
                    <input type="number" step="0.1" min="0.1" max="5" value={calcRisk} onChange={e => setCalcRisk(e.target.value)} style={{ ...cinp, width: 72, flexShrink: 0, fontSize: 13, textAlign: "center" }} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "#6b7280", letterSpacing: 2 }}>RISK AMOUNT:</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#ff4d6d" }}>{fmtDollar(riskDollars)}</span>
                <span style={{ fontSize: 10, color: "#4b5563" }}>({calcRisk}% of {fmtDollar(account)})</span>
              </div>
            </div>

            {/* Trade inputs */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Trade Levels</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                <div>
                  <label style={clbl}>Direction</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["Long","Short"].map(d => (
                      <button key={d} onClick={() => setCalcDir(d)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${calcDir === d ? (d === "Long" ? "#00e5a0" : "#ff4d6d") : "#2a2f3a"}`, background: calcDir === d ? (d === "Long" ? "rgba(0,229,160,0.1)" : "rgba(255,77,109,0.1)") : "transparent", color: calcDir === d ? (d === "Long" ? "#00e5a0" : "#ff4d6d") : "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={clbl}>Entry Price</label>
                  <input type="number" step="0.1" value={calcEntry} onChange={e => setCalcEntry(e.target.value)} placeholder="2350.0" style={cinp} />
                </div>
                <div>
                  <label style={clbl}>Stop Loss</label>
                  <input type="number" step="0.1" value={calcSL} onChange={e => setCalcSL(e.target.value)} placeholder="2340.0" style={{ ...cinp, border: "1px solid #ff4d6d44" }} />
                </div>
                <div>
                  <label style={clbl}>Take Profit</label>
                  <input type="number" step="0.1" value={calcTP} onChange={e => setCalcTP(e.target.value)} placeholder="2375.0" style={{ ...cinp, border: "1px solid #00e5a044" }} />
                </div>
              </div>
            </div>

            {/* Results */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
              {card("Lot Size", fmt(lotSize), "#f5c842", "GC contracts to trade")}
              {card("SL Distance", slPoints > 0 ? `${slPoints.toFixed(1)} pts` : "--", "#ff4d6d", slPoints > 0 ? `${(slPoints * 10).toFixed(0)} ticks` : null)}
              {card("TP Distance", tpPoints > 0 ? `${tpPoints.toFixed(1)} pts` : "--", "#00e5a0", tpPoints > 0 ? `${(tpPoints * 10).toFixed(0)} ticks` : null)}
              {card("RRR", rrr || "--", parseFloat(rrr) >= 2 ? "#00e5a0" : parseFloat(rrr) >= 1 ? "#f5c842" : "#ff4d6d", rrr ? (parseFloat(rrr) >= 2 ? "✓ Meets minimum" : "⚠ Below 1:2 target") : null)}
              {card("Max Loss", fmtDollar(lossAmt), "#ff4d6d", lossAmt ? `${calcRisk}% of account` : null)}
              {card("Potential Win", fmtDollar(winAmt), "#00e5a0", winAmt && lossAmt ? `${(winAmt / lossAmt).toFixed(1)}× your risk` : null)}
            </div>

            {/* Info box */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>GC Contract Spec</div>
                <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.8 }}>
                  1 lot = 100 troy oz &nbsp;·&nbsp; 1 point = $100 &nbsp;·&nbsp; 1 tick = $10
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Formula</div>
                <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.8 }}>
                  Lot Size = Risk $ ÷ (SL points × $100)
                </div>
              </div>
              {lotSize !== null && lotSize > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Micro Lots</div>
                  <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.8 }}>
                    MGC = {(lotSize * 10).toFixed(1)} contracts (1/10th size)
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => { setCalcEntry(""); setCalcSL(""); setCalcTP(""); }} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
              CLEAR
            </button>
          </div>
        );
      })()}

      {/* ═══ AI COACH ═══ */}
      {!loading && view === "coach" && (() => {

        // ── Data analysis (no API) ─────────────────────────────────────
        const runDataAnalysis = () => {
          if (trades.length < 5) { setCoachError("Log at least 5 trades before running analysis."); return; }
          setCoachLoading(true); setCoachError(""); setCoachAnalysis("");

          const src = trades;
          const wins = src.filter(t => t.outcome === "Win");
          const losses = src.filter(t => t.outcome === "Loss");
          const wr = wins.length / src.length;

          // Best/worst sessions
          const bySess = {};
          src.forEach(t => { if (!t.session) return; if (!bySess[t.session]) bySess[t.session] = { w: 0, l: 0 }; t.outcome === "Win" ? bySess[t.session].w++ : bySess[t.session].l++; });
          const sessRanked = Object.entries(bySess).map(([s, d]) => ({ s, wr: d.w / (d.w + d.l), total: d.w + d.l })).sort((a, b) => b.wr - a.wr);

          // Best/worst candle patterns
          const byCandle = {};
          src.forEach(t => { if (!t.candlePattern || t.candlePattern === "None") return; if (!byCandle[t.candlePattern]) byCandle[t.candlePattern] = { w: 0, l: 0 }; t.outcome === "Win" ? byCandle[t.candlePattern].w++ : byCandle[t.candlePattern].l++; });
          const candleRanked = Object.entries(byCandle).map(([c, d]) => ({ c, wr: d.w / (d.w + d.l), total: d.w + d.l })).sort((a, b) => b.wr - a.wr);

          // Setup vs execution gap
          const aSetupPoorExec = src.filter(t => t.grade === "A" && t.executionGrade && t.executionGrade !== "A" && t.executionGrade !== "Ungraded").length;
          const aSetupAExec = src.filter(t => t.grade === "A" && t.executionGrade === "A").length;

          // MAE vs SL analysis
          const tradesWithMAE = src.filter(t => t.mae && t.stopLoss && t.entryPrice);
          const avgMAE = tradesWithMAE.length ? (tradesWithMAE.reduce((a, t) => a + parseFloat(t.mae), 0) / tradesWithMAE.length).toFixed(1) : null;
          const winnerMAE = tradesWithMAE.filter(t => t.outcome === "Win");
          const avgWinMAE = winnerMAE.length ? (winnerMAE.reduce((a, t) => a + parseFloat(t.mae), 0) / winnerMAE.length).toFixed(1) : null;

          // Grade performance
          const byGrade = {};
          src.forEach(t => { if (!byGrade[t.grade]) byGrade[t.grade] = { w: 0, total: 0 }; byGrade[t.grade].total++; if (t.outcome === "Win") byGrade[t.grade].w++; });

          // HTF bias alignment
          const aligned = src.filter(t => (t.direction === "Long" && t.htfBias === "Bullish") || (t.direction === "Short" && t.htfBias === "Bearish"));
          const misaligned = src.filter(t => (t.direction === "Long" && t.htfBias === "Bearish") || (t.direction === "Short" && t.htfBias === "Bullish"));
          const alignedWR = aligned.length ? (aligned.filter(t => t.outcome === "Win").length / aligned.length * 100).toFixed(0) : null;
          const misalignedWR = misaligned.length ? (misaligned.filter(t => t.outcome === "Win").length / misaligned.length * 100).toFixed(0) : null;

          // RRR on wins (losses correctly excluded — loss RRR is always -1.00)
          const avgRRRWins = wins.length ? (wins.reduce((a, t) => a + (parseFloat(t.rrr) || 0), 0) / wins.length).toFixed(2) : null;

          // Loss streaks
          let maxLossStreak = 0, cur = 0;
          [...src].sort((a,b) => a.entryDatetime < b.entryDatetime ? -1 : 1).forEach(t => { if (t.outcome === "Loss") { cur++; maxLossStreak = Math.max(maxLossStreak, cur); } else cur = 0; });

          // Build findings
          const findings = [];

          // Win rate verdict
          if (wr >= 0.6) findings.push({ type: "positive", title: "Strong win rate", body: `Your win rate is ${(wr*100).toFixed(1)}% across ${src.length} trades. This is above the 60% threshold that makes your edge statistically significant. Keep protecting it.` });
          else if (wr >= 0.45) findings.push({ type: "warning", title: "Win rate needs improvement", body: `Your win rate is ${(wr*100).toFixed(1)}%. With a 2.5 RRR target you need at least 45% to break even, but 55%+ to grow consistently. Focus on skipping C-grade setups.` });
          else findings.push({ type: "critical", title: "Win rate is below breakeven", body: `Your win rate is ${(wr*100).toFixed(1)}%. At this level you are losing money even with good RRR. Return to backtesting and do not trade live until this is above 50% over 50+ trades.` });

          // Session insight
          if (sessRanked.length >= 2) {
            const best = sessRanked[0], worst = sessRanked[sessRanked.length - 1];
            if (best.total >= 3) findings.push({ type: "positive", title: `Best session: ${best.s}`, body: `You win ${(best.wr*100).toFixed(0)}% of trades in the ${best.s} session (${best.total} trades). This is your strongest window — prioritise entries here.` });
            if (worst.total >= 3 && worst.wr < 0.4) findings.push({ type: "critical", title: `Avoid: ${worst.s} session`, body: `Your win rate in ${worst.s} is only ${(worst.wr*100).toFixed(0)}% across ${worst.total} trades. This session is costing you money. Consider eliminating it entirely until you have more data.` });
          }

          // Candle pattern insight
          if (candleRanked.length >= 2) {
            const best = candleRanked[0], worst = candleRanked[candleRanked.length - 1];
            if (best.total >= 3) findings.push({ type: "positive", title: `Best pattern: ${best.c}`, body: `${best.c} has a ${(best.wr*100).toFixed(0)}% win rate over ${best.total} trades. This is your highest-probability signal — weight your entries toward this pattern.` });
            if (worst.total >= 3 && worst.wr < 0.4) findings.push({ type: "warning", title: `Weak pattern: ${worst.c}`, body: `${worst.c} is only winning ${(worst.wr*100).toFixed(0)}% of the time across ${worst.total} trades. Either refine how you identify this pattern or stop trading it until your sample is larger.` });
          }

          // Setup vs execution gap
          if (aSetupPoorExec > 0) {
            const pct = ((aSetupPoorExec / (aSetupPoorExec + aSetupAExec)) * 100).toFixed(0);
            findings.push({ type: "warning", title: "Execution gap on A setups", body: `${pct}% of your A-grade setups were executed poorly (B or C execution grade). You are identifying good trades but not entering/managing them cleanly. Review these trades specifically — common causes are chasing entry, moving SL, or exiting early.` });
          }

          // HTF alignment
          if (alignedWR && misalignedWR && misaligned.length >= 3) {
            findings.push({ type: misalignedWR < 40 ? "critical" : "warning", title: "Counter-trend trades underperforming", body: `Trades aligned with HTF bias win ${alignedWR}% of the time. Counter-trend trades (direction vs HTF bias) win only ${misalignedWR}% across ${misaligned.length} trades. ${parseInt(misalignedWR) < 40 ? "Stop trading against the HTF trend entirely." : "Reduce counter-trend frequency and require higher confluence for those entries."}` });
          }

          // MAE insight
          if (avgWinMAE && avgWinMAE > 8) findings.push({ type: "warning", title: "High heat on winning trades", body: `Your winners experience an average of ${avgWinMAE} points of adverse movement before recovering. This suggests your entries are slightly early or your stop is absorbing unnecessary heat. Consider waiting for a second confirmation before entering.` });
          else if (avgWinMAE && avgWinMAE <= 4) findings.push({ type: "positive", title: "Tight entry precision", body: `Average MAE on winning trades is only ${avgWinMAE} points — price moves in your direction almost immediately after entry. Your timing and entry triggers are working well.` });

          // Grade insight
          const aGrade = byGrade["A"];
          const cGrade = byGrade["C"];
          if (aGrade && cGrade && aGrade.total >= 3 && cGrade.total >= 3) {
            const aWR = (aGrade.w / aGrade.total * 100).toFixed(0);
            const cWR = (cGrade.w / cGrade.total * 100).toFixed(0);
            if (parseInt(aWR) > parseInt(cWR) + 15) findings.push({ type: "positive", title: "Grading system is calibrated", body: `A-grade setups win ${aWR}% vs C-grade at ${cWR}%. Your pre-trade grading is accurately identifying quality — keep skipping C setups if your rule says to.` });
            else if (parseInt(aWR) <= parseInt(cWR)) findings.push({ type: "warning", title: "Grading is not predictive yet", body: `A-grade setups win ${aWR}% vs C-grade at ${cWR}%. Your grading isn't differentiating quality yet — review what you're using to assign A vs C and tighten the criteria.` });
          }

          // RRR on wins
          if (avgRRRWins && parseFloat(avgRRRWins) < 1.8) findings.push({ type: "critical", title: "RRR on wins is too low", body: `Your average RRR on winning trades is ${avgRRRWins}. With a 60% win rate target you need at least 2.0 to grow consistently. You may be exiting winners too early — let price reach TP rather than taking partials.` });
          else if (avgRRRWins && parseFloat(avgRRRWins) >= 2.3) findings.push({ type: "positive", title: "Strong RRR on winners", body: `Average RRR on winning trades is ${avgRRRWins} — above the 2.0 minimum. Your targets are being respected and you are not cutting winners short.` });

          // Loss streak
          if (maxLossStreak >= 3) findings.push({ type: "warning", title: `Max loss streak: ${maxLossStreak}`, body: `You have had a run of ${maxLossStreak} consecutive losses. Per your rules, 3 consecutive losses means stop trading for the rest of the week. Review whether these losses happened on valid setups or rule breaks — if rule breaks, identify the common trigger and add a specific guard for it.` });

          setCoachAnalysis(JSON.stringify(findings));
          setCoachLoading(false);
        };

        // ── AI trade review (API) ──────────────────────────────────────
        const runTradeReview = async (trade) => {
          setReviewTrade(trade);
          setReviewResult(""); setReviewError(""); setReviewLoading(true);
          try {
            const tradeContext = `
Trade details:
- Date/Time: ${trade.entryDatetime || "unknown"}
- Direction: ${trade.direction}
- Trade Type: ${trade.tradeType}
- HTF Bias: ${trade.htfBias}
- Market Structure: ${trade.marketStructure}
- Session: ${trade.session}
- Candle Pattern: ${trade.candlePattern}
- Wick Direction: ${trade.wickDirection}
- Entry Price: ${trade.entryPrice}
- Stop Loss: ${trade.stopLoss}
- Take Profit: ${trade.takeProfit}
- Points: ${trade.points}
- RRR: ${trade.rrr}
- MAE Points: ${trade.mae || "not logged"}
- News: ${trade.news} (${trade.newsImpact} impact)
- Outcome: ${trade.outcome}
- Setup Grade: ${trade.grade}
- Execution Grade: ${trade.executionGrade || "ungraded"}
- Notes: ${trade.notes || "none"}
            `.trim();

            const hasScreenshots = trade.screenshots && trade.screenshots.length > 0;

            const messages = hasScreenshots ? [{
              role: "user",
              content: [
                ...trade.screenshots.map(ss => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: ss.data.split(",")[1] } })),
                { type: "text", text: `You are an expert GC gold futures trading coach reviewing a trade from a student's journal. Analyse the trade data and chart screenshot(s) provided. Give specific, honest, actionable feedback.\n\n${tradeContext}\n\nProvide feedback in these sections:\n1. Setup Quality — was this a valid setup based on the data and chart?\n2. Entry Timing — was the entry well-timed or could it have been better?\n3. Risk Management — SL placement, RRR, MAE assessment\n4. What Was Done Well — at least one positive\n5. What To Improve — specific and actionable, not generic\n6. Overall Verdict — one sentence summary\n\nBe direct and specific. Reference the actual prices and chart structure visible. Do not be vague.` }
              ]
            }] : [{
              role: "user",
              content: `You are an expert GC gold futures trading coach reviewing a trade from a student's journal. No chart screenshot was provided so analyse the data only.\n\n${tradeContext}\n\nProvide feedback in these sections:\n1. Setup Quality — assess based on the data provided\n2. Risk Management — SL/TP placement and RRR\n3. What Was Done Well\n4. What To Improve — specific and actionable\n5. Overall Verdict — one sentence\n\nBe direct and honest.`
            }];

            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const text = data.content.map(b => b.text || "").join("\n").trim();
            setReviewResult(text);
          } catch(e) {
            setReviewError("Review failed: " + e.message);
          } finally {
            setReviewLoading(false);
          }
        };

        const findings = coachAnalysis ? JSON.parse(coachAnalysis) : null;
        const typeColor = { positive: "#00e5a0", warning: "#f5c842", critical: "#ff4d6d" };
        const typeBg    = { positive: "rgba(0,229,160,0.06)", warning: "rgba(245,200,66,0.06)", critical: "rgba(255,77,109,0.06)" };
        const typeIcon  = { positive: "▲", warning: "!", critical: "✕" };

        return (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>AI Coach</div>
            <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 24 }}>Two tools: data-driven pattern analysis across all your trades, and per-trade AI review using your screenshots.</div>

            {/* ── SECTION A: Data Analysis ── */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase" }}>Pattern Analysis</div>
                  <div style={{ fontSize: 10, color: "#4b5563", marginTop: 3 }}>Analyses all {trades.length} logged trades — sessions, patterns, grades, MAE, HTF alignment</div>
                </div>
                <button onClick={runDataAnalysis} disabled={coachLoading || trades.length < 5}
                  style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: coachLoading ? "#2a2f3a" : "linear-gradient(135deg, #f5c842, #ff9a3c)", color: coachLoading ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 11, cursor: coachLoading || trades.length < 5 ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: 2 }}>
                  {coachLoading ? "Analysing..." : "Run Analysis"}
                </button>
              </div>

              {coachError && <div style={{ fontSize: 11, color: "#ff4d6d", marginBottom: 12 }}>{coachError}</div>}
              {trades.length < 5 && <div style={{ fontSize: 11, color: "#4b5563" }}>Log at least 5 trades to run analysis.</div>}

              {findings && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {findings.map((f, i) => (
                    <div key={i} style={{ background: typeBg[f.type], border: `1px solid ${typeColor[f.type]}33`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 14 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 5, background: typeColor[f.type] + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: typeColor[f.type] }}>{typeIcon[f.type]}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: typeColor[f.type], marginBottom: 4, letterSpacing: 1 }}>{f.title}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7 }}>{f.body}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: "#2a2f3a", textAlign: "right", marginTop: 4, letterSpacing: 2 }}>{trades.length} TRADES ANALYSED</div>
                </div>
              )}
            </div>

            {/* ── SECTION B: Per-Trade AI Review ── */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e6edf3", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Per-Trade AI Review</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 16 }}>Select any trade below. Claude will analyse the chart screenshots + trade data and give specific coaching feedback.</div>

              {trades.length === 0 ? (
                <div style={{ fontSize: 11, color: "#4b5563" }}>No trades logged yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {[...trades].sort((a,b) => b.entryDatetime > a.entryDatetime ? 1 : -1).slice(0, 30).map(t => (
                    <div key={t.id} onClick={() => runTradeReview(t)}
                      style={{ padding: "10px 14px", borderRadius: 9, border: `1px solid ${reviewTrade?.id === t.id ? "#f5c842" : "#1f2937"}`, background: reviewTrade?.id === t.id ? "rgba(245,200,66,0.05)" : "#070b12", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", transition: "all 0.15s" }}>
                      <span style={{ fontSize: 10, color: "#6b7280", minWidth: 110 }}>{t.entryDatetime ? t.entryDatetime.replace("T", " ") : "--"}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: t.direction === "Long" ? "#00e5a0" : "#ff4d6d" }}>{t.direction}</span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{t.tradeType || "--"}</span>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{t.session || "--"}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: gradeColor(t.grade) }}>{t.grade}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: outcomeColor(t.outcome) }}>{t.outcome}</span>
                      <span style={{ fontSize: 10, color: parseFloat(t.points) >= 0 ? "#00e5a0" : "#ff4d6d" }}>{t.points ? t.points + "pts" : "--"}</span>
                      {t.screenshots?.length > 0 && <span style={{ fontSize: 9, color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "1px 7px", borderRadius: 10 }}>{t.screenshots.length} chart{t.screenshots.length > 1 ? "s" : ""}</span>}
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#4b5563" }}>click to review →</span>
                    </div>
                  ))}
                  {trades.length > 30 && <div style={{ fontSize: 10, color: "#4b5563", textAlign: "center", padding: 8 }}>Showing 30 most recent trades</div>}
                </div>
              )}

              {/* Review result */}
              {reviewLoading && (
                <div style={{ background: "#070b12", border: "1px solid #1f2937", borderRadius: 10, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#f5c842", marginBottom: 8 }}>Reviewing trade...</div>
                  <div style={{ fontSize: 10, color: "#4b5563" }}>Claude is analysing {reviewTrade?.screenshots?.length > 0 ? `${reviewTrade.screenshots.length} screenshot(s) and` : ""} trade data</div>
                </div>
              )}
              {reviewError && <div style={{ fontSize: 11, color: "#ff4d6d", padding: 12 }}>{reviewError}</div>}
              {reviewResult && reviewTrade && (
                <div style={{ background: "#070b12", border: "1px solid #f5c84233", borderRadius: 12, padding: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#f5c842", letterSpacing: 2 }}>AI REVIEW</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{reviewTrade.entryDatetime?.replace("T", " ")}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: reviewTrade.direction === "Long" ? "#00e5a0" : "#ff4d6d" }}>{reviewTrade.direction}</span>
                    <span style={{ fontSize: 10, color: outcomeColor(reviewTrade.outcome), fontWeight: 700 }}>{reviewTrade.outcome}</span>
                    {reviewTrade.screenshots?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                        {reviewTrade.screenshots.map((ss, i) => (
                          <img key={i} src={ss.data} alt="chart" onClick={() => setLightboxSrc(ss.data)}
                            style={{ height: 36, width: 52, objectFit: "cover", borderRadius: 5, border: "1px solid #2a2f3a", cursor: "zoom-in" }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{reviewResult}</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div style={{ textAlign: "center", padding: "20px", color: "#1f2937", fontSize: 9, letterSpacing: 3, marginTop: 16 }}>
        GC FUTURES JOURNAL · CLOUD SYNCED VIA SUPABASE · {trades.length} TRADES
      </div>
    </div>
  );
}