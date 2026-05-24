// ============================================================
// Vercel Serverless Function — TopstepX → Supabase Sync
// File: /api/sync-topstepx.js
// ============================================================

const TOPSTEPX_API   = "https://api.topstepx.com";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;
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
  try { data = JSON.parse(text); } catch(e) { throw new Error(`TopstepX auth parse failed: ${text.slice(0,200)}`); }
  if (!data.token) throw new Error(`TopstepX auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

// ── Fetch active account ID ───────────────────────────────────────────────────
async function tsxGetAccountId(token) {
  const res = await fetch(`${TOPSTEPX_API}/api/Account/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ onlyActiveAccounts: true }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(`TopstepX account search parse failed: ${text.slice(0,200)}`); }
  if (!data.success || !data.accounts?.length) throw new Error(`TopstepX no active accounts: ${JSON.stringify(data)}`);
  console.log("Accounts:", JSON.stringify(data.accounts.map(a => ({ id: a.id, name: a.name }))));
  if (TSX_ACCOUNT_ID) {
    const match = data.accounts.find(a => String(a.id) === String(TSX_ACCOUNT_ID) || a.name === TSX_ACCOUNT_ID);
    if (match) return match.id;
    console.warn(`TOPSTEPX_ACCOUNT_ID "${TSX_ACCOUNT_ID}" not matched — using first account`);
  }
  return data.accounts[0].id;
}

// ── Fetch fills ───────────────────────────────────────────────────────────────
async function tsxFetchTrades(token, accountId, startTimestamp, endTimestamp) {
  const res = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ accountId, startTimestamp, endTimestamp }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(`TopstepX trade search parse failed: ${text.slice(0,200)}`); }
  if (!res.ok || data.success === false) throw new Error(`TopstepX trade search: ${JSON.stringify(data)}`);
  return data.trades || [];
}

// ── Timezone helpers ──────────────────────────────────────────────────────────
function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return date.getTimezoneOffset() < Math.max(jan, jul);
}

function toET(isoStr) {
  const d = new Date(isoStr);
  const offset = isDST(d) ? -4 : -5;
  const et = new Date(d.getTime() + offset * 3600000);
  return et.toISOString().slice(0, 16);
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

// ── Net-position pairing ──────────────────────────────────────────────────────
// TopstepX: buy fills open longs / close shorts. Sell fills open shorts / close longs.
// Track net position. When it returns to 0 → complete round trip.
// Use integer arithmetic to avoid floating point drift.
function pairTrades(fills) {
  const sorted = [...fills]
    .filter(f => !f.voided && f.size > 0)
    .sort((a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp));

  const roundTrips = [];
  let netPos    = 0;   // integer, + = long, - = short
  let openFills = [];
  let closeFills = [];
  let totalPnL  = 0;
  let totalFees = 0;

  for (const fill of sorted) {
    const qty       = Math.round(fill.size);   // integer contracts
    const signedQty = fill.side === 0 ? qty : -qty;

    // Classify as opening or closing
    const isOpen = netPos === 0 ||
                   (netPos > 0 && fill.side === 0) ||
                   (netPos < 0 && fill.side === 1);

    if (isOpen) openFills.push(fill);
    else        closeFills.push(fill);

    netPos    += signedQty;
    totalPnL  += fill.profitAndLoss || 0;
    totalFees += fill.fees || 0;

    // Round trip complete
    if (netPos === 0 && openFills.length > 0) {
      const direction   = openFills[0].side === 0 ? "Long" : "Short";
      const totalOpenQty = openFills.reduce((s, f) => s + Math.round(f.size), 0);
      const entryVWAP   = openFills.reduce((s, f) => s + f.price * Math.round(f.size), 0) / totalOpenQty;

      const totalCloseQty = closeFills.reduce((s, f) => s + Math.round(f.size), 0);
      const exitVWAP = totalCloseQty > 0
        ? closeFills.reduce((s, f) => s + f.price * Math.round(f.size), 0) / totalCloseQty
        : null;

      const entryTime = openFills[0].creationTimestamp;
      const exitTime  = closeFills.length > 0
        ? closeFills[closeFills.length - 1].creationTimestamp
        : openFills[openFills.length - 1].creationTimestamp;

      // MAE extreme price — worst fill price against position among close fills
      let maePrice = null;
      if (closeFills.length > 0) {
        maePrice = direction === "Long"
          ? Math.min(...closeFills.map(f => f.price))
          : Math.max(...closeFills.map(f => f.price));
      }

      // MAE in points (how far against us the worst fill was)
      let mae = null;
      if (maePrice !== null) {
        const raw = direction === "Long"
          ? (entryVWAP - maePrice) * 10
          : (maePrice - entryVWAP) * 10;
        mae = raw > 0 ? raw.toFixed(1) : "0.0";
      }

      // Points from actual P&L
      const points = totalOpenQty > 0
        ? (totalPnL / (totalOpenQty * 100)).toFixed(1)
        : null;

      const outcome = parseFloat(points) > 0 ? "Win"
                    : parseFloat(points) < 0 ? "Loss"
                    : "Breakeven";

      // Stable unique ID: sorted fill IDs
      const allIds = [...openFills, ...closeFills]
        .map(f => String(f.id))
        .sort()
        .join("_");

      roundTrips.push({
        id:               Date.now() + Math.floor(Math.random() * 999999),
        entry_datetime:   toET(entryTime),
        exit_datetime:    toET(exitTime),
        direction,
        lot_size:         totalOpenQty,
        entry_price:      parseFloat(entryVWAP.toFixed(2)),
        exit_price:       exitVWAP ? parseFloat(exitVWAP.toFixed(2)) : null,
        stop_loss:        null,
        take_profit:      null,
        points,
        rrr:              null,
        outcome,
        mae:              mae,
        mae_price:        maePrice ? parseFloat(maePrice.toFixed(2)) : null,
        session:          getSession(entryTime),
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
          `Auto-synced from TopstepX | tsx_id:${allIds}`,
          `P&L: $${totalPnL.toFixed(2)}`,
          `Fees: $${totalFees.toFixed(2)}`,
          totalOpenQty > 1 || openFills.length > 1
            ? `Fills: ${openFills.length} open / ${closeFills.length} close` : null,
          exitVWAP ? `Avg exit: ${exitVWAP.toFixed(2)}` : null,
        ].filter(Boolean).join(" | "),
        screenshot:       null,
        screenshot_name:  null,
      });

      openFills  = [];
      closeFills = [];
      totalPnL   = 0;
      totalFees  = 0;
    }
  }

  if (openFills.length > 0) {
    console.log(`${openFills.length} open fills remaining (position still open — skipping)`);
  }

  return roundTrips;
}

// ── Sync log helpers ──────────────────────────────────────────────────────────
async function getLastSyncTime(forceFrom) {
  if (forceFrom) return new Date(forceFrom);
  try {
    const res = await sbFetch(`/sync_log?select=last_sync&id=eq.topstepx&limit=1`);
    if (res?.[0]?.last_sync) return new Date(res[0].last_sync);
  } catch(e) { console.log("sync_log not found, using 1-year default"); }
  return new Date(Date.now() - 365 * 24 * 3600 * 1000);
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

  if (CRON_SECRET) {
    const provided = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (provided !== CRON_SECRET) {
      console.log(`Auth failed. Got: "${provided}"`);
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const body = req.body || {};
    const { resetSync, forceFrom } = body;

    if (resetSync) {
      console.log("resetSync — clearing sync_log");
      try {
        await sbFetch(`/sync_log?id=eq.topstepx`, {
          method: "DELETE",
          headers: { "Prefer": "return=minimal" },
        });
      } catch(e) { console.log("sync_log clear:", e.message); }
    }

    const token     = await tsxAuth();
    const accountId = await tsxGetAccountId(token);
    const syncFrom  = await getLastSyncTime(forceFrom);
    const syncTo    = new Date();

    console.log(`Account: ${accountId} | ${syncFrom.toISOString()} → ${syncTo.toISOString()}`);

    const fills = await tsxFetchTrades(token, accountId, syncFrom.toISOString(), syncTo.toISOString());
    console.log(`${fills.length} fills fetched`);

    if (!fills.length) {
      await updateLastSyncTime(syncTo);
      return res.status(200).json({ success: true, synced: 0, fills: 0, message: "No fills in range" });
    }

    const roundTrips = pairTrades(fills);
    console.log(`${roundTrips.length} round trips paired`);

    // Dedup: fetch all tsx_ids already stored
    const existingRaw = await sbFetch(
      `/trades?select=notes&trade_mode=eq.Live&notes=like.Auto-synced*&limit=5000`
    );
    const existingIds = new Set(
      (existingRaw || []).flatMap(r => {
        const m = r.notes?.match(/tsx_id:([^\s|]+)/);
        return m ? [m[1]] : [];
      })
    );

    const newTrades = roundTrips.filter(t => {
      const m = t.notes?.match(/tsx_id:([^\s|]+)/);
      return m ? !existingIds.has(m[1]) : true;
    });

    console.log(`${newTrades.length} new trades to insert (${roundTrips.length - newTrades.length} already exist)`);

    if (newTrades.length > 0) {
      // Remove mae_price — not a Supabase column, store in notes
      const toInsert = newTrades.map(({ mae_price, exit_price, ...t }) => ({
        ...t,
        // Add mae_price to notes if present
        notes: mae_price ? `${t.notes} | MAE price: ${mae_price}` : t.notes,
      }));
      await sbFetch(`/trades`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(toInsert),
      });
    }

    await updateLastSyncTime(syncTo);

    return res.status(200).json({
      success: true,
      synced: newTrades.length,
      alreadyExisted: roundTrips.length - newTrades.length,
      fills: fills.length,
      roundTrips: roundTrips.length,
      from: syncFrom.toISOString(),
      to: syncTo.toISOString(),
    });

  } catch(err) {
    console.error("Sync error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
