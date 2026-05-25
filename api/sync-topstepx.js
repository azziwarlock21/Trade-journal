// ============================================================
// Vercel Serverless Function — TopstepX → Supabase Sync
// v4 — rewritten pairing based on real fill data analysis
// ============================================================

const TOPSTEPX_API   = "https://api.topstepx.com";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;
const CRON_SECRET    = process.env.CRON_SECRET || "";

// ── Supabase ──────────────────────────────────────────────────────────────────
const sbH = (extra = {}) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  ...extra,
});

async function sbFetch(path, opts = {}) {
  const res  = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts, headers: sbH(opts.headers || {}),
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
  if (!data.token) throw new Error(`TopstepX auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function tsxGetAccountId(token) {
  const res  = await fetch(`${TOPSTEPX_API}/api/Account/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ onlyActiveAccounts: true }),
  });
  const data = await res.json();
  if (!data.success || !data.accounts?.length) throw new Error(`No active accounts: ${JSON.stringify(data)}`);
  console.log("Accounts:", data.accounts.map(a => `${a.id}:${a.name}`).join(", "));
  if (TSX_ACCOUNT_ID) {
    const match = data.accounts.find(a => String(a.id) === String(TSX_ACCOUNT_ID) || a.name === TSX_ACCOUNT_ID);
    if (match) return match.id;
  }
  return data.accounts[0].id;
}

async function tsxFetchFills(token, accountId, startTimestamp, endTimestamp) {
  const res  = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ accountId, startTimestamp, endTimestamp }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(`TopstepX fills: ${JSON.stringify(data)}`);
  return data.trades || [];
}

// ── Timezone helpers ──────────────────────────────────────────────────────────
function isDST(d) {
  const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
  return d.getTimezoneOffset() < Math.max(jan, jul);
}
function toET(iso) {
  const d = new Date(iso);
  const et = new Date(d.getTime() + (isDST(d) ? -4 : -5) * 3600000);
  return et.toISOString().slice(0, 16);
}
function getSession(iso) {
  const d    = new Date(iso);
  const et   = new Date(d.getTime() + (isDST(d) ? -4 : -5) * 3600000);
  const mins = et.getUTCHours() * 60 + et.getUTCMinutes();
  if (mins >= 1080 || mins < 180) return "Asia";
  if (mins < 480)  return "London";
  if (mins < 720)  return "London/NY Overlap";
  if (mins < 1020) return "New York";
  return "After Hours";
}

// ── PAIRING LOGIC ─────────────────────────────────────────────────────────────
//
// What we learned from real fill data:
//
// 1. OPEN fill:  profitAndLoss === null
//    CLOSE fill: profitAndLoss is a number (positive or negative)
//    This is 100% reliable — confirmed in raw data.
//
// 2. Multiple positions on the same day:
//    - Each has its own open fill (P&L=null) + close fill (P&L=number)
//    - They are completely independent — different prices, different times
//    - Each should become ONE journal trade
//
// 3. Scaling into a position (multiple contracts):
//    - Can be ONE fill with size=2 (May 18 example: size=2, one close fill)
//    - OR can be multiple fills within seconds (May 21 example: 2x size=1 shorts)
//    - When multiple opens happen within 5 seconds → same trade, average price
//    - When multiple closes happen within 5 seconds → same trade, average price
//
// 4. Bracket orders closing multiple positions simultaneously:
//    - Both closes get same orderId and near-identical timestamps
//    - This means 2 separate round trips, each with their own entry price
//
// STRATEGY:
// Sort fills oldest-first. Walk through maintaining a position queue.
// Group fills within 5 seconds + same side into "fill groups".
// Match open groups with close groups using FIFO.

const GROUP_WINDOW_MS = 5000; // fills within 5 seconds = same order event

function groupFills(fills) {
  // Sort oldest first
  const sorted = [...fills]
    .filter(f => !f.voided && f.size > 0)
    .sort((a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp));

  const groups = [];
  let current = null;

  for (const fill of sorted) {
    const ts = new Date(fill.creationTimestamp).getTime();
    const isClose = fill.profitAndLoss !== null && fill.profitAndLoss !== undefined;

    if (
      current &&
      current.isClose === isClose &&
      current.side === fill.side &&
      ts - current.lastTs <= GROUP_WINDOW_MS
    ) {
      // Add to current group
      current.fills.push(fill);
      current.lastTs = ts;
      current.totalSize    += fill.size;
      current.totalPnL     += fill.profitAndLoss || 0;
      current.totalFees    += fill.fees || 0;
      current.totalCommissions += fill.commissions || 0;
      // VWAP price
      current.vwapPrice = current.fills.reduce((s, f) => s + f.price * f.size, 0) /
                          current.fills.reduce((s, f) => s + f.size, 0);
    } else {
      // Start new group
      current = {
        fills: [fill],
        side: fill.side,
        isClose,
        firstTs: ts,
        lastTs: ts,
        totalSize: fill.size,
        totalPnL: fill.profitAndLoss || 0,
        totalFees: fill.fees || 0,
        totalCommissions: fill.commissions || 0,
        vwapPrice: fill.price,
        firstTimestamp: fill.creationTimestamp,
      };
      groups.push(current);
    }
  }

  return groups;
}

function pairGroups(groups) {
  const roundTrips = [];

  // Separate opens and closes
  const opens  = groups.filter(g => !g.isClose);
  const closes = groups.filter(g => g.isClose);

  console.log(`Groups: ${opens.length} open groups, ${closes.length} close groups`);
  opens.forEach(g => console.log(`  OPEN  side=${g.side} size=${g.totalSize} price=${g.vwapPrice.toFixed(2)} ${g.firstTimestamp}`));
  closes.forEach(g => console.log(`  CLOSE side=${g.side} size=${g.totalSize} pnl=${g.totalPnL} ${g.firstTimestamp}`));

  // FIFO match: each open group pairs with the next close group of opposite side
  // Sort both by time
  const openQueue  = [...opens].sort((a, b) => a.firstTs - b.firstTs);
  const closeQueue = [...closes].sort((a, b) => a.firstTs - b.firstTs);

  for (const openGroup of openQueue) {
    // Find earliest close group that:
    // 1. Happened AFTER the open
    // 2. Is opposite side (open=0/buy → close=1/sell, open=1/sell → close=0/buy)
    const oppositeSide = openGroup.side === 0 ? 1 : 0;
    const closeIdx = closeQueue.findIndex(
      c => c.side === oppositeSide && c.firstTs > openGroup.firstTs
    );

    if (closeIdx === -1) {
      console.log(`No close found for open at ${openGroup.firstTimestamp} — position still open, skipping`);
      continue;
    }

    const closeGroup = closeQueue.splice(closeIdx, 1)[0];

    const direction   = openGroup.side === 0 ? "Long" : "Short";
    const entryPrice  = parseFloat(openGroup.vwapPrice.toFixed(2));
    const exitPrice   = parseFloat(closeGroup.vwapPrice.toFixed(2));
    const lotSize     = openGroup.totalSize;
    const pnl         = closeGroup.totalPnL;
    const fees        = openGroup.totalFees + closeGroup.totalFees;
    const commissions = openGroup.totalCommissions + closeGroup.totalCommissions;

    const contractId  = openGroup.fills[0].contractId || "";
    const isMicro     = contractId.includes("MGC");

    const outcome = pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";

    // Points from actual price difference (0.1 price = 1 point for both GC and MGC)
    const priceDiff = direction === "Long"
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
    const points = (priceDiff * 10).toFixed(1);

    // Your system: always 1:2 RRR — SL is always half the distance of TP
    // Win  → exit hit TP → TP distance = |exit - entry|, SL = TP/2
    // Loss → exit hit SL → SL distance = |exit - entry|, TP = SL*2
    let stopLoss = null, takeProfit = null, rrr = null;

    if (outcome === "Win") {
      const tpDist = Math.abs(exitPrice - entryPrice);
      const slDist = tpDist / 2;
      if (direction === "Long") {
        stopLoss   = parseFloat((entryPrice - slDist).toFixed(2));
        takeProfit = parseFloat((entryPrice + tpDist).toFixed(2));
      } else {
        stopLoss   = parseFloat((entryPrice + slDist).toFixed(2));
        takeProfit = parseFloat((entryPrice - tpDist).toFixed(2));
      }
      rrr = "2.00";
    } else if (outcome === "Loss") {
      const slDist = Math.abs(exitPrice - entryPrice);
      const tpDist = slDist * 2;
      if (direction === "Long") {
        stopLoss   = parseFloat((entryPrice - slDist).toFixed(2));
        takeProfit = parseFloat((entryPrice + tpDist).toFixed(2));
      } else {
        stopLoss   = parseFloat((entryPrice + slDist).toFixed(2));
        takeProfit = parseFloat((entryPrice - tpDist).toFixed(2));
      }
      rrr = "-1.00";
    } else {
      // Breakeven — can't derive SL/TP, leave null
      rrr = "0.00";
    }

    // Stable dedup ID from sorted fill IDs across both groups
    const allFillIds = [...openGroup.fills, ...closeGroup.fills]
      .map(f => String(f.id))
      .sort()
      .join("_");

    roundTrips.push({
      id:               Date.now() + Math.floor(Math.random() * 999999),
      entry_datetime:   toET(openGroup.firstTimestamp),
      exit_datetime:    toET(closeGroup.firstTimestamp),
      direction,
      lot_size:         lotSize,
      entry_price:      entryPrice,
      exit_price:       null,
      stop_loss:        stopLoss,
      take_profit:      takeProfit,
      points,
      rrr,
      outcome,
      mae:              null,
      session:          getSession(openGroup.firstTimestamp),
      trade_mode:       "Live",
      grade:            "Ungraded",
      execution_grade:  "Ungraded",
      trade_type:       null,
      candle_pattern:   "None",
      wick_direction:   "None",
      news:             "None",
      news_impact:      "Low",
      htf_bias:         null,
      market_structure: null,
      notes: [
        `Auto-synced from TopstepX | tsx_id:${allFillIds}`,
        `P&L: $${pnl.toFixed(2)}`,
        `Fees: $${fees.toFixed(2)}`,
        `Contract: ${contractId}`,
        lotSize > 1 ? `${lotSize} contracts` : null,
        isMicro ? "Micro Gold (MGC)" : "Gold (GC)",
      ].filter(Boolean).join(" | "),
      screenshot:      null,
      screenshot_name: null,
    });
  }

  if (closeQueue.length > 0) {
    console.log(`${closeQueue.length} close group(s) had no matching open — orphaned`);
  }

  return roundTrips;
}

// ── Sync log ──────────────────────────────────────────────────────────────────
async function getLastSyncTime(forceFrom) {
  if (forceFrom) return new Date(forceFrom);
  try {
    const res = await sbFetch(`/sync_log?select=last_sync&id=eq.topstepx&limit=1`);
    if (res?.[0]?.last_sync) return new Date(res[0].last_sync);
  } catch(e) { console.log("sync_log not found"); }
  return new Date(Date.now() - 365 * 24 * 3600 * 1000);
}

async function updateLastSyncTime(time) {
  const body = JSON.stringify({ id: "topstepx", last_sync: time.toISOString(), updated_at: new Date().toISOString() });
  try {
    const r = await sbFetch(`/sync_log?id=eq.topstepx`, {
      method: "PATCH", headers: { "Prefer": "return=minimal" }, body,
    });
    if (!r && r !== null) throw new Error("patch returned nothing");
  } catch(e) {
    await sbFetch(`/sync_log`, { method: "POST", headers: { "Prefer": "return=minimal" }, body });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (CRON_SECRET) {
    const provided = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (provided !== CRON_SECRET) {
      console.log(`Auth mismatch. Got: "${provided}"`);
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const body = req.body || {};
    const { resetSync, forceFrom } = body;

    if (resetSync) {
      console.log("resetSync requested");
      try {
        await sbFetch(`/sync_log?id=eq.topstepx`, {
          method: "DELETE", headers: { "Prefer": "return=minimal" },
        });
      } catch(e) { console.log("sync_log clear:", e.message); }
    }

    const token     = await tsxAuth();
    const accountId = await tsxGetAccountId(token);
    const syncFrom  = await getLastSyncTime(forceFrom);
    const syncTo    = new Date();

    console.log(`Sync window: ${syncFrom.toISOString()} → ${syncTo.toISOString()}`);

    const fills = await tsxFetchFills(token, accountId, syncFrom.toISOString(), syncTo.toISOString());
    console.log(`${fills.length} raw fills`);

    if (!fills.length) {
      await updateLastSyncTime(syncTo);
      return res.status(200).json({ success: true, synced: 0, fills: 0, message: "No fills in range" });
    }

    // Group fills within time windows, then pair opens with closes
    const groups     = groupFills(fills);
    const roundTrips = pairGroups(groups);
    console.log(`${roundTrips.length} round trips from ${fills.length} fills`);

    // Dedup against existing trades
    const existing = await sbFetch(
      `/trades?select=notes&trade_mode=eq.Live&notes=like.Auto-synced*&limit=5000`
    );
    const existingIds = new Set(
      (existing || []).flatMap(r => {
        const m = r.notes?.match(/tsx_id:([^\s|]+)/);
        return m ? [m[1]] : [];
      })
    );

    const newTrades = roundTrips.filter(t => {
      const m = t.notes?.match(/tsx_id:([^\s|]+)/);
      return m ? !existingIds.has(m[1]) : true;
    });

    console.log(`${newTrades.length} new, ${roundTrips.length - newTrades.length} already exist`);

    if (newTrades.length > 0) {
      await sbFetch(`/trades`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(newTrades),
      });
    }

    await updateLastSyncTime(syncTo);

    return res.status(200).json({
      success:        true,
      synced:         newTrades.length,
      alreadyExisted: roundTrips.length - newTrades.length,
      fills:          fills.length,
      roundTrips:     roundTrips.length,
      from:           syncFrom.toISOString(),
      to:             syncTo.toISOString(),
    });

  } catch(err) {
    console.error("Sync error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
