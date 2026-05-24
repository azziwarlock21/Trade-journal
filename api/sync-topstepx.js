// ============================================================
// Vercel Serverless Function — TopstepX → Supabase Sync
// File: /api/sync-topstepx.js
// Runs on cron schedule + manual trigger from journal
// ============================================================

const TOPSTEPX_API  = "https://api.topstepx.com";
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY; // service role key (not anon)
const TSX_USERNAME  = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY   = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;

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
  if (!res.ok) throw new Error(`Supabase ${path}: ${await res.text()}`);
  return res.json();
}

// ── TopstepX helpers ──────────────────────────────────────────────────────────
async function tsxAuth() {
  const res = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "text/plain" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`TopstepX auth failed: ${data.errorMessage}`);
  return data.token;
}

async function tsxFetchTrades(token, accountId, startTimestamp, endTimestamp) {
  const res = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "accept": "text/plain",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ accountId, startTimestamp, endTimestamp }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`TopstepX trade fetch failed: ${data.errorMessage}`);
  return data.trades || [];
}

// ── Pair half-turn trades into round trips ────────────────────────────────────
// TopstepX returns individual fills. A round trip = open fill (P&L null) + close fill (P&L set)
// We match them by orderId pairs and creation time order
function pairTrades(fills) {
  // Sort oldest first
  const sorted = [...fills].sort((a, b) =>
    new Date(a.creationTimestamp) - new Date(b.creationTimestamp)
  );

  const roundTrips = [];
  const openLegs = []; // queue of unmatched open legs

  for (const fill of sorted) {
    if (fill.voided) continue;

    if (fill.profitAndLoss === null || fill.profitAndLoss === undefined) {
      // This is an open leg
      openLegs.push(fill);
    } else {
      // This is a close leg — match with oldest open leg
      const openLeg = openLegs.shift();
      if (!openLeg) continue; // orphaned close, skip

      const direction = openLeg.side === 0 ? "Long" : "Short"; // 0=buy=Long, 1=sell=Short
      const entryPrice = openLeg.price;
      const exitPrice  = fill.price;
      const lotSize    = openLeg.size;
      const pnl        = fill.profitAndLoss;

      // Points: GC = $100/point, so points = P&L / (lotSize * 100)
      const points = lotSize > 0 ? (pnl / (lotSize * 100)).toFixed(1) : null;
      const outcome = pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";

      // Detect session from entry time (ET)
      const entryET  = new Date(openLeg.creationTimestamp);
      const etHour   = entryET.getUTCHours() - 5; // rough ET offset (adjust for DST if needed)
      const etMins   = etHour * 60 + entryET.getUTCMinutes();
      let session = "New York";
      if (etMins >= 1080 || etMins < 180)      session = "Asia";
      else if (etMins < 480)                   session = "London";
      else if (etMins < 720)                   session = "London/NY Overlap";
      else if (etMins >= 1020)                 session = "After Hours";

      // Format datetimes as datetime-local string (ET)
      const toET = (isoStr) => {
        const d = new Date(isoStr);
        // Adjust for ET (UTC-5 standard, UTC-4 DST — simplified here)
        const etOffset = isDST(d) ? -4 : -5;
        const et = new Date(d.getTime() + etOffset * 3600000);
        return et.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
      };

      roundTrips.push({
        tsx_trade_id:   `${openLeg.id}_${fill.id}`, // unique key for dedup
        entry_datetime: toET(openLeg.creationTimestamp),
        exit_datetime:  toET(fill.creationTimestamp),
        direction,
        lot_size:       lotSize,
        entry_price:    entryPrice,
        exit_price:     null, // we removed exit price from schema
        stop_loss:      null, // not available from API
        take_profit:    null, // not available from API
        points,
        rrr:            null,
        outcome,
        session,
        trade_mode:     "Live",
        grade:          "Ungraded",
        execution_grade:"Ungraded",
        trade_type:     null,
        candle_pattern: "None",
        wick_direction: "None",
        news:           "None",
        news_impact:    "Low",
        htf_bias:       null,
        market_structure: null,
        mae:            null,
        notes:          `Auto-synced from TopstepX. P&L: $${pnl.toFixed(2)} | Fees: $${((openLeg.fees || 0) + (fill.fees || 0)).toFixed(2)}`,
        screenshot:     null,
        screenshot_name:null,
      });
    }
  }

  return roundTrips;
}

// Rough DST check for US Eastern
function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}

// ── Dedup: check which tsx_trade_ids already exist ────────────────────────────
async function getExistingIds(ids) {
  if (!ids.length) return new Set();
  // Store tsx_trade_id in notes prefix for dedup (no schema change needed)
  // We use a dedicated column if you add it, or check notes
  const res = await sbFetch(
    `/trades?select=notes&notes=like.Auto-synced*`,
    { headers: { "Prefer": "return=representation" } }
  );
  const existing = new Set(
    res.map(r => {
      const match = r.notes && r.notes.match(/tsx:([^\s|]+)/);
      return match ? match[1] : null;
    }).filter(Boolean)
  );
  return existing;
}

// ── Get last sync time from Supabase sync_log table ──────────────────────────
async function getLastSyncTime() {
  try {
    const res = await sbFetch(`/sync_log?select=last_sync&id=eq.topstepx&limit=1`);
    if (res && res[0] && res[0].last_sync) return new Date(res[0].last_sync);
  } catch(e) { /* table may not exist yet */ }
  // Default: last 7 days
  return new Date(Date.now() - 7 * 24 * 3600 * 1000);
}

async function updateLastSyncTime(time) {
  await sbFetch(`/sync_log?id=eq.topstepx`, {
    method: "PATCH",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify({ last_sync: time.toISOString(), updated_at: new Date().toISOString() }),
  }).catch(() => {
    // If row doesn't exist, insert it
    return sbFetch(`/sync_log`, {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({ id: "topstepx", last_sync: time.toISOString(), updated_at: new Date().toISOString() }),
    });
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Allow CORS for manual trigger from journal UI
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Validate cron secret to prevent unauthorized triggers
 const cronSecret = process.env.CRON_SECRET || "";
 
 // Allow Vercel cron jobs automatically
 const isVercelCron = req.headers["x-vercel-cron"];
 
 // Optional manual auth
 const authHeader = req.headers.authorization || "";
 
 if (
   !isVercelCron &&
   cronSecret &&
   authHeader !== `Bearer ${cronSecret}`
 ) {
   return res.status(401).json({ error: "Unauthorized" });
}


  try {
    // 1. Authenticate with TopstepX
    const token = await tsxAuth();

    // 2. Get time window
    const syncFrom = await getLastSyncTime();
    const syncTo   = new Date();

    console.log(`Syncing trades from ${syncFrom.toISOString()} to ${syncTo.toISOString()}`);

    // 3. Fetch fills from TopstepX
    const fills = await tsxFetchTrades(
      token,
      parseInt(TSX_ACCOUNT_ID),
      syncFrom.toISOString(),
      syncTo.toISOString()
    );

    console.log(`Fetched ${fills.length} fills from TopstepX`);

    if (!fills.length) {
      await updateLastSyncTime(syncTo);
      return res.status(200).json({ synced: 0, message: "No new fills" });
    }

    // 4. Pair into round trips
    const roundTrips = pairTrades(fills);
    console.log(`Paired into ${roundTrips.length} round trips`);

    // 5. Dedup — check which ones already exist using tsx_trade_id in notes
    const existingNotes = await sbFetch(
      `/trades?select=notes&trade_mode=eq.Live&notes=like.Auto-synced*`
    );
    const existingIds = new Set(
      existingNotes.map(r => {
        const m = r.notes && r.notes.match(/tsx_id:([^\s|]+)/);
        return m ? m[1] : null;
      }).filter(Boolean)
    );

    // 6. Filter new trades only and tag with tsx_id
    const newTrades = roundTrips
      .filter(t => !existingIds.has(t.tsx_trade_id))
      .map(t => ({
        ...t,
        id: Date.now() + Math.floor(Math.random() * 100000),
        notes: `Auto-synced from TopstepX | tsx_id:${t.tsx_trade_id} | P&L: $${t.notes.match(/P&L: \$([^\s|]+)/)?.[1] || "?"} | Fill fees included`,
        tsx_trade_id: undefined, // remove temp field
      }));

    console.log(`Inserting ${newTrades.length} new trades`);

    // 7. Insert into Supabase
    if (newTrades.length > 0) {
      await sbFetch(`/trades`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(newTrades),
      });
    }

    // 8. Update last sync time
    await updateLastSyncTime(syncTo);

    return res.status(200).json({
      success: true,
      synced: newTrades.length,
      fills: fills.length,
      from: syncFrom.toISOString(),
      to: syncTo.toISOString(),
    });

  } catch(err) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: err.message });
  }
}
