// ============================================================
// Vercel Serverless Function — TopstepX → Supabase Sync
// File: /api/sync-topstepx.js
// ============================================================

const TOPSTEPX_API   = "https://api.topstepx.com";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID; // keep as string
const CRON_SECRET    = process.env.CRON_SECRET || "";

// ── Supabase helpers ──────────────────────────────────────────────────────────
const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: { ...sbHeaders, ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── TopstepX auth ─────────────────────────────────────────────────────────────
async function tsxAuth() {
  const res = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(`TopstepX auth bad response: ${text}`); }
  if (!data.token) throw new Error(`TopstepX auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

// ── TopstepX fetch trades ─────────────────────────────────────────────────────
async function tsxFetchTrades(token, startTimestamp, endTimestamp) {
  const res = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "accept": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      accountId: TSX_ACCOUNT_ID,  // keep as string — API may want string or number
      startTimestamp,
      endTimestamp,
    }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(`TopstepX trade fetch bad response: ${text}`); }
  if (!res.ok || data.success === false) throw new Error(`TopstepX trade fetch: ${JSON.stringify(data)}`);
  return data.trades || [];
}

// ── Pair fills into round trips ───────────────────────────────────────────────
function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  return date.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

function toET(isoStr) {
  const d = new Date(isoStr);
  const offset = isDST(d) ? -4 : -5;
  const et = new Date(d.getTime() + offset * 3600000);
  return et.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function getSession(isoStr) {
  const d = new Date(isoStr);
  const offset = isDST(d) ? -4 : -5;
  const et = new Date(d.getTime() + offset * 3600000);
  const mins = et.getUTCHours() * 60 + et.getUTCMinutes();
  if (mins >= 1080 || mins < 180) return "Asia";
  if (mins < 480)  return "London";
  if (mins < 720)  return "London/NY Overlap";
  if (mins < 1020) return "New York";
  return "After Hours";
}

function pairTrades(fills) {
  const sorted = [...fills]
    .filter(f => !f.voided)
    .sort((a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp));

  const roundTrips = [];
  const openLegs = [];

  for (const fill of sorted) {
    const hasClose = fill.profitAndLoss !== null && fill.profitAndLoss !== undefined;
    if (!hasClose) {
      openLegs.push(fill);
    } else {
      const openLeg = openLegs.shift();
      if (!openLeg) continue;

      const direction  = openLeg.side === 0 ? "Long" : "Short";
      const entryPrice = openLeg.price;
      const lotSize    = openLeg.size;
      const pnl        = fill.profitAndLoss;
      const fees       = (openLeg.fees || 0) + (fill.fees || 0);
      const points     = lotSize > 0 ? (pnl / (lotSize * 100)).toFixed(1) : null;
      const outcome    = parseFloat(points) > 0 ? "Win" : parseFloat(points) < 0 ? "Loss" : "Breakeven";
      const tsxId      = `${openLeg.id}_${fill.id}`;

      roundTrips.push({
        id:               Date.now() + Math.floor(Math.random() * 999999),
        entry_datetime:   toET(openLeg.creationTimestamp),
        exit_datetime:    toET(fill.creationTimestamp),
        direction,
        lot_size:         lotSize,
        entry_price:      entryPrice,
        exit_price:       null,
        stop_loss:        null,
        take_profit:      null,
        points,
        rrr:              null,
        outcome,
        session:          getSession(openLeg.creationTimestamp),
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
        mae:              null,
        notes:            `Auto-synced from TopstepX | tsx_id:${tsxId} | P&L: $${pnl.toFixed(2)} | Fees: $${fees.toFixed(2)}`,
        screenshot:       null,
        screenshot_name:  null,
      });
    }
  }
  return roundTrips;
}

// ── Sync log helpers ──────────────────────────────────────────────────────────
async function getLastSyncTime() {
  try {
    const res = await sbFetch(`/sync_log?select=last_sync&id=eq.topstepx&limit=1`);
    if (res && res[0] && res[0].last_sync) return new Date(res[0].last_sync);
  } catch(e) { console.log("sync_log not found, using 7-day default"); }
  return new Date(Date.now() - 7 * 24 * 3600 * 1000);
}

async function updateLastSyncTime(time) {
  try {
    await sbFetch(`/sync_log?id=eq.topstepx`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ last_sync: time.toISOString(), updated_at: new Date().toISOString() }),
    });
  } catch(e) {
    await sbFetch(`/sync_log`, {
      method: "POST",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ id: "topstepx", last_sync: time.toISOString(), updated_at: new Date().toISOString() }),
    });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Auth check — skip if no CRON_SECRET is set (easier dev testing)
  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (authHeader !== CRON_SECRET) {
      console.log(`Auth failed. Got: "${authHeader}", Expected: "${CRON_SECRET}"`);
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const token    = await tsxAuth();
    const syncFrom = await getLastSyncTime();
    const syncTo   = new Date();

    console.log(`Syncing ${syncFrom.toISOString()} → ${syncTo.toISOString()}`);

    const fills = await tsxFetchTrades(token, syncFrom.toISOString(), syncTo.toISOString());
    console.log(`${fills.length} fills fetched`);

    if (!fills.length) {
      await updateLastSyncTime(syncTo);
      return res.status(200).json({ success: true, synced: 0, message: "No new fills" });
    }

    const roundTrips = pairTrades(fills);
    console.log(`${roundTrips.length} round trips paired`);

    // Dedup by tsx_id in notes
    const existing = await sbFetch(`/trades?select=notes&trade_mode=eq.Live&notes=like.Auto-synced*`);
    const existingIds = new Set(
      (existing || []).map(r => {
        const m = r.notes && r.notes.match(/tsx_id:([^\s|]+)/);
        return m ? m[1] : null;
      }).filter(Boolean)
    );

    const newTrades = roundTrips.filter(t => {
      const m = t.notes.match(/tsx_id:([^\s|]+)/);
      return m ? !existingIds.has(m[1]) : true;
    });

    console.log(`${newTrades.length} new trades to insert`);

    if (newTrades.length > 0) {
      await sbFetch(`/trades`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(newTrades),
      });
    }

    await updateLastSyncTime(syncTo);

    return res.status(200).json({
      success: true,
      synced: newTrades.length,
      fills: fills.length,
      from: syncFrom.toISOString(),
      to: syncTo.toISOString(),
    });

  } catch(err) {
    console.error("Sync error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
