// ============================================================
// TopstepX → Supabase Sync  v5
// Data-first: derives everything directly from fill data
// ============================================================

const TOPSTEPX_API   = "https://api.topstepx.com";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;
const CRON_SECRET    = process.env.CRON_SECRET || "";

// ── Supabase ──────────────────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── TopstepX ──────────────────────────────────────────────────────────────────
async function tsxAuth() {
  const res  = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function tsxGetAccountId(token) {
  const res  = await fetch(`${TOPSTEPX_API}/api/Account/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ onlyActiveAccounts: true }),
  });
  const data = await res.json();
  if (!data.success || !data.accounts?.length) throw new Error(`No accounts: ${JSON.stringify(data)}`);
  console.log("Accounts:", data.accounts.map(a => `${a.id}:${a.name}`).join(", "));
  if (TSX_ACCOUNT_ID) {
    const match = data.accounts.find(a =>
      String(a.id) === String(TSX_ACCOUNT_ID) || a.name === TSX_ACCOUNT_ID
    );
    if (match) return match.id;
  }
  return data.accounts[0].id;
}

async function tsxFetchFills(token, accountId, from, to) {
  const res  = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ accountId, startTimestamp: from, endTimestamp: to }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(`Fill search: ${JSON.stringify(data)}`);
  return (data.trades || []).filter(f => !f.voided && f.size > 0);
}

// ── Timezone ──────────────────────────────────────────────────────────────────
function toET(iso) {
  const d   = new Date(iso);
  const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
  const dst = d.getTimezoneOffset() < Math.max(jan, jul);
  const et  = new Date(d.getTime() + (dst ? -4 : -5) * 3600000);
  return et.toISOString().slice(0, 16);
}

function getSession(iso) {
  const d   = new Date(iso);
  const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
  const dst = d.getTimezoneOffset() < Math.max(jan, jul);
  const et  = new Date(d.getTime() + (dst ? -4 : -5) * 3600000);
  const m   = et.getUTCHours() * 60 + et.getUTCMinutes();
  if (m >= 1080 || m < 180) return "Asia";
  if (m < 480)              return "London";
  if (m < 720)              return "London/NY Overlap";
  if (m < 1020)             return "New York";
  return "After Hours";
}

// ── Contract point value ──────────────────────────────────────────────────────
// MGC (Micro Gold) = $10 per point per contract
// GC  (Full Gold)  = $100 per point per contract
function pointValue(contractId) {
  return contractId?.includes("MGC") ? 10 : 100;
}

// ── PAIRING ───────────────────────────────────────────────────────────────────
//
// TopstepX fill structure (confirmed from real data):
//   - OPEN fill:  profitAndLoss === null
//   - CLOSE fill: profitAndLoss is a number
//   - Multiple fills within seconds = scaling into/out of same position
//   - Same orderId on close fills = bracket order closing multiple positions
//
// Approach: group fills within a 5-second window into events,
// then FIFO-match open events to close events of opposite side.

const WINDOW = 5000; // ms

function buildEvents(fills) {
  const sorted = [...fills].sort(
    (a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp)
  );

  const events = [];
  let cur = null;

  for (const f of sorted) {
    const ts      = new Date(f.creationTimestamp).getTime();
    const isClose = f.profitAndLoss !== null && f.profitAndLoss !== undefined;

    if (cur && cur.isClose === isClose && cur.side === f.side && ts - cur.lastTs <= WINDOW) {
      cur.fills.push(f);
      cur.lastTs      = ts;
      cur.totalSize  += f.size;
      cur.totalPnL   += isClose ? f.profitAndLoss : 0;
      cur.totalFees  += f.fees || 0;
    } else {
      cur = {
        fills:         [f],
        side:          f.side,        // 0 = buy, 1 = sell
        isClose,
        firstTs:       ts,
        lastTs:        ts,
        firstIso:      f.creationTimestamp,
        totalSize:     f.size,
        totalPnL:      isClose ? f.profitAndLoss : 0,
        totalFees:     f.fees || 0,
        contractId:    f.contractId || "",
      };
      events.push(cur);
    }
  }

  // Compute VWAP price for each event
  events.forEach(ev => {
    const totalValue = ev.fills.reduce((s, f) => s + f.price * f.size, 0);
    const totalSize  = ev.fills.reduce((s, f) => s + f.size, 0);
    ev.vwap = totalValue / totalSize;
  });

  return events;
}

function pairEvents(events) {
  const opens  = events.filter(e => !e.isClose).sort((a, b) => a.firstTs - b.firstTs);
  const closes = events.filter(e =>  e.isClose).sort((a, b) => a.firstTs - b.firstTs);

  console.log(`Events: ${opens.length} open, ${closes.length} close`);
  opens.forEach(e  => console.log(`  OPEN  side=${e.side} size=${e.totalSize} vwap=${e.vwap.toFixed(2)} ${e.firstIso.slice(0,16)}`));
  closes.forEach(e => console.log(`  CLOSE side=${e.side} size=${e.totalSize} pnl=$${e.totalPnL} ${e.firstIso.slice(0,16)}`));

  const closePool = [...closes];
  const trades    = [];

  for (const open of opens) {
    // Match: opposite side, after open time
    const oppSide = open.side === 0 ? 1 : 0;
    const idx     = closePool.findIndex(
      c => c.side === oppSide && c.firstTs > open.firstTs
    );

    if (idx === -1) {
      console.log(`  → OPEN at ${open.firstIso.slice(0,16)} has no close yet (position still live)`);
      continue;
    }

    const close = closePool.splice(idx, 1)[0];

    // ── Core trade data ────────────────────────────────────────────────────
    const direction  = open.side === 0 ? "Long" : "Short";
    const entry      = parseFloat(open.vwap.toFixed(2));
    const exit       = parseFloat(close.vwap.toFixed(2));
    const contracts  = open.totalSize;
    const pnl        = close.totalPnL;          // actual dollars from TSX
    const fees       = open.totalFees + close.totalFees;
    const pv         = pointValue(open.contractId);
    const isMicro    = open.contractId.includes("MGC");

    // ── Points — direct from actual P&L ───────────────────────────────────
    // pnl = points × pv × contracts  →  points = pnl / (pv × contracts)
    const points = parseFloat((pnl / (pv * contracts)).toFixed(1));

    // ── Outcome ────────────────────────────────────────────────────────────
    const outcome = pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";

    // ── SL / TP / RRR — derived from your fixed 1:2 system ────────────────
    // Win  → you hit TP → TP dist = |exit−entry|, SL = TP dist ÷ 2
    // Loss → you hit SL → SL dist = |exit−entry|, TP = SL dist × 2
    let stopLoss = null, takeProfit = null, rrr = "0.00";

    const exitDist = Math.abs(exit - entry);

    if (outcome === "Win") {
      const slDist = exitDist / 2;
      stopLoss   = direction === "Long"
        ? parseFloat((entry - slDist).toFixed(2))
        : parseFloat((entry + slDist).toFixed(2));
      takeProfit = direction === "Long"
        ? parseFloat((entry + exitDist).toFixed(2))
        : parseFloat((entry - exitDist).toFixed(2));
      rrr = "2.00";

    } else if (outcome === "Loss") {
      const tpDist = exitDist * 2;
      stopLoss   = direction === "Long"
        ? parseFloat((entry - exitDist).toFixed(2))
        : parseFloat((entry + exitDist).toFixed(2));
      takeProfit = direction === "Long"
        ? parseFloat((entry + tpDist).toFixed(2))
        : parseFloat((entry - tpDist).toFixed(2));
      rrr = "-1.00";
    }

    // ── Stable dedup ID ────────────────────────────────────────────────────
    const tsxId = [...open.fills, ...close.fills]
      .map(f => String(f.id))
      .sort()
      .join("_");

    // ── Notes — useful context, not clutter ────────────────────────────────
    const noteparts = [
      `tsx_id:${tsxId}`,
      `P&L: $${pnl.toFixed(2)}`,
      `Fees: $${fees.toFixed(2)}`,
      contracts > 1 ? `${contracts} contracts` : null,
      `${isMicro ? "MGC" : "GC"} @ $${pv}/pt`,
    ].filter(Boolean);

    console.log(`  → ${direction} ${contracts}x | ${points >= 0 ? "+" : ""}${points}pts | $${pnl} | ${outcome} | SL:${stopLoss} TP:${takeProfit} RRR:${rrr}`);

    trades.push({
      id:               Date.now() + Math.floor(Math.random() * 999999),
      entry_datetime:   toET(open.firstIso),
      exit_datetime:    toET(close.firstIso),
      direction,
      lot_size:         contracts,
      entry_price:      entry,
      stop_loss:        stopLoss,
      take_profit:      takeProfit,
      points:           String(points),
      rrr,
      outcome,
      mae:              null,
      session:          getSession(open.firstIso),
      trade_mode:       "Live",
      grade:            "Ungraded",
      execution_grade:  "Ungraded",
      trade_type:       "Supply and Demand",
      candle_pattern:   "None",
      wick_direction:   "None",
      news:             "None",
      news_impact:      "Low",
      htf_bias:         null,
      market_structure: null,
      notes:            `Auto-synced from TopstepX | ${noteparts.join(" | ")}`,
      screenshot:       null,
      screenshot_name:  null,
    });
  }

  if (closePool.length) {
    console.log(`${closePool.length} close event(s) unmatched — orphaned closes ignored`);
  }

  return trades;
}

// ── Sync log ──────────────────────────────────────────────────────────────────
async function getLastSyncTime(forceFrom) {
  if (forceFrom) return new Date(forceFrom);
  try {
    const rows = await sbFetch(`/sync_log?select=last_sync&id=eq.topstepx&limit=1`);
    if (rows?.[0]?.last_sync) return new Date(rows[0].last_sync);
  } catch(e) { /* first run */ }
  return new Date(Date.now() - 365 * 24 * 3600 * 1000);
}

async function setLastSyncTime(t) {
  const body = JSON.stringify({
    id: "topstepx",
    last_sync: t.toISOString(),
    updated_at: new Date().toISOString(),
  });
  try {
    await sbFetch(`/sync_log?id=eq.topstepx`, {
      method: "PATCH", headers: { "Prefer": "return=minimal" }, body,
    });
  } catch(e) {
    await sbFetch(`/sync_log`, {
      method: "POST", headers: { "Prefer": "return=minimal" }, body,
    });
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (CRON_SECRET) {
    const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (auth !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { resetSync, forceFrom } = req.body || {};

    if (resetSync) {
      console.log("Full reset requested — clearing sync log");
      try {
        await sbFetch(`/sync_log?id=eq.topstepx`, {
          method: "DELETE", headers: { "Prefer": "return=minimal" },
        });
      } catch(e) { /* ok if missing */ }
    }

    const token     = await tsxAuth();
    const accountId = await tsxGetAccountId(token);
    const from      = await getLastSyncTime(forceFrom);
    const to        = new Date();

    console.log(`Syncing ${from.toISOString().slice(0,16)} → ${to.toISOString().slice(0,16)}`);

    const fills = await tsxFetchFills(token, accountId, from.toISOString(), to.toISOString());
    console.log(`${fills.length} fills fetched`);

    if (!fills.length) {
      await setLastSyncTime(to);
      return res.status(200).json({ success: true, synced: 0, message: "No fills in range" });
    }

    const events = buildEvents(fills);
    const trades  = pairEvents(events);
    console.log(`${trades.length} trades paired`);

    // Dedup: skip any tsx_id already in Supabase
    const existing = await sbFetch(
      `/trades?select=notes&trade_mode=eq.Live&notes=like.Auto-synced*&limit=5000`
    );
    const knownIds = new Set(
      (existing || []).flatMap(r => {
        const m = r.notes?.match(/tsx_id:([^\s|]+)/);
        return m ? [m[1]] : [];
      })
    );

    const newTrades = trades.filter(t => {
      const m = t.notes?.match(/tsx_id:([^\s|]+)/);
      return m ? !knownIds.has(m[1]) : true;
    });

    console.log(`${newTrades.length} new | ${trades.length - newTrades.length} already imported`);

    if (newTrades.length > 0) {
      await sbFetch(`/trades`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(newTrades),
      });
    }

    await setLastSyncTime(to);

    return res.status(200).json({
      success:        true,
      synced:         newTrades.length,
      skipped:        trades.length - newTrades.length,
      fills:          fills.length,
      from:           from.toISOString(),
      to:             to.toISOString(),
    });

  } catch(err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
