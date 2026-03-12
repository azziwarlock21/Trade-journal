import { useState, useMemo, useRef, useEffect } from "react";

// ─── Supabase config ───────────────────────────────────────────────────────
const SUPABASE_URL = "https://ivbgtbsobmwxldoiwcru.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymd0YnNvYm13eGxkb2l3Y3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDk4MDksImV4cCI6MjA4ODgyNTgwOX0.2L7GDrMKZVuQpkjU4WDoHxEVvq7n0D0WIc8wQJOTWaw";
const HEADERS = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const TABLE = `${SUPABASE_URL}/rest/v1/trades`;

// Map camelCase form keys ↔ snake_case DB columns
const toRow = (t) => ({
  id: t.id,
  entry_datetime: t.entryDatetime || null,
  exit_datetime: t.exitDatetime || null,
  trade_type: t.tradeType || null,
  direction: t.direction || null,
  session: t.session || null,
  lot_size: t.lotSize || null,
  entry_price: t.entryPrice || null,
  exit_price: t.exitPrice || null,
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
  outcome: t.outcome || "Win",
  notes: t.notes || null,
  screenshot: t.screenshot || null,
  screenshot_name: t.screenshotName || null,
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
  exitPrice: r.exit_price || "",
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
  outcome: r.outcome || "Win",
  notes: r.notes || "",
  screenshot: r.screenshot || null,
  screenshotName: r.screenshot_name || "",
});

async function dbFetchAll() {
  const res = await fetch(`${TABLE}?order=entry_datetime.desc&limit=2000`, { headers: { ...HEADERS, "Prefer": "return=representation" } });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows.map(fromRow);
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
const CANDLE_PATTERNS = ["Engulfing Bull","Engulfing Bear","Hammer","Shooting Star","Doji","Pin Bar","Inside Bar","Outside Bar","Morning Star","Evening Star","Harami","Marubozu","Spinning Top","Three White Soldiers","Three Black Crows","Other"];
const NEWS_EVENTS = ["None","CPI","NFP","FOMC","PPI","GDP","ISM","Retail Sales","Unemployment Claims","Jerome Powell Speech","Other"];
const SESSIONS = ["London","New York","Asia","London/NY Overlap","Pre-Market","After Hours"];
const DIRECTIONS = ["Long","Short"];
const TRADE_TYPES = ["Scalp","Day Trade","Swing","Breakout","Pullback","Reversal","Range","News Play","Other"];
const GRADES = ["A","B","C","Ungraded"];
const HTF_BIASES = ["Bullish","Bearish","Ranging","Uncertain"];
const MARKET_STRUCTURES = ["With Trend","Counter Trend","Range","Breakout","Reversal"];
const TRADE_MODES = ["Backtest","Paper","Live"];
// ─── Economic Calendar 2024–2026 (ET times) ─────────────────────────────────
// Gold-relevant US events: NFP, CPI, PPI, FOMC, Powell, Jobless Claims
// All times Eastern. Format: [YYYY-MM-DD, HH:MM, eventName, impact]
const NEWS_CALENDAR = [
  // ── 2024 ──────────────────────────────────────────────────────────────────
  ["2024-01-05","08:30","NFP","High"],
  ["2024-01-11","08:30","CPI","High"],
  ["2024-01-12","08:30","PPI","High"],
  ["2024-01-18","08:30","Unemployment Claims","Medium"],
  ["2024-01-25","08:30","Unemployment Claims","Medium"],
  ["2024-01-31","14:00","FOMC","High"],
  ["2024-02-01","08:30","Unemployment Claims","Medium"],
  ["2024-02-02","08:30","NFP","High"],
  ["2024-02-08","08:30","Unemployment Claims","Medium"],
  ["2024-02-13","08:30","CPI","High"],
  ["2024-02-14","08:30","PPI","High"],
  ["2024-02-15","08:30","Unemployment Claims","Medium"],
  ["2024-02-20","08:30","Unemployment Claims","Medium"],
  ["2024-02-22","08:30","Unemployment Claims","Medium"],
  ["2024-02-29","08:30","Unemployment Claims","Medium"],
  ["2024-03-01","08:30","NFP","High"],
  ["2024-03-07","08:30","Unemployment Claims","Medium"],
  ["2024-03-12","08:30","CPI","High"],
  ["2024-03-13","08:30","PPI","High"],
  ["2024-03-14","08:30","Unemployment Claims","Medium"],
  ["2024-03-20","14:00","FOMC","High"],
  ["2024-03-21","08:30","Unemployment Claims","Medium"],
  ["2024-03-28","08:30","Unemployment Claims","Medium"],
  ["2024-04-05","08:30","NFP","High"],
  ["2024-04-10","08:30","CPI","High"],
  ["2024-04-11","08:30","PPI","High"],
  ["2024-04-11","08:30","Unemployment Claims","Medium"],
  ["2024-04-18","08:30","Unemployment Claims","Medium"],
  ["2024-04-25","08:30","Unemployment Claims","Medium"],
  ["2024-05-01","14:00","FOMC","High"],
  ["2024-05-02","08:30","Unemployment Claims","Medium"],
  ["2024-05-03","08:30","NFP","High"],
  ["2024-05-09","08:30","Unemployment Claims","Medium"],
  ["2024-05-15","08:30","CPI","High"],
  ["2024-05-16","08:30","PPI","High"],
  ["2024-05-16","08:30","Unemployment Claims","Medium"],
  ["2024-05-23","08:30","Unemployment Claims","Medium"],
  ["2024-05-30","08:30","Unemployment Claims","Medium"],
  ["2024-06-06","08:30","Unemployment Claims","Medium"],
  ["2024-06-07","08:30","NFP","High"],
  ["2024-06-12","08:30","CPI","High"],
  ["2024-06-12","14:00","FOMC","High"],
  ["2024-06-13","08:30","PPI","High"],
  ["2024-06-13","08:30","Unemployment Claims","Medium"],
  ["2024-06-20","08:30","Unemployment Claims","Medium"],
  ["2024-06-27","08:30","Unemployment Claims","Medium"],
  ["2024-07-02","08:30","Unemployment Claims","Medium"],
  ["2024-07-05","08:30","NFP","High"],
  ["2024-07-11","08:30","CPI","High"],
  ["2024-07-12","08:30","PPI","High"],
  ["2024-07-11","08:30","Unemployment Claims","Medium"],
  ["2024-07-18","08:30","Unemployment Claims","Medium"],
  ["2024-07-25","08:30","Unemployment Claims","Medium"],
  ["2024-07-31","14:00","FOMC","High"],
  ["2024-08-01","08:30","Unemployment Claims","Medium"],
  ["2024-08-02","08:30","NFP","High"],
  ["2024-08-08","08:30","Unemployment Claims","Medium"],
  ["2024-08-14","08:30","CPI","High"],
  ["2024-08-15","08:30","PPI","High"],
  ["2024-08-15","08:30","Unemployment Claims","Medium"],
  ["2024-08-22","08:30","Unemployment Claims","Medium"],
  ["2024-08-23","10:00","Jerome Powell Speech","High"],
  ["2024-08-29","08:30","Unemployment Claims","Medium"],
  ["2024-09-05","08:30","Unemployment Claims","Medium"],
  ["2024-09-06","08:30","NFP","High"],
  ["2024-09-11","08:30","CPI","High"],
  ["2024-09-12","08:30","PPI","High"],
  ["2024-09-12","08:30","Unemployment Claims","Medium"],
  ["2024-09-18","14:00","FOMC","High"],
  ["2024-09-19","08:30","Unemployment Claims","Medium"],
  ["2024-09-26","08:30","Unemployment Claims","Medium"],
  ["2024-10-03","08:30","Unemployment Claims","Medium"],
  ["2024-10-04","08:30","NFP","High"],
  ["2024-10-10","08:30","CPI","High"],
  ["2024-10-11","08:30","PPI","High"],
  ["2024-10-10","08:30","Unemployment Claims","Medium"],
  ["2024-10-17","08:30","Unemployment Claims","Medium"],
  ["2024-10-24","08:30","Unemployment Claims","Medium"],
  ["2024-10-31","08:30","Unemployment Claims","Medium"],
  ["2024-11-01","08:30","NFP","High"],
  ["2024-11-07","14:00","FOMC","High"],
  ["2024-11-07","08:30","Unemployment Claims","Medium"],
  ["2024-11-13","08:30","CPI","High"],
  ["2024-11-14","08:30","PPI","High"],
  ["2024-11-14","08:30","Unemployment Claims","Medium"],
  ["2024-11-21","08:30","Unemployment Claims","Medium"],
  ["2024-11-27","08:30","Unemployment Claims","Medium"],
  ["2024-12-05","08:30","Unemployment Claims","Medium"],
  ["2024-12-06","08:30","NFP","High"],
  ["2024-12-11","08:30","CPI","High"],
  ["2024-12-12","08:30","PPI","High"],
  ["2024-12-12","08:30","Unemployment Claims","Medium"],
  ["2024-12-18","14:00","FOMC","High"],
  ["2024-12-19","08:30","Unemployment Claims","Medium"],
  ["2024-12-26","08:30","Unemployment Claims","Medium"],
  // ── 2025 ──────────────────────────────────────────────────────────────────
  ["2025-01-02","08:30","Unemployment Claims","Medium"],
  ["2025-01-10","08:30","NFP","High"],
  ["2025-01-15","08:30","CPI","High"],
  ["2025-01-16","08:30","PPI","High"],
  ["2025-01-16","08:30","Unemployment Claims","Medium"],
  ["2025-01-23","08:30","Unemployment Claims","Medium"],
  ["2025-01-29","14:00","FOMC","High"],
  ["2025-01-30","08:30","Unemployment Claims","Medium"],
  ["2025-02-07","08:30","NFP","High"],
  ["2025-02-12","08:30","CPI","High"],
  ["2025-02-13","08:30","PPI","High"],
  ["2025-02-13","08:30","Unemployment Claims","Medium"],
  ["2025-02-20","08:30","Unemployment Claims","Medium"],
  ["2025-02-27","08:30","Unemployment Claims","Medium"],
  ["2025-03-06","08:30","Unemployment Claims","Medium"],
  ["2025-03-07","08:30","NFP","High"],
  ["2025-03-12","08:30","CPI","High"],
  ["2025-03-13","08:30","PPI","High"],
  ["2025-03-13","08:30","Unemployment Claims","Medium"],
  ["2025-03-19","14:00","FOMC","High"],
  ["2025-03-20","08:30","Unemployment Claims","Medium"],
  ["2025-03-27","08:30","Unemployment Claims","Medium"],
  ["2025-04-03","08:30","Unemployment Claims","Medium"],
  ["2025-04-04","08:30","NFP","High"],
  ["2025-04-10","08:30","CPI","High"],
  ["2025-04-11","08:30","PPI","High"],
  ["2025-04-10","08:30","Unemployment Claims","Medium"],
  ["2025-04-17","08:30","Unemployment Claims","Medium"],
  ["2025-04-24","08:30","Unemployment Claims","Medium"],
  ["2025-05-01","08:30","Unemployment Claims","Medium"],
  ["2025-05-02","08:30","NFP","High"],
  ["2025-05-07","14:00","FOMC","High"],
  ["2025-05-08","08:30","Unemployment Claims","Medium"],
  ["2025-05-13","08:30","CPI","High"],
  ["2025-05-15","08:30","PPI","High"],
  ["2025-05-15","08:30","Unemployment Claims","Medium"],
  ["2025-05-22","08:30","Unemployment Claims","Medium"],
  ["2025-05-29","08:30","Unemployment Claims","Medium"],
  ["2025-06-05","08:30","Unemployment Claims","Medium"],
  ["2025-06-06","08:30","NFP","High"],
  ["2025-06-11","08:30","CPI","High"],
  ["2025-06-12","08:30","PPI","High"],
  ["2025-06-12","08:30","Unemployment Claims","Medium"],
  ["2025-06-18","14:00","FOMC","High"],
  ["2025-06-19","08:30","Unemployment Claims","Medium"],
  ["2025-06-26","08:30","Unemployment Claims","Medium"],
  ["2025-07-03","08:30","Unemployment Claims","Medium"],
  ["2025-07-03","08:30","NFP","High"],
  ["2025-07-10","08:30","Unemployment Claims","Medium"],
  ["2025-07-15","08:30","CPI","High"],
  ["2025-07-16","08:30","PPI","High"],
  ["2025-07-17","08:30","Unemployment Claims","Medium"],
  ["2025-07-24","08:30","Unemployment Claims","Medium"],
  ["2025-07-30","14:00","FOMC","High"],
  ["2025-07-31","08:30","Unemployment Claims","Medium"],
  ["2025-08-01","08:30","NFP","High"],
  ["2025-08-07","08:30","Unemployment Claims","Medium"],
  ["2025-08-13","08:30","CPI","High"],
  ["2025-08-14","08:30","PPI","High"],
  ["2025-08-14","08:30","Unemployment Claims","Medium"],
  ["2025-08-21","08:30","Unemployment Claims","Medium"],
  ["2025-08-28","08:30","Unemployment Claims","Medium"],
  ["2025-09-04","08:30","Unemployment Claims","Medium"],
  ["2025-09-05","08:30","NFP","High"],
  ["2025-09-10","08:30","CPI","High"],
  ["2025-09-11","08:30","PPI","High"],
  ["2025-09-11","08:30","Unemployment Claims","Medium"],
  ["2025-09-17","14:00","FOMC","High"],
  ["2025-09-18","08:30","Unemployment Claims","Medium"],
  ["2025-09-25","08:30","Unemployment Claims","Medium"],
  ["2025-10-02","08:30","Unemployment Claims","Medium"],
  ["2025-10-03","08:30","NFP","High"],
  ["2025-10-09","08:30","Unemployment Claims","Medium"],
  ["2025-10-15","08:30","CPI","High"],
  ["2025-10-16","08:30","PPI","High"],
  ["2025-10-16","08:30","Unemployment Claims","Medium"],
  ["2025-10-23","08:30","Unemployment Claims","Medium"],
  ["2025-10-29","14:00","FOMC","High"],
  ["2025-10-30","08:30","Unemployment Claims","Medium"],
  ["2025-11-06","08:30","Unemployment Claims","Medium"],
  ["2025-11-07","08:30","NFP","High"],
  ["2025-11-13","08:30","Unemployment Claims","Medium"],
  ["2025-11-13","08:30","CPI","High"],
  ["2025-11-14","08:30","PPI","High"],
  ["2025-11-20","08:30","Unemployment Claims","Medium"],
  ["2025-11-26","08:30","Unemployment Claims","Medium"],
  ["2025-12-04","08:30","Unemployment Claims","Medium"],
  ["2025-12-05","08:30","NFP","High"],
  ["2025-12-10","08:30","CPI","High"],
  ["2025-12-11","08:30","PPI","High"],
  ["2025-12-11","08:30","Unemployment Claims","Medium"],
  ["2025-12-17","14:00","FOMC","High"],
  ["2025-12-18","08:30","Unemployment Claims","Medium"],
  ["2025-12-25","08:30","Unemployment Claims","Medium"],
  // ── 2026 ──────────────────────────────────────────────────────────────────
  ["2026-01-08","08:30","Unemployment Claims","Medium"],
  ["2026-01-09","08:30","NFP","High"],
  ["2026-01-15","08:30","CPI","High"],
  ["2026-01-15","08:30","Unemployment Claims","Medium"],
  ["2026-01-16","08:30","PPI","High"],
  ["2026-01-22","08:30","Unemployment Claims","Medium"],
  ["2026-01-28","14:00","FOMC","High"],
  ["2026-01-29","08:30","Unemployment Claims","Medium"],
  ["2026-02-05","08:30","Unemployment Claims","Medium"],
  ["2026-02-06","08:30","NFP","High"],
  ["2026-02-12","08:30","CPI","High"],
  ["2026-02-12","08:30","Unemployment Claims","Medium"],
  ["2026-02-13","08:30","PPI","High"],
  ["2026-02-19","08:30","Unemployment Claims","Medium"],
  ["2026-02-26","08:30","Unemployment Claims","Medium"],
  ["2026-03-05","08:30","Unemployment Claims","Medium"],
  ["2026-03-06","08:30","NFP","High"],
  ["2026-03-12","08:30","CPI","High"],
  ["2026-03-12","08:30","Unemployment Claims","Medium"],
  ["2026-03-13","08:30","PPI","High"],
  ["2026-03-18","14:00","FOMC","High"],
  ["2026-03-19","08:30","Unemployment Claims","Medium"],
  ["2026-03-26","08:30","Unemployment Claims","Medium"],
];

function detectNewsEvent(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return null;
  try {
    const dt = new Date(entryDatetime);
    // Convert to ET date and time
    const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
    const etDate = new Date(etStr);
    const etDateStr = etDate.toISOString().split("T")[0];
    const etMins = etDate.getHours() * 60 + etDate.getMinutes();
    const WINDOW = 30; // minutes either side

    for (const [date, time, event, impact] of NEWS_CALENDAR) {
      if (date !== etDateStr) continue;
      const [h, m] = time.split(":").map(Number);
      const evMins = h * 60 + m;
      if (Math.abs(etMins - evMins) <= WINDOW) return { event, impact };
    }
    return null;
  } catch(e) { return null; }
}

const TIMEZONES = [
  { label: "Germany (CET/CEST)", tz: "Europe/Berlin" },
  { label: "New York (ET)", tz: "America/New_York" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function detectSession(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return "";
  try {
    const dt = new Date(entryDatetime);
    const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
    const parts = etStr.split(":");
    const etHour = parseInt(parts[0], 10);
    const etMin = parseInt(parts[1], 10) || 0;
    const etMins = etHour * 60 + etMin;
    if (etMins >= 1080) return "Asia";
    if (etMins < 480) return "London";
    if (etMins < 570) return "London/NY Overlap";
    if (etMins < 720) return "London/NY Overlap";
    if (etMins < 1020) return "New York";
    if (etMins < 1080) return "After Hours";
    return "";
  } catch(e) { return ""; }
}

function getETHour(entryDatetime) {
  if (!entryDatetime || !entryDatetime.includes("T")) return null;
  try {
    const dt = new Date(entryDatetime);
    const etStr = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false });
    return parseInt(etStr, 10);
  } catch(e) { return null; }
}

function calcDuration(entry, exit) {
  if (!entry || !exit || !entry.includes("T") || !exit.includes("T")) return "";
  try {
    const diff = new Date(exit) - new Date(entry);
    if (isNaN(diff) || diff <= 0) return "";
    const totalMins = Math.floor(diff / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  } catch(e) { return ""; }
}

function formatDatetime(dt) {
  if (!dt) return "--";
  try {
    const d = new Date(dt);
    return d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch(e) { return dt; }
}

const defaultForm = () => ({
  entryDatetime: "", exitDatetime: "", tradeType: "", direction: "", session: "",
  lotSize: "", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "",
  points: "", rrr: "", candlePattern: "", wickDirection: "None",
  news: "None", newsImpact: "Low", htfBias: "", marketStructure: "",
  tradeMode: "Backtest", grade: "Ungraded", outcome: "Win",
  notes: "", screenshot: null, screenshotName: "",
});

function calcPoints(entry, exit, dir) {
  if (!entry || !exit) return "";
  const diff = dir === "Long" ? exit - entry : entry - exit;
  return (diff * 10).toFixed(1);
}
function calcRRR(entry, exit, sl) {
  if (!entry || !exit || !sl) return "";
  const reward = Math.abs(exit - entry);
  const risk = Math.abs(entry - sl);
  if (!risk) return "";
  return (reward / risk).toFixed(2);
}

const gradeColor = (g) => g === "A" ? "#00e5a0" : g === "B" ? "#f5c842" : g === "C" ? "#ff7043" : "#888";
const outcomeColor = (o) => o === "Win" ? "#00e5a0" : o === "Loss" ? "#ff4d6d" : "#aaa";
const modeColor = (m) => m === "Live" ? "#00e5a0" : m === "Paper" ? "#3b82f6" : "#a78bfa";

function BarRow({ label, wins, total, color }) {
  const wr = total ? (wins / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#e6edf3" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#8b949e" }}>{wins}/{total} - {wr.toFixed(0)}% WR</span>
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
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 0);
  const range = max - min || 1;
  const W = 600, H = 120, PAD = 12;
  const x = (i) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const zeroY = y(0);
  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.pts).toFixed(1)}`).join(" ");
  const fillD = `${pathD} L${x(data.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;
  const lastPt = data[data.length - 1].pts;
  const lineColor = lastPt >= 0 ? "#00e5a0" : "#ff4d6d";
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

// ─── Main Component ────────────────────────────────────────────────────────
export default function GCJournal() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [form, setForm] = useState(defaultForm());
  const [view, setView] = useState("journal");
  const [editId, setEditId] = useState(null);
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterOutcome, setFilterOutcome] = useState("All");
  const [filterMode, setFilterMode] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [userTz, setUserTz] = useState("Europe/Berlin");
  const [sessionOverridden, setSessionOverridden] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [analyticsMode, setAnalyticsMode] = useState("All");
  const [checkedRules, setCheckedRules] = useState({});
  const fileRef = useRef();
  const importRef = useRef();
  const dropZoneRef = useRef();
  const [isDragging, setIsDragging] = useState(false);

  // Load all trades from Supabase on mount
  useEffect(() => {
    setLoading(true);
    dbFetchAll()
      .then(rows => { setTrades(rows); setSyncError(""); })
      .catch(e => setSyncError("Could not connect to database: " + e.message))
      .finally(() => setLoading(false));
  }, []);



  const set = (k, v) => {
    if (k === "session") setSessionOverridden(true);
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "entryDatetime") {
        // Auto-fill exit datetime
        if (!f.exitDatetime || f.exitDatetime === f.entryDatetime) {
          next.exitDatetime = v;
        }
        // Auto-detect session
        if (!sessionOverridden) {
          const detected = detectSession(v);
          if (detected) next.session = detected;
        }
        // Auto-detect news
        const newsMatch = detectNewsEvent(v);
        next.news = newsMatch ? newsMatch.event : "None";
        next.newsImpact = newsMatch ? newsMatch.impact : "Low";
      }
      const entry = parseFloat(next.entryPrice);
      const exit = parseFloat(next.exitPrice);
      const sl = parseFloat(next.stopLoss);
      if (!isNaN(entry) && !isNaN(exit)) {
        next.points = calcPoints(entry, exit, next.direction);
        if (!isNaN(sl)) next.rrr = calcRRR(entry, exit, sl);
      }
      return next;
    });
  };

  const loadImageFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, screenshot: ev.target.result, screenshotName: file.name }));
    reader.readAsDataURL(file);
  };

  const handleScreenshot = (e) => {
    const file = e.target.files[0];
    if (file) loadImageFile(file);
  };

  const pasteTargetRef = useRef();
  const [pasteMode, setPasteMode] = useState(false);

  const handlePaste = (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        loadImageFile(file);
        setPasteMode(false);
        break;
      }
    }
    // clear any pasted text from contentEditable
    if (pasteTargetRef.current) pasteTargetRef.current.innerHTML = "";
  };

  const activatePasteMode = () => {
    setPasteMode(true);
    setTimeout(() => {
      if (pasteTargetRef.current) {
        pasteTargetRef.current.focus();
      }
    }, 50);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const saveTrade = async () => {
    if (!form.entryDatetime || !form.direction || !form.tradeType) {
      alert("Please fill in Entry Date/Time, Direction, and Trade Type at minimum.");
      return;
    }
    setSyncing(true);
    setSyncError("");
    try {
      if (editId !== null) {
        const updated = { ...form, id: editId };
        await dbUpdate(updated);
        setTrades(ts => ts.map(t => t.id === editId ? updated : t));
        setEditId(null);
      } else {
        const newTrade = { ...form, id: Date.now() };
        await dbInsert(newTrade);
        setTrades(ts => [newTrade, ...ts]);
      }
      setForm(defaultForm());
      setSessionOverridden(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch(e) {
      setSyncError("Save failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const editTrade = (t) => {
    setForm({ ...t });
    setEditId(t.id);
    setSessionOverridden(true);
    setView("journal");
    window.scrollTo(0, 0);
  };

  const deleteTrade = async (id) => {
    if (!window.confirm("Delete this trade?")) return;
    setSyncing(true);
    try {
      await dbDelete(id);
      setTrades(ts => ts.filter(t => t.id !== id));
    } catch(e) { setSyncError("Delete failed: " + e.message); }
    finally { setSyncing(false); }
  };

  const deleteAllTrades = async () => {
    if (!window.confirm("Delete ALL trades from the cloud? This cannot be undone.")) return;
    setSyncing(true);
    try {
      await dbDeleteAll();
      setTrades([]);
      setExpandedId(null);
    } catch(e) { setSyncError("Delete all failed: " + e.message); }
    finally { setSyncing(false); }
  };

  const exportCSV = () => {
    const headers = Object.keys(defaultForm()).filter(k => k !== "screenshot");
    const rows = trades.map(t => headers.map(h => JSON.stringify(t[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
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
          const vals = line.match(/(".*?"|[^,]+)/g) || [];
          const obj = {};
          headers.forEach((h, idx) => {
            try { obj[h] = JSON.parse(vals[idx] || "null"); } catch(e) { obj[h] = vals[idx] || ""; }
          });
          obj.id = Date.now() + i;
          return obj;
        });
        if (!window.confirm(`Import ${imported.length} trades to the cloud? This will ADD to existing trades.`)) return;
        setSyncing(true);
        for (const t of imported) { await dbInsert(t); }
        const fresh = await dbFetchAll();
        setTrades(fresh);
        setSyncError("");
      } catch(err) { setSyncError("Import failed: " + err.message); }
      finally { setSyncing(false); if (importRef.current) importRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  const analyticsTrades = useMemo(() => {
    if (analyticsMode === "All") return trades;
    return trades.filter(t => (t.tradeMode || "Backtest") === analyticsMode);
  }, [trades, analyticsMode]);

  const stats = useMemo(() => {
    const src = analyticsTrades;
    if (!src.length) return null;
    const wins = src.filter(t => t.outcome === "Win");
    const losses = src.filter(t => t.outcome === "Loss");
    const winRate = ((wins.length / src.length) * 100).toFixed(1);
    const avgRRR = (src.reduce((a, t) => a + (parseFloat(t.rrr) || 0), 0) / src.length).toFixed(2);
    const avgPoints = (src.reduce((a, t) => a + (parseFloat(t.points) || 0), 0) / src.length).toFixed(1);
    const totalPoints = src.reduce((a, t) => a + (parseFloat(t.points) || 0), 0).toFixed(1);

    const byGrade = {};
    GRADES.forEach(g => {
      const gt = src.filter(t => t.grade === g);
      const gw = gt.filter(t => t.outcome === "Win");
      byGrade[g] = { total: gt.length, wins: gw.length };
    });

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

    return { wins: wins.length, losses: losses.length, winRate, avgRRR, avgPoints, totalPoints, byGrade, byCandle, bySession, byType, byHtf, byStructure, heatmap, equity };
  }, [analyticsTrades]);

  const filteredTrades = useMemo(() => {
    return trades
      .filter(t => filterGrade === "All" || t.grade === filterGrade)
      .filter(t => filterOutcome === "All" || t.outcome === filterOutcome)
      .filter(t => filterMode === "All" || (t.tradeMode || "Backtest") === filterMode)
      .sort((a, b) => (a.entryDatetime < b.entryDatetime ? 1 : -1));
  }, [trades, filterGrade, filterOutcome, filterMode]);

  const activeHours = useMemo(() => {
    if (!stats) return [];
    return Object.keys(stats.heatmap).map(Number).filter(h => stats.heatmap[h].Long.total > 0 || stats.heatmap[h].Short.total > 0);
  }, [stats]);

  const inp = { width: "100%", background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 12px", color: "#e6edf3", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" };
  const autoInp = { ...inp, background: "#111827", border: "1px solid #00e5a044", color: "#f5c842", fontWeight: 700 };
  const lbl = { display: "block", fontSize: 10, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 };
  const autoBadge = <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(0,229,160,0.12)", padding: "1px 6px", borderRadius: 4, color: "#00e5a0", fontWeight: 700 }}>AUTO</span>;

  const syncIndicator = syncing
    ? <span style={{ fontSize: 10, color: "#f5c842", letterSpacing: 1 }}>saving...</span>
    : syncError
    ? <span style={{ fontSize: 10, color: "#ff4d6d", maxWidth: 260 }}>{syncError}</span>
    : trades.length > 0
    ? <span style={{ fontSize: 10, color: "#00e5a0" }}>cloud synced</span>
    : null;

  const RULES = [
    {
      category: "Pre-Trade Checklist",
      color: "#3b82f6",
      icon: "CHECK",
      description: "Must meet ALL before entering a trade",
      checklist: true,
      rules: [
        { id: "r1", text: "HTF bias (Daily/4H) is clearly Bullish or Bearish — no trading in Ranging or Uncertain conditions until you have 200+ trades of data" },
        { id: "r2", text: "Entry is in a confirmed kill zone — London open (3-5 AM ET) or New York open (9:30-10:30 AM ET) only" },
        { id: "r3", text: "A clear candle pattern signal is present on your entry timeframe" },
        { id: "r4", text: "Stop loss is placed behind a structural level — a swing high/low, not a round number or arbitrary distance" },
        { id: "r5", text: "Risk/reward is at minimum 1:2 before entry — if the target does not offer at least 2x the risk, skip the trade" },
        { id: "r6", text: "No active high-impact news within 15 minutes of entry (CPI, NFP, FOMC, Powell speeches)" },
      ],
    },
    {
      category: "Risk Rules",
      color: "#ff4d6d",
      icon: "RISK",
      description: "Non-negotiable — follow these without exception",
      checklist: false,
      rules: [
        { id: "r7",  text: "Maximum 1% of account risked per trade — no exceptions" },
        { id: "r8",  text: "Maximum 2 trades open simultaneously" },
        { id: "r9",  text: "3 consecutive losses in a day = stop trading for the remainder of that day — no revenge trading" },
        { id: "r10", text: "Down 3% on the week = stop trading until Monday — protect capital above all else" },
        { id: "r11", text: "Never move your stop loss further away once a trade is live — you may move it to breakeven or tighter, never wider" },
        { id: "r12", text: "Never add to a losing position" },
      ],
    },
    {
      category: "Execution Rules",
      color: "#f5c842",
      icon: "EXEC",
      description: "Discipline at the point of entry and exit",
      checklist: false,
      rules: [
        { id: "r13", text: "Only trade pre-defined setup types — if you cannot name the setup before entry it does not qualify" },
        { id: "r14", text: "Do not enter a trade in the last 30 minutes before a scheduled high-impact news event" },
        { id: "r15", text: "Do not trade the first 5 minutes of any session open — wait for the initial volatility to settle and direction to show" },
        { id: "r16", text: "If you missed the entry, let it go — do not chase price more than 3-4 ticks from your planned entry" },
        { id: "r17", text: "Grade every trade A, B or C before you enter, not after — if it is a C setup, consider skipping it entirely" },
      ],
    },
    {
      category: "Post-Trade & Review",
      color: "#a78bfa",
      icon: "LOG",
      description: "How you learn and improve over time",
      checklist: false,
      rules: [
        { id: "r18", text: "Screenshot every trade immediately after closing — do not rely on memory" },
        { id: "r19", text: "Write your notes within 10 minutes of closing the trade while the reasoning is fresh" },
        { id: "r20", text: "Review your journal every Sunday — look at the week's trades, not individual days" },
        { id: "r21", text: "After every 50 trades, run a full analytics review — if your live win rate drops below 40% for 50+ trades, return to backtesting before continuing live" },
        { id: "r22", text: "Never change your system rules mid-week — write proposed changes down and implement on Monday only" },
      ],
    },
    {
      category: "Mindset Rules",
      color: "#00e5a0",
      icon: "MIND",
      description: "The mental edge that separates consistent traders",
      checklist: false,
      rules: [
        { id: "r23", text: "A loss is not a mistake if you followed your rules — a loss on a valid setup is the cost of doing business" },
        { id: "r24", text: "A win on a rule-breaking trade is more dangerous than a loss — it reinforces bad habits" },
        { id: "r25", text: "Your job is to execute the process, not predict the market — focus on did I follow my rules, not did I make money today" },
        { id: "r26", text: "Keep position sizing consistent — do not increase size after a winning streak or decrease out of fear after losses until you have 200+ live trades of data" },
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
          <div style={{ position: "absolute", top: 20, right: 28, fontSize: 26, color: "#8b949e", cursor: "pointer", userSelect: "none" }} onClick={() => setLightboxSrc(null)}>x</div>
          <img src={lightboxSrc} alt="chart" style={{ maxWidth: "95vw", maxHeight: "92vh", borderRadius: 10, border: "1px solid #2a2f3a", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0d1117, #111827)", borderBottom: "1px solid #1f2937", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #f5c842, #ff9a3c)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{"⚡"}</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f5c842", letterSpacing: 2 }}>GC FUTURES JOURNAL</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3 }}>GOLD · {trades.length} TRADES</span>
              {syncIndicator}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {["journal","log","analytics","rules"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${view === v ? "#f5c842" : "#2a2f3a"}`, background: view === v ? "rgba(245,200,66,0.1)" : "transparent", color: view === v ? "#f5c842" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit" }}>
              {v}
            </button>
          ))}
          <button onClick={exportCSV} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Export CSV</button>
          <label style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Import CSV<input ref={importRef} type="file" accept=".csv" onChange={importCSV} style={{ display: "none" }} />
          </label>
          <select value={userTz} onChange={e => { setUserTz(e.target.value); setSessionOverridden(false); }} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 8, padding: "7px 10px", color: "#f5c842", fontSize: 10, fontFamily: "inherit" }}>
            {TIMEZONES.map(t => <option key={t.tz} value={t.tz}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: "center", padding: 80, color: "#f5c842", fontSize: 13 }}>
          <div style={{ marginBottom: 12, fontSize: 24 }}>{"⚡"}</div>
          Loading trades from cloud...
        </div>
      )}

      {/* ═══ JOURNAL ═══ */}
      {!loading && view === "journal" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f5c842", letterSpacing: 3, marginBottom: 20, textTransform: "uppercase" }}>
              {editId ? "Edit Trade" : "+ Log New Trade"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 14 }}>

              <div><label style={lbl}>Entry Date &amp; Time</label><input type="datetime-local" value={form.entryDatetime} onChange={e => set("entryDatetime", e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Exit Date &amp; Time</label><input type="datetime-local" value={form.exitDatetime} onChange={e => set("exitDatetime", e.target.value)} style={inp} /></div>
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
                <label style={lbl}>HTF Bias (Daily/4H)</label>
                <select value={form.htfBias} onChange={e => set("htfBias", e.target.value)} style={{ ...inp, color: form.htfBias === "Bullish" ? "#00e5a0" : form.htfBias === "Bearish" ? "#ff4d6d" : form.htfBias === "Ranging" ? "#f5c842" : "#e6edf3" }}>
                  <option value="">Select...</option>{HTF_BIASES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div><label style={lbl}>Market Structure</label><select value={form.marketStructure} onChange={e => set("marketStructure", e.target.value)} style={inp}><option value="">Select...</option>{MARKET_STRUCTURES.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={lbl}>Lot Size</label><input type="number" step="0.1" value={form.lotSize} onChange={e => set("lotSize", e.target.value)} placeholder="1.0" style={inp} /></div>
              <div><label style={lbl}>Entry Price</label><input type="number" step="0.1" value={form.entryPrice} onChange={e => set("entryPrice", e.target.value)} placeholder="2350.0" style={inp} /></div>
              <div><label style={lbl}>Exit Price</label><input type="number" step="0.1" value={form.exitPrice} onChange={e => set("exitPrice", e.target.value)} placeholder="2360.0" style={inp} /></div>
              <div><label style={lbl}>Stop Loss</label><input type="number" step="0.1" value={form.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="2345.0" style={inp} /></div>
              <div><label style={lbl}>Take Profit</label><input type="number" step="0.1" value={form.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="2370.0" style={inp} /></div>
              <div><label style={{ ...lbl, color: "#f5c842" }}>Points {autoBadge}</label><input readOnly value={form.points} placeholder="--" style={autoInp} /></div>
              <div><label style={{ ...lbl, color: "#f5c842" }}>RRR {autoBadge}</label><input readOnly value={form.rrr} placeholder="--" style={autoInp} /></div>
              <div><label style={lbl}>Candle Pattern</label><select value={form.candlePattern} onChange={e => set("candlePattern", e.target.value)} style={inp}><option value="">Select...</option>{CANDLE_PATTERNS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label style={lbl}>Wick Direction</label><select value={form.wickDirection} onChange={e => set("wickDirection", e.target.value)} style={inp}>{["None","Upper","Lower","Both"].map(s => <option key={s}>{s}</option>)}</select></div>

              <div>
                <label style={lbl}>
                  News Event
                  {form.news !== "None" && <span style={{ fontSize: 9, marginLeft: 6, background: "rgba(0,229,160,0.12)", padding: "1px 6px", borderRadius: 4, color: "#00e5a0", fontWeight: 700 }}>AUTO</span>}
                </label>
                <select value={form.news} onChange={e => set("news", e.target.value)}
                  style={{ ...inp, ...(form.news !== "None" ? { border: "1px solid #00e5a044", color: "#f5c842", fontWeight: 700 } : {}) }}>
                  {NEWS_EVENTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {form.news !== "None" && (
                <div>
                  <label style={lbl}>News Impact</label>
                  <select value={form.newsImpact} onChange={e => set("newsImpact", e.target.value)}
                    style={{ ...inp, color: form.newsImpact === "High" ? "#ff4d6d" : form.newsImpact === "Medium" ? "#f5c842" : "#8b949e", fontWeight: 700 }}>
                    {["Low","Medium","High"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={lbl}>Outcome</label>
                <select value={form.outcome} onChange={e => set("outcome", e.target.value)} style={{ ...inp, color: outcomeColor(form.outcome), fontWeight: 700 }}>
                  {["Win","Loss","Breakeven"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>Setup Grade</label>
                <select value={form.grade} onChange={e => set("grade", e.target.value)} style={{ ...inp, color: gradeColor(form.grade), fontWeight: 700 }}>
                  {GRADES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={lbl}>Notes / Observations</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Context, confluences, HTF alignment, what you would do differently..." style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={lbl}>Chart Screenshot</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleScreenshot} style={{ display: "none" }} id="ss-upload" />

              {/* Drop / paste zone */}
              <div
                ref={dropZoneRef}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                tabIndex={0}
                style={{
                  border: `2px dashed ${isDragging ? "#f5c842" : form.screenshot ? "#00e5a044" : "#2a2f3a"}`,
                  borderRadius: 12,
                  background: isDragging ? "rgba(245,200,66,0.05)" : "#070b12",
                  padding: form.screenshot ? "10px" : "28px 16px",
                  textAlign: "center",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  outline: "none",
                }}
                onClick={() => !form.screenshot && fileRef.current && fileRef.current.click()}
              >
                {form.screenshot ? (
                  <div>
                    <img
                      src={form.screenshot}
                      alt="preview"
                      onClick={(e) => { e.stopPropagation(); setLightboxSrc(form.screenshot); }}
                      style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block", margin: "0 auto" }}
                    />
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{form.screenshotName}</span>
                      <button onClick={(e) => { e.stopPropagation(); setForm(f => ({ ...f, screenshot: null, screenshotName: "" })); if (fileRef.current) fileRef.current.value = ""; }}
                        style={{ fontSize: 10, color: "#ff4d6d", background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Remove</button>
                      <button onClick={(e) => { e.stopPropagation(); fileRef.current && fileRef.current.click(); }}
                        style={{ fontSize: 10, color: "#f5c842", background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Replace</button>
                    </div>
                  </div>
                ) : pasteMode ? (
                  <div>
                    <div style={{ fontSize: 12, color: "#f5c842", fontWeight: 700, marginBottom: 10 }}>
                      Ready to paste — press Cmd+V or long-press and tap Paste
                    </div>
                    {/* Hidden contentEditable — Safari/iPad requires a real editable element to fire paste events */}
                    <div
                      ref={pasteTargetRef}
                      contentEditable
                      suppressContentEditableWarning
                      onPaste={handlePaste}
                      style={{
                        minHeight: 48,
                        border: "1px dashed #f5c842",
                        borderRadius: 8,
                        padding: "12px",
                        color: "#f5c842",
                        fontSize: 11,
                        outline: "none",
                        background: "rgba(245,200,66,0.04)",
                        textAlign: "center",
                        lineHeight: 2,
                      }}
                    >
                      Tap here then paste your screenshot
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setPasteMode(false); }}
                      style={{ marginTop: 8, fontSize: 10, color: "#6b7280", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.3 }}>{"[ ]"}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); fileRef.current && fileRef.current.click(); }}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #f5c842", background: "transparent", color: "#f5c842", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >Browse / Photos</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); activatePasteMode(); }}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #3b82f6", background: "transparent", color: "#3b82f6", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                      >Paste from Clipboard</button>
                    </div>
                    <div style={{ fontSize: 10, color: "#4b5563" }}>
                      iPad: screenshot with Side+Volume, open Photos → Share → Copy Photo, then tap Paste from Clipboard
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* News proximity warning banner */}
            {(() => {
              const detected = detectNewsEvent(form.entryDatetime);
              if (!detected) return null;
              return (
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "rgba(245,200,66,0.08)", border: "1px solid #f5c84266", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 16 }}>!</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", marginBottom: 2 }}>
                      News Event Window Detected: {detected.event}
                    </div>
                    <div style={{ fontSize: 10, color: "#8b949e" }}>
                      Your entry time falls within 30 minutes of a scheduled {detected.event} release. News field has been auto-populated. Verify this is a news-impacted trade before saving.
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={saveTrade} disabled={syncing} style={{ padding: "11px 28px", background: syncing ? "#2a2f3a" : "linear-gradient(135deg, #f5c842, #ff9a3c)", borderRadius: 10, border: "none", color: syncing ? "#6b7280" : "#070b12", fontWeight: 700, fontSize: 12, cursor: syncing ? "not-allowed" : "pointer", letterSpacing: 2, textTransform: "uppercase", fontFamily: "inherit" }}>
                {syncing ? "Saving..." : editId ? "Update Trade" : "Save Trade"}
              </button>
              {editId && <button onClick={() => { setEditId(null); setForm(defaultForm()); setSessionOverridden(false); }} style={{ padding: "11px 20px", background: "transparent", borderRadius: 10, border: "1px solid #2a2f3a", color: "#8b949e", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>}
              {syncError && <span style={{ fontSize: 11, color: "#ff4d6d" }}>{syncError}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOG ═══ */}
      {!loading && view === "log" && (
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>FILTER:</span>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 10px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit" }}>
              <option value="All">All Grades</option>{GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
            <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 10px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit" }}>
              <option value="All">All Outcomes</option><option>Win</option><option>Loss</option><option>Breakeven</option>
            </select>
            <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ background: "#0d1117", border: "1px solid #2a2f3a", borderRadius: 6, padding: "6px 10px", color: "#e6edf3", fontSize: 11, fontFamily: "inherit" }}>
              <option value="All">All Modes</option>{TRADE_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{filteredTrades.length} trades</span>
            {trades.length > 0 && <button onClick={deleteAllTrades} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 7, border: "1px solid #ff4d6d55", background: "rgba(255,77,109,0.07)", color: "#ff4d6d", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete All</button>}
          </div>

          {filteredTrades.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 13 }}>No trades yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredTrades.map(t => (
                <div key={t.id} style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden" }}>
                  <div onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "#6b7280", minWidth: 108 }}>{formatDatetime(t.entryDatetime)}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: modeColor(t.tradeMode || "Backtest") + "18", color: modeColor(t.tradeMode || "Backtest") }}>{t.tradeMode || "Backtest"}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: t.direction === "Long" ? "rgba(0,229,160,0.1)" : "rgba(255,77,109,0.1)", color: t.direction === "Long" ? "#00e5a0" : "#ff4d6d" }}>{t.direction || "--"}</span>
                    <span style={{ fontSize: 11, color: "#e6edf3", minWidth: 76 }}>{t.tradeType || "--"}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{t.candlePattern || "--"}</span>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{t.session || "--"}</span>
                    {t.htfBias && <span style={{ fontSize: 10, color: t.htfBias === "Bullish" ? "#00e5a0" : t.htfBias === "Bearish" ? "#ff4d6d" : "#f5c842" }}>{t.htfBias}</span>}
                    <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 12, color: parseFloat(t.points) >= 0 ? "#00e5a0" : "#ff4d6d" }}>{t.points ? `${t.points}pts` : "--"}</span>
                    <span style={{ fontSize: 11, color: "#f5c842" }}>RRR:{t.rrr || "--"}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${gradeColor(t.grade)}22`, color: gradeColor(t.grade) }}>{t.grade}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${outcomeColor(t.outcome)}22`, color: outcomeColor(t.outcome) }}>{t.outcome}</span>
                    <button onClick={e => { e.stopPropagation(); editTrade(t); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #2a2f3a", background: "transparent", color: "#8b949e", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                    <button onClick={e => { e.stopPropagation(); deleteTrade(t.id); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #ff4d6d44", background: "transparent", color: "#ff4d6d", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>Del</button>
                  </div>
                  {expandedId === t.id && (
                    <div style={{ borderTop: "1px solid #1f2937", padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 }}>
                      {[["Entry", formatDatetime(t.entryDatetime)],["Exit", formatDatetime(t.exitDatetime)],["Duration", calcDuration(t.entryDatetime, t.exitDatetime)],["Session", t.session],["HTF Bias", t.htfBias],["Market Structure", t.marketStructure],["Lot Size", t.lotSize],["Entry Price", t.entryPrice],["Exit Price", t.exitPrice],["Stop Loss", t.stopLoss],["Take Profit", t.takeProfit],["Wick", t.wickDirection !== "None" ? t.wickDirection : ""],["News", t.news !== "None" ? t.news : ""],["News Impact", t.news !== "None" ? t.newsImpact : ""]].map(([k, v]) => v ? (
                        <div key={k}><div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 12, color: "#e6edf3" }}>{v}</div></div>
                      ) : null)}
                      {t.notes && <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>{t.notes}</div></div>}
                      {t.screenshot && <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Screenshot</div><img src={t.screenshot} alt="chart" onClick={() => setLightboxSrc(t.screenshot)} style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, border: "1px solid #2a2f3a", cursor: "zoom-in", display: "block" }} /><div style={{ fontSize: 10, color: "#6b7280", marginTop: 3 }}>Click to enlarge</div></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYTICS ═══ */}
      {!loading && view === "analytics" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 20px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#8b949e", letterSpacing: 2 }}>VIEWING:</span>
            {["All", ...TRADE_MODES].map(m => (
              <button key={m} onClick={() => setAnalyticsMode(m)} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${analyticsMode === m ? "#f5c842" : "#2a2f3a"}`, background: analyticsMode === m ? "rgba(245,200,66,0.1)" : "transparent", color: analyticsMode === m ? "#f5c842" : "#8b949e", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                {m}
              </button>
            ))}
            <span style={{ fontSize: 10, color: "#4b5563" }}>{analyticsTrades.length} trades</span>
          </div>

          {!stats ? (
            <div style={{ textAlign: "center", padding: 80, color: "#4b5563", fontSize: 13 }}>No trade data yet. Log some trades first.</div>
          ) : (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[["Total Trades", analyticsTrades.length, "#e6edf3"],["Win Rate", `${stats.winRate}%`, "#00e5a0"],["Total Points", stats.totalPoints, parseFloat(stats.totalPoints) >= 0 ? "#00e5a0" : "#ff4d6d"],["Avg Pts/Trade", stats.avgPoints, "#e6edf3"],["Avg RRR", stats.avgRRR, "#f5c842"],["W / L", `${stats.wins} / ${stats.losses}`, "#e6edf3"]].map(([label, val, color]) => (
                <div key={label} style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Equity Curve — Cumulative Points</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 10 }}>Dots: green=win red=loss</div>
              <EquityCurve data={stats.equity} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Setup Grade</div>
                {GRADES.map(g => <BarRow key={g} label={`Grade ${g}`} wins={stats.byGrade[g].wins} total={stats.byGrade[g].total} color={gradeColor(g)} />)}
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
            </div>

            {/* Heatmap */}
            <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12, padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#f5c842", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Time of Day Heatmap (ET Hours)</div>
              <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 14 }}>Win rate by hour x direction. Only hours with trades shown.</div>
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
                      style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 14px", borderRadius: 10,
                        background: isChecked ? section.color + "10" : "#070b12",
                        border: "1px solid " + (isChecked ? section.color + "44" : "#1f2937"),
                        cursor: section.checklist ? "pointer" : "default", transition: "all 0.2s ease" }}>
                      {section.checklist ? (
                        <div style={{ width: 20, height: 20, borderRadius: 5, border: "2px solid " + (isChecked ? section.color : "#2a2f3a"),
                          background: isChecked ? section.color : "transparent", flexShrink: 0, marginTop: 1,
                          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                          {isChecked && <span style={{ fontSize: 11, color: "#070b12", fontWeight: 900 }}>x</span>}
                        </div>
                      ) : (
                        <div style={{ width: 22, height: 22, borderRadius: 5, background: section.color + "18", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
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

      <div style={{ textAlign: "center", padding: "20px", color: "#1f2937", fontSize: 9, letterSpacing: 3, marginTop: 16 }}>
        GC FUTURES JOURNAL · CLOUD SYNCED VIA SUPABASE · {trades.length} TRADES
      </div>
    </div>
  );
}