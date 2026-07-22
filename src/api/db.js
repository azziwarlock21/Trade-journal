// ─── Supabase Data Layer ──────────────────────────────────────────────────
// All reads/writes to the `trades` table and the `sync_log` table
// (used for payouts, expenses, and TopstepX sync state).

export const SUPABASE_URL = "https://ivbgtbsobmwxldoiwcru.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymd0YnNvYm13eGxkb2l3Y3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDk4MDksImV4cCI6MjA4ODgyNTgwOX0.2L7GDrMKZVuQpkjU4WDoHxEVvq7n0D0WIc8wQJOTWaw";

const HEADERS = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };
const TABLE = `${SUPABASE_URL}/rest/v1/trades`;

// ─── Row <-> Trade object mapping (camelCase <-> snake_case) ────────────────
export const toRow = (t) => ({
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

export const fromRow = (r) => ({
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
  screenshots: (() => {
    try { return r.screenshot ? JSON.parse(r.screenshot) : []; }
    catch (e) { return r.screenshot ? [{ data: r.screenshot, name: r.screenshot_name || "screenshot" }] : []; }
  })(),
});

// All columns EXCEPT screenshot — for fast list load. Screenshots are
// lazy-loaded per-trade via dbFetchScreenshots() to avoid downloading
// megabytes of base64 image data on every page load.
const LIGHT_COLS = "id,entry_datetime,exit_datetime,trade_type,direction,session,lot_size,entry_price,stop_loss,take_profit,points,rrr,candle_pattern,wick_direction,news,news_impact,htf_bias,market_structure,trade_mode,grade,execution_grade,outcome,mae,notes,screenshot_name";

export async function dbFetchAll() {
  const res = await fetch(`${TABLE}?select=${LIGHT_COLS}&order=entry_datetime.desc&limit=2000`, {
    headers: { ...HEADERS, "Prefer": "return=representation" },
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).map(r => ({ ...fromRow(r), screenshots: [], screenshotsLoaded: false }));
}

export async function dbFetchScreenshots(id) {
  const res = await fetch(`${TABLE}?select=id,screenshot,screenshot_name&id=eq.${id}`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  if (!rows[0]?.screenshot) return [];
  try { return JSON.parse(rows[0].screenshot); }
  catch (e) { return rows[0].screenshot ? [{ data: rows[0].screenshot, name: rows[0].screenshot_name || "screenshot" }] : []; }
}

// Compress image before storing — max 1200px wide, 0.82 quality.
// A typical 3MB TradingView screenshot compresses to ~150-300KB.
export function compressImage(dataUrl, maxWidth = 1200, quality = 0.82) {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

export async function dbInsert(trade) {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "return=representation" },
    body: JSON.stringify(toRow(trade)),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function dbUpdate(trade) {
  const res = await fetch(`${TABLE}?id=eq.${trade.id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Prefer": "return=representation" },
    body: JSON.stringify(toRow(trade)),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function dbDelete(id) {
  const res = await fetch(`${TABLE}?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
}

export async function dbDeleteAll() {
  const res = await fetch(`${TABLE}?id=neq.0`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Financial data (payouts/expenses) stored in sync_log table ────────────
// Uses the same table as TopstepX sync state — each row is keyed by id
// ("gc_payouts", "gc_expenses", "topstepx") with JSON in last_sync column.
export async function dbLoadFinancial(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}&select=last_sync`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.last_sync ?? null;
}

export async function dbSaveFinancial(id, data) {
  const json = JSON.stringify(data);
  const body = JSON.stringify({ id, last_sync: json, updated_at: new Date().toISOString() });
  const h = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

  const patch = await fetch(`${SUPABASE_URL}/rest/v1/sync_log?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...h, "Prefer": "return=representation" },
    body,
  });
  const patched = await patch.json().catch(() => []);
  if (!Array.isArray(patched) || patched.length === 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/sync_log`, {
      method: "POST",
      headers: { ...h, "Prefer": "return=minimal" },
      body,
    });
  }
}
